/**
 * Kawdly People — Electron main process (T3).
 *
 * Startup is a strict sequence, and the order is the design:
 *
 *   single-instance lock → paths → userData tree → APP_KEY → free port
 *   → splash window → spawn PHP → readiness probe → main window → show
 *
 * The splash is created BEFORE the backend is spawned so that every later step
 * has somewhere to report progress, and so a slow PHP cold boot never looks like
 * "nothing happened". The main window is created only after the probe passes, so
 * the user can never see a half-booted Laravel.
 *
 * Deliberately NOT here (later tasks — E2 plan §13):
 *   T4  crash supervision / restart, orphan reaping across app restarts, the
 *       custom router script that fixes SPA deep links (F14)
 *   T5  production path resolution (packaged php.exe + backend outside the asar),
 *       log rotation
 *   T6  Vite dev-server mode with HMR, router `basename`
 *   T9  real first-run provisioning: generated APP_KEY, DB template, migrations
 *
 * ⚠️ Two blocks in here are explicitly marked DEV-ONLY (`resolveDevPaths` and
 * `seedDevDatabase`). They exist so T3 can be smoke-tested end to end against the
 * repo checkout, and they are gated on `!app.isPackaged` so a packaged build can
 * never silently depend on them. T5/T9 replace both.
 */

import { app, BrowserWindow, dialog, session, shell } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { KAWDLY_CONFIG_ARGV_PREFIX, type DesktopConfig } from './desktop-config';
import { spawnPhp, type PhpProcessHandle } from './php-process';
import { pickFreePort } from './port';
import { BackendNotReadyError, waitForBackend } from './readiness';
import { SPLASH_STATUS_ELEMENT_ID, splashHtml, toDataUrl } from './ui-html';

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

interface ResolvedPaths {
  readonly userDataPath: string;
  readonly backendPath: string;
  readonly phpBinaryPath: string;
}

let splashWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;
let php: PhpProcessHandle | null = null;
let isQuitting = false;

/** Set once the backend port is known; the security guards read it. */
let backendOrigin: string | null = null;

// ─── paths ────────────────────────────────────────────────────────────────────

/**
 * DEV-ONLY path resolution.
 *
 * `__dirname` is `<repo>/frontend/electron/dist`, so three levels up is the
 * workspace root that holds both `backend/` and `php-runtime-spike/`.
 *
 * TODO(T5): in a packaged build the backend and php.exe ship as unpacked
 * resources (`process.resourcesPath`), never inside the asar — PHP cannot read a
 * virtual filesystem. Until that exists, a packaged launch is refused outright
 * rather than silently pointing at paths that do not exist on a user's machine.
 */
function resolveDevPaths(): ResolvedPaths {
  const workspaceRoot = path.resolve(__dirname, '..', '..', '..');

  return {
    userDataPath: app.getPath('userData'),
    backendPath: path.join(workspaceRoot, 'backend'),
    phpBinaryPath: path.join(workspaceRoot, 'php-runtime-spike', 'php.exe'),
  };
}

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

/**
 * The per-user writable tree. Created in full up front: Laravel does not create
 * `storage/framework/views` on demand, and a missing one surfaces as a Blade
 * compile failure inside a 200 response — exactly the failure mode the readiness
 * probe exists to catch, but much easier to simply prevent.
 */
function ensureUserDataTree(userDataPath: string): void {
  const dirs = [
    'data',
    'logs',
    'backups',
    path.join('storage', 'app', 'public'),
    path.join('storage', 'app', 'private'),
    path.join('storage', 'framework', 'cache'),
    path.join('storage', 'framework', 'sessions'),
    path.join('storage', 'framework', 'views'),
    path.join('storage', 'logs'),
  ];

  for (const dir of dirs) {
    fs.mkdirSync(path.join(userDataPath, dir), { recursive: true });
  }
}

// ─── APP_KEY ──────────────────────────────────────────────────────────────────

/**
 * Resolves the Laravel application key.
 *
 * Order: explicit environment override → the cached `userData/.appkey` → (dev
 * only) the backend's own `.env`.
 *
 * The key must be STABLE across runs: it encrypts session payloads and anything
 * written through `Crypt`, so regenerating it on every launch would invalidate
 * stored data. Hence the cache file. Generating a fresh key on first run belongs
 * to T9, together with DB provisioning, because the two have to happen together.
 */
function resolveAppKey(paths: ResolvedPaths): string {
  const fromEnv = process.env['KAWDLY_APP_KEY'];
  if (fromEnv !== undefined && fromEnv !== '') {
    return fromEnv;
  }

  const keyFile = path.join(paths.userDataPath, '.appkey');
  if (fs.existsSync(keyFile)) {
    const cached = fs.readFileSync(keyFile, 'utf8').trim();
    if (cached !== '') {
      return cached;
    }
  }

  if (!app.isPackaged) {
    const key = readAppKeyFromDotEnv(path.join(paths.backendPath, '.env'));
    if (key !== null) {
      // Cache it so the dev app keeps working if the backend `.env` is rotated
      // mid-session, and so dev behaves like production (read from userData).
      fs.writeFileSync(keyFile, key, 'utf8');
      return key;
    }
  }

  throw new Error(
    'No APP_KEY available. Expected one of: the KAWDLY_APP_KEY environment ' +
      `variable, a cached key at ${keyFile}, or (in dev) an APP_KEY line in ` +
      `${path.join(paths.backendPath, '.env')}. Generating one on first run is T9.`,
  );
}

/**
 * Minimal `.env` reader — intentionally not a full dotenv parser. It needs to
 * handle exactly one key written by `artisan key:generate`, which is always a
 * bare unquoted `base64:` value, so a regex is both sufficient and auditable.
 */
function readAppKeyFromDotEnv(envPath: string): string | null {
  if (!fs.existsSync(envPath)) {
    return null;
  }

  const match = /^\s*APP_KEY\s*=\s*"?([^"\r\n]+)"?\s*$/m.exec(fs.readFileSync(envPath, 'utf8'));
  const value = match?.[1]?.trim();

  return value !== undefined && value !== '' ? value : null;
}

// ─── DEV-ONLY database seed ───────────────────────────────────────────────────

/**
 * DEV-ONLY: copies the repo's development SQLite file into userData on first run.
 *
 * T3's smoke test has to be able to log in, and the child process points
 * `DB_DATABASE` at `userData/data/database.sqlite`, which does not exist on a
 * fresh machine. Creating an empty file would be worse than useless: Laravel
 * would boot, `/api/v1/health` would fail its `SELECT 1` on a missing `cache`
 * table, and the probe would report "degraded" for a reason that has nothing to
 * do with the shell being tested.
 *
 * TODO(T9): ship a migrated-but-empty template DB as a resource, copy that, then
 * run `migrate --force` on version change. Never copy a developer's data.
 */
function seedDevDatabase(paths: ResolvedPaths): void {
  if (app.isPackaged) {
    return;
  }

  const target = path.join(paths.userDataPath, 'data', 'database.sqlite');
  if (fs.existsSync(target)) {
    return;
  }

  const source = path.join(paths.backendPath, 'database', 'database.sqlite');
  if (!fs.existsSync(source)) {
    return;
  }

  fs.copyFileSync(source, target);
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

// ─── failure path ─────────────────────────────────────────────────────────────

/**
 * Terminal startup failure.
 *
 * A native `dialog` rather than an HTML error window with buttons: a button in a
 * renderer needs an IPC channel to act, and T3's contract is zero IPC (3.7/3.8).
 * A native dialog gets the same two actions — "open the log folder" and "quit" —
 * with no new attack surface. T4, which owns crash supervision and therefore
 * needs a renderer→main channel anyway, can upgrade this to a real window.
 */
async function reportFatal(error: unknown, logDir: string | null): Promise<void> {
  splashWindow?.close();

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
    php === null ? '' : `\nCommand line:\n${php.commandLine}`,
  ]
    .filter((part) => part !== '')
    .join('\n');

  const buttons = logDir === null ? ['إغلاق'] : ['فتح مجلد السجلات', 'إغلاق'];

  const { response } = await dialog.showMessageBox({
    type: 'error',
    title: 'Kawdly People — فشل التشغيل',
    message: 'تعذّر تشغيل الخدمة الخلفية.',
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
    const paths = resolveDevPaths();
    logDir = path.join(paths.userDataPath, 'logs');

    ensureUserDataTree(paths.userDataPath);
    seedDevDatabase(paths);

    const appKey = resolveAppKey(paths);

    splashWindow = createSplash();

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
      appKey,
    });

    /**
     * Diagnostics only — restart/supervision is T4. Without this listener an
     * early exit (a bad `-d` flag, a missing DLL) would surface only as a
     * readiness timeout, hiding the actual exit code.
     */
    php.child.once('exit', (code, signal) => {
      console.error(
        `[php] exited early: code=${String(code)} signal=${String(signal)}. ` +
          'Supervision/restart is T4.',
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
