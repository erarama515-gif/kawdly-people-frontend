/**
 * Kawdly People — Electron main process.
 *
 * Startup is a strict sequence, and the order is the design:
 *
 *   single-instance lock → resolvePaths → userData tree → splash window
 *   → assertPaths → first-run bootstrap / upgrade migrate → APP_KEY
 *   → free port → spawn PHP → readiness probe → main window → show
 *
 * The splash is created BEFORE anything that can take time or fail, so that
 * every later step has somewhere to report progress and a slow PHP cold boot
 * never looks like "nothing happened". The main window is created only after
 * the probe passes, so the user can never see a half-booted Laravel.
 *
 * ---------------------------------------------------------------------------
 * What T5 changed here
 * ---------------------------------------------------------------------------
 * T3 resolved paths inline from `__dirname` (`resolveDevPaths`, DEV-ONLY), read
 * APP_KEY out of the backend's `.env`, and copied the developer's own
 * `database.sqlite` into userData (`seedDevDatabase`, DEV-ONLY). All three are
 * gone. Path resolution now lives in `paths.ts` and provisioning in
 * `first-run.ts`, and BOTH run identically in dev and packaged — which is the
 * point: the first-run code path users hit is the one exercised every day here,
 * not one that only ever executes on a stranger's machine.
 *
 * ---------------------------------------------------------------------------
 * What T6 added here
 * ---------------------------------------------------------------------------
 * One fire-and-forget call to `maybeNotifyUpdate` once the window is on screen.
 * It is NOT awaited and NOT part of the sequence above, which is the whole
 * design: a release feed that is slow, unreachable or wrong must not be able to
 * delay — or fail — someone opening their HR records. See update-check.ts for
 * why this notifies instead of installing.
 *
 * Deliberately NOT here (later sessions):
 *   crash supervision / restart and orphan reaping across app restarts
 *   log rotation
 *   Vite dev-server mode with HMR
 *   downloading or installing an update (design §7 decision 4 keeps that in v2,
 *     behind code signing, which the zero-card policy puts outside Phase 1)
 */

import { app, BrowserWindow, clipboard, dialog, session, shell } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { KAWDLY_CONFIG_ARGV_PREFIX, type DesktopConfig } from './desktop-config';
import {
  MigrationFailedError,
  type AdminCredentials,
  ensureAppKey,
  ensureUserDataTree,
  initializeUserData,
  isFirstRun,
  migrateIfNeeded,
} from './first-run';
import { assertPaths, resolvePaths } from './paths';
import { spawnPhp, type PhpProcessHandle } from './php-process';
import { pickFreePort } from './port';
import { BackendNotReadyError, waitForBackend } from './readiness';
import { SPLASH_STATUS_ELEMENT_ID, splashHtml, toDataUrl } from './ui-html';
import { maybeNotifyUpdate } from './update-check';

const BIND_HOST = '127.0.0.1';

/**
 * Preferred ports, tried in order before falling back to an OS-assigned one.
 *
 * 8790-8793 is a deliberately boring block: it avoids 8000 (an unrelated ERP owns
 * it on the dev machine), 8100 (local Laravel), 8890 (the PHP runtime spike) and
 * 8200-8202 (the T2 test servers). Four entries mean up to four copies of the app
 * get a recognisable URL before anyone has to read an ephemeral port number.
 */
const PREFERRED_PORTS = [8790, 8791, 8792, 8793];

/** ~20s total. The first request pays Laravel's cold boot on a cold filesystem. */
const READINESS_MAX_ATTEMPTS = 80;
const READINESS_INTERVAL_MS = 250;

/** Where the SPA lives, relative to the backend's document root. */
const SPA_PATH = '/app/';

let splashWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;
let php: PhpProcessHandle | null = null;
let isQuitting = false;

/** Set once the backend port is known; the security guards read it. */
let backendOrigin: string | null = null;

// ─── version ──────────────────────────────────────────────────────────────────

/**
 * The application's own version — NOT `app.getVersion()` on its own.
 *
 * Electron resolves `getVersion()` from the package.json it finds at the app
 * path. Launched as `electron electron/dist/main.js` the app path is that `dist`
 * directory, which has no package.json, so Electron silently answers with its
 * OWN version: the splash read "v44.9.0" and `__KAWDLY_CONFIG__.appVersion` said
 * "44.9.0". Silent, plausible, and wrong — exactly the kind of value that ends up
 * in a bug report six months from now.
 *
 * Packaged, the app path IS the asar root that holds the real package.json, so
 * `getVersion()` is correct there and is used directly.
 */
function resolveAppVersion(): string {
  if (app.isPackaged) {
    return app.getVersion();
  }

  try {
    const pkgPath = path.resolve(__dirname, '..', '..', 'package.json');
    const parsed = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: unknown };
    if (typeof parsed.version === 'string' && parsed.version !== '') {
      return parsed.version;
    }
  } catch {
    // Fall through — a missing or malformed manifest must not block startup.
  }

  return app.getVersion();
}

// ─── splash ───────────────────────────────────────────────────────────────────

function createSplash(): BrowserWindow {
  const window = new BrowserWindow({
    width: 420,
    height: 260,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    backgroundColor: '#0b1220',
    show: true,
    webPreferences: {
      // The splash is a `data:` document with no scripts of its own. It gets NO
      // preload and NO config: it must not be able to reach anything.
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      devTools: false,
    },
  });

  void window.loadURL(toDataUrl(splashHtml(resolveAppVersion(), 'جاري التشغيل…')));

  window.on('closed', () => {
    splashWindow = null;
  });

  return window;
}

/**
 * Pushes a status line into the splash.
 *
 * `executeJavaScript` rather than IPC on purpose: an IPC channel is renderer →
 * main attack surface, and this direction of traffic needs none (3.7 keeps the
 * bridge at zero methods). The value is passed through `JSON.stringify`, so the
 * Arabic text and any interpolated numbers cannot break out of the string
 * literal, and it is assigned to `textContent`, never `innerHTML`.
 */
function setSplashStatus(text: string): void {
  if (splashWindow === null || splashWindow.isDestroyed()) {
    return;
  }

  const js = `(() => { const el = document.getElementById(${JSON.stringify(
    SPLASH_STATUS_ELEMENT_ID,
  )}); if (el) { el.textContent = ${JSON.stringify(text)}; } })();`;

  splashWindow.webContents.executeJavaScript(js, true).catch(() => {
    // The splash may be closing exactly as a progress tick arrives. Losing a
    // status line is never worth failing startup over.
  });
}

// ─── security ─────────────────────────────────────────────────────────────────

/**
 * Content-Security-Policy injected into the SPA document.
 *
 * Why inject it from here instead of sending it from Laravel: the policy has to
 * name the backend origin, and the port is only known at runtime (see
 * `PREFERRED_PORTS`). Injecting in the main process also means the renderer is
 * covered even if a response somehow bypasses the application middleware.
 *
 * Notes on individual directives:
 *  - `style-src 'unsafe-inline'`: required, not laziness. Tailwind's output is a
 *    static stylesheet, but React inline `style={{…}}` props and Radix UI's
 *    positioning (Popover/Dropdown/Tooltip write `style` attributes) are inline
 *    styles. Removing it would need nonces threaded through every portal.
 *  - `script-src 'self'`: no `'unsafe-inline'`, no `'unsafe-eval'`. The Vite
 *    production bundle needs neither (its modulepreload polyfill is bundled, not
 *    inlined), which is the whole reason T3 tests against the built SPA.
 *  - `connect-src` lists the origin explicitly as well as `'self'` so the policy
 *    stays correct if a future absolute `apiBaseUrl` is ever used.
 *  - `object-src`/`base-uri`/`frame-ancestors`/`form-action` are hardening beyond
 *    the specified baseline: no plugins, no `<base>` hijack of relative URLs, no
 *    embedding, and form posts confined to our own origin.
 */
function buildCsp(origin: string): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    `connect-src 'self' ${origin}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ');
}

/**
 * Installs the session-wide guards. Called once, after the port is known.
 *
 * The header filter is scoped to the backend origin so that the splash's `data:`
 * document is untouched, and the injection itself is scoped to `mainFrame`
 * responses so it cannot overwrite the deliberately stricter per-file CSP that
 * `/storage/{path}` emits (`default-src 'none'; … sandbox`, T2).
 */
function installSecurityGuards(origin: string): void {
  /**
   * A silently-inactive security control is worse than none, because it is
   * invisible in exactly the audit that is supposed to find it: a filter that
   * never matches, or a response that is not classified as `mainFrame`, would
   * leave the renderer with no policy at all and nothing in any log. One line on
   * first injection makes "is the CSP live?" answerable from the startup log.
   */
  let announced = false;

  session.defaultSession.webRequest.onHeadersReceived(
    { urls: [`${origin}/*`] },
    (details, callback) => {
      if (details.resourceType !== 'mainFrame') {
        callback({});
        return;
      }

      if (!announced) {
        announced = true;
        console.log(`[security] CSP injected into main-frame response: ${details.url}`);
      }

      const headers = { ...details.responseHeaders };

      // Case-insensitive strip: a header we do not remove would coexist with ours
      // and the browser enforces the INTERSECTION, which makes debugging a
      // blocked resource genuinely confusing.
      for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === 'content-security-policy') {
          delete headers[key];
        }
      }

      headers['Content-Security-Policy'] = [buildCsp(origin)];
      callback({ responseHeaders: headers });
    },
  );

  // Nothing in this app needs geolocation, a camera, notifications or a
  // clipboard read. Deny everything rather than enumerate.
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(false);
  });
}

/**
 * Per-window navigation guards.
 *
 * `will-navigate` keeps the window pinned to the backend origin: a renderer that
 * somehow sets `location.href` to a remote page would otherwise run that page
 * with this window's privileges.
 *
 * `setWindowOpenHandler` DENIES everything, rather than the "open externally"
 * alternative. Justification: the SPA has no `target="_blank"` flow in E2, so
 * every `window.open` reaching this handler is by definition unexpected — and
 * handing an unexpected, renderer-supplied URL to `shell.openExternal` is how a
 * single XSS turns into arbitrary local program execution via a `file:` or
 * protocol-handler URL. If a legitimate external link appears later, it gets an
 * explicit allowlist, not a blanket pass.
 */
function installWindowGuards(window: BrowserWindow, origin: string): void {
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${origin}/`)) {
      event.preventDefault();
      console.warn(`[security] blocked navigation to ${url}`);
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    console.warn(`[security] blocked window.open to ${url}`);
    return { action: 'deny' };
  });

  // A sandboxed renderer should never attach a webview; refuse if it tries.
  window.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
}

// ─── main window ──────────────────────────────────────────────────────────────

function createMainWindow(port: number, origin: string): BrowserWindow {
  const config: DesktopConfig = {
    mode: 'desktop',
    appVersion: resolveAppVersion(),
    platform: process.platform,
    apiBaseUrl: '/api/v1',
  };

  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#0b1220',
    // Created hidden: shown only on 'ready-to-show', so the splash is never
    // replaced by an empty white rectangle.
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      additionalArguments: [KAWDLY_CONFIG_ARGV_PREFIX + JSON.stringify(config)],
      // Security posture — Electron-Packaging-Design.md §4.6 / E2 plan §8.
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webviewTag: false,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });

  installWindowGuards(window, origin);

  /**
   * Forwards renderer console output to the main process log in development.
   *
   * Not a convenience: a Content-Security-Policy violation is reported ONLY to
   * the renderer console, so without this the single most likely silent failure
   * of this whole task (a blocked stylesheet, font or image) is invisible unless
   * a human happens to have DevTools open. Having it on stdout makes the "zero
   * CSP violations" check scriptable instead of manual.
   *
   * One-way, main ← renderer, over an Electron-provided event — this adds no IPC
   * channel and exposes nothing to the renderer.
   */
  if (!app.isPackaged) {
    window.webContents.on('console-message', (event) => {
      const where = event.lineNumber === 0 ? '' : ` (${event.sourceId}:${String(event.lineNumber)})`;
      console.log(`[renderer:${event.level}] ${event.message}${where}`);
    });
  }

  window.once('ready-to-show', () => {
    window.show();
    splashWindow?.close();
  });

  window.on('closed', () => {
    mainWindow = null;
  });

  void window.loadURL(`http://${BIND_HOST}:${String(port)}${SPA_PATH}`);

  return window;
}

// ─── first-run credentials ────────────────────────────────────────────────────

/**
 * Shows the generated admin password, once, and does not return until the user
 * has acknowledged it.
 *
 * Modal and blocking by design. This is the only moment the password exists
 * anywhere the user will look — `first-run.ts` writes it to a file and then
 * forgets it, and the database only has the bcrypt hash — so the app must not
 * get as far as a login screen the user cannot pass. Because
 * `initializeUserData` awaits this before writing the install marker, closing
 * the dialog without answering leaves the profile unfinished and shows it
 * again on the next launch rather than stranding the user.
 *
 * The copy button re-opens the dialog rather than dismissing it: on Windows
 * `showMessageBox` resolves as soon as any button is pressed, so a single
 * "copy" press would otherwise close the only copy of the password. Looping
 * means "copy" and "I saved it" are genuinely separate actions.
 *
 * Attached to the splash as parent while it exists, so the dialog cannot
 * appear behind it.
 */
async function showCredentialsDialog(credentials: AdminCredentials): Promise<void> {
  const detail = [
    `الإيميل: ${credentials.email}`,
    `كلمة المرور: ${credentials.password}`,
    '',
    'هتظهر مرة واحدة بس. الملف محفوظ في:',
    credentials.credentialsPath,
    '',
    'تقدر تغيّر كلمة المرور من Settings بعد أول دخول.',
  ].join('\n');

  const options = {
    type: 'warning' as const,
    title: 'بيانات الدخول',
    message: 'احتفظ ببيانات الدخول دي',
    detail,
    buttons: ['نسخ كلمة المرور', 'حفظت — متابعة'],
    defaultId: 1,
    // Esc and the window close button both mean "I am done reading", not
    // "copy": landing on the copy branch would reopen the dialog forever.
    cancelId: 1,
    noLink: true,
  };

  const parent = splashWindow !== null && !splashWindow.isDestroyed() ? splashWindow : null;
  const ask = async (): Promise<number> => {
    const result =
      parent === null
        ? await dialog.showMessageBox(options)
        : await dialog.showMessageBox(parent, options);

    return result.response;
  };

  let response = await ask();
  while (response === 0) {
    clipboard.writeText(credentials.password);
    response = await ask();
  }
}

// ─── failure path ─────────────────────────────────────────────────────────────

/**
 * Terminal startup failure.
 *
 * A native `dialog` rather than an HTML error window with buttons: a button in a
 * renderer needs an IPC channel to act, and the desktop shell's contract is zero
 * IPC (3.7/3.8). A native dialog gets the same two actions — "open the log
 * folder" and "quit" — with no new attack surface. Whichever session introduces
 * crash supervision needs a renderer→main channel anyway and can upgrade this to
 * a real window then.
 *
 * The three failure classes get three different bodies on purpose, because the
 * user-visible symptom is identical (the app does not open) while the fix is
 * completely different: a broken install needs a reinstall, a failed migration
 * needs the log, and a readiness timeout needs the PHP capture files.
 */
async function reportFatal(error: unknown, logDir: string | null): Promise<void> {
  splashWindow?.close();

  const isMigration = error instanceof MigrationFailedError;

  const detail = [
    error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    error instanceof BackendNotReadyError
      ? [
          '',
          `Stage: ${error.stage}`,
          `Attempts: ${String(error.attempts)}`,
          `Last HTTP status: ${error.lastStatus === null ? '(no response)' : String(error.lastStatus)}`,
          '',
          'Last response body / error:',
          error.lastBody.slice(0, 1_200),
        ].join('\n')
      : '',
    /**
     * The TAIL of the migration output, not the head. `artisan migrate` prints
     * one line per migration, so a failure after 90 successful migrations would
     * push the actual SQL error off the end of any head-truncated excerpt.
     */
    error instanceof MigrationFailedError
      ? [
          '',
          `Exit code: ${error.exitCode === null ? '(killed / never started)' : String(error.exitCode)}`,
          '',
          'Last output from artisan migrate:',
          error.output.trim().slice(-1_600),
          '',
          'A copy of the full output is in logs/migrate.log. Your database was ' +
            'backed up to the backups folder before the upgrade ran.',
        ].join('\n')
      : '',
    php === null ? '' : `\nCommand line:\n${php.commandLine}`,
  ]
    .filter((part) => part !== '')
    .join('\n');

  const buttons = logDir === null ? ['إغلاق'] : ['فتح مجلد السجلات', 'إغلاق'];

  const { response } = await dialog.showMessageBox({
    type: 'error',
    title: 'Kawdly People — فشل التشغيل',
    message: isMigration ? 'تعذّر تحديث قاعدة البيانات.' : 'تعذّر تشغيل الخدمة الخلفية.',
    detail,
    buttons,
    defaultId: 0,
    cancelId: buttons.length - 1,
    noLink: true,
  });

  if (logDir !== null && response === 0) {
    // openPath, not openExternal: a filesystem path must never be routed through
    // the protocol handler.
    await shell.openPath(logDir);
  }

  app.quit();
}

// ─── startup ──────────────────────────────────────────────────────────────────

async function startup(): Promise<void> {
  let logDir: string | null = null;

  try {
    const paths = resolvePaths();
    logDir = path.join(paths.userDataPath, 'logs');

    /**
     * Before anything that can fail, and deliberately duplicated with the call
     * inside the bootstrap below: `reportFatal` offers "open the log folder",
     * and `shell.openPath` on a directory that does not exist silently does
     * nothing. Creating the tree first means the error dialog is useful even
     * when the failure happened before provisioning started.
     */
    ensureUserDataTree(paths.userDataPath);

    splashWindow = createSplash();

    /**
     * Fail on a broken INSTALL before touching the user's profile. Without
     * this, a missing php.exe or an unstaged backend would instead surface 20
     * seconds later as a readiness timeout, and a missing document root would
     * surface as a blank window — both of which read as application bugs
     * rather than "this build is incomplete". See paths.ts.
     */
    assertPaths(paths);

    const appVersion = resolveAppVersion();

    /**
     * Provisioning, and the one branch in startup that can run for minutes.
     *
     * First run builds the profile from scratch (tree, generated APP_KEY,
     * database from the shipped template, `migrate --force`). Every later
     * launch takes `migrateIfNeeded`, which also runs `migrate --force` — on
     * every launch, not only on a version change. Laravel skips applied
     * migrations in ~2s, and the version gate it replaces silently skipped new
     * migrations when a build was rebuilt without a version bump (2026-10-26).
     *
     * Both run in dev too. The old DEV-ONLY shortcuts meant the code users
     * depend on most was the code tested least.
     */
    if (isFirstRun(paths.userDataPath)) {
      setSplashStatus('جاري تجهيز التطبيق لأول مرة…');
      await initializeUserData({
        paths,
        appVersion,
        onProgress: setSplashStatus,
        onCredentials: showCredentialsDialog,
      });
    } else {
      await migrateIfNeeded({ paths, appVersion, onProgress: setSplashStatus });
    }

    // After provisioning: on a first run the key is generated in there, and
    // reading it back is how this function stays a pure lookup.
    const appKey = ensureAppKey(paths.userDataPath);

    setSplashStatus('جاري اختيار منفذ…');
    const port = await pickFreePort(PREFERRED_PORTS);
    const origin = `http://${BIND_HOST}:${String(port)}`;
    backendOrigin = origin;

    installSecurityGuards(origin);

    setSplashStatus('جاري تشغيل الخدمة الخلفية…');
    php = spawnPhp({
      port,
      userDataPath: paths.userDataPath,
      backendPath: paths.backendPath,
      phpBinaryPath: paths.phpBinaryPath,
      routerScriptPath: paths.routerScriptPath,
      appKey,
    });

    /**
     * Diagnostics only — crash supervision and restart are a later session.
     * Without this listener an early exit (a bad `-d` flag, a missing DLL)
     * would surface only as a readiness timeout, hiding the actual exit code.
     */
    php.child.once('exit', (code, signal) => {
      console.error(
        `[php] exited early: code=${String(code)} signal=${String(signal)}. ` +
          'No supervision/restart yet — the app will not recover on its own.',
      );
    });

    await waitForBackend(port, {
      maxAttempts: READINESS_MAX_ATTEMPTS,
      intervalMs: READINESS_INTERVAL_MS,
      onProgress: (attempt, maxAttempts) => {
        setSplashStatus(`جاري انتظار الخدمة… (${String(attempt)}/${String(maxAttempts)})`);
      },
    });

    setSplashStatus('جاري تحميل الواجهة…');
    mainWindow = createMainWindow(port, origin);

    /**
     * Last, after the window is actually on screen, and NOT awaited.
     *
     * Registered after the listener inside `createMainWindow`, so it runs once
     * the splash is gone and there is a real window to sit in front of. A
     * rejection here is swallowed on purpose — `maybeNotifyUpdate` already
     * logs every failure path, and an update check is never a reason to reach
     * `reportFatal` and quit the app.
     */
    mainWindow.once('ready-to-show', () => {
      void maybeNotifyUpdate({
        currentVersion: appVersion,
        userDataPath: paths.userDataPath,
      }).catch((error: unknown) => {
        console.warn(`[update] check failed: ${String(error)}`);
      });
    });
  } catch (error) {
    await reportFatal(error, logDir);
  }
}

// ─── app lifecycle ────────────────────────────────────────────────────────────

/**
 * Pinned before any `getPath` call. Electron derives `userData` from the app name
 * (package.json `name` in dev, `productName` once packaged), so leaving it
 * implicit would move the database and the logs between a dev run and a packaged
 * run — and the whole point of userData is that it survives both.
 */
app.setName('kawdly-people');
app.setPath('userData', path.join(app.getPath('appData'), 'kawdly-people'));

// Must be called before the app is ready. Forces the sandbox on every renderer.
app.enableSandbox();

/**
 * Single instance. Two copies would pick different ports and open two SQLite
 * write handles against the same file — SQLite survives that, but the app's own
 * cache and session tables would interleave in ways no one wants to debug.
 */
if (!app.requestSingleInstanceLock()) {
  // Exit immediately and silently: the running instance gets 'second-instance'
  // and raises its own window, which is the behaviour a user expects from
  // double-clicking the icon again.
  app.exit(0);
} else {
  app.on('second-instance', () => {
    const existing = mainWindow ?? splashWindow;
    if (existing !== null && !existing.isDestroyed()) {
      if (existing.isMinimized()) {
        existing.restore();
      }
      existing.focus();
    }
  });

  /**
   * Belt and braces against a renderer that somehow escapes `will-navigate`:
   * this fires for every webContents in the app, including ones created by code
   * added later that forgets to install the per-window guards.
   */
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event, url) => {
      if (backendOrigin !== null && !url.startsWith(`${backendOrigin}/`)) {
        event.preventDefault();
      }
    });
  });

  void app.whenReady().then(startup);

  app.on('window-all-closed', () => {
    // No macOS exception: this app is a Windows desktop shell around a local
    // server. Keeping the process alive with no window would keep PHP alive too.
    app.quit();
  });

  /**
   * The PHP child must die before the app does, and killing a process tree is
   * asynchronous, so quitting is deferred for exactly one round trip.
   *
   * `isQuitting` is what makes this terminate: `app.exit(0)` does not re-emit
   * 'before-quit', but `app.quit()` from elsewhere during teardown would, and
   * without the flag the handler would cancel its own quit forever.
   */
  app.on('before-quit', (event) => {
    if (isQuitting) {
      return;
    }

    isQuitting = true;

    if (php === null) {
      return;
    }

    event.preventDefault();

    void php.stop().then(
      () => app.exit(0),
      () => app.exit(0),
    );
  });
}
