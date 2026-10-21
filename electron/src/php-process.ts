/**
 * Kawdly People — spawn + supervise the bundled PHP server (T3).
 *
 * Shape of the child, and why each part is the way it is:
 *
 *   <php.exe> -d variables_order=EGPCS -S 127.0.0.1:<port> -t <backend>/public \
 *       <electron>/resources/desktop-server.php
 *   cwd = <backend>/public
 *
 * 1. cwd is `<backend>/public`, NOT the backend root (E1 finding, and the single
 *    most expensive scar on this surface). Laravel's own `artisan serve` does the
 *    same — `ServeCommand::startProcess()` passes `public_path()` as the working
 *    directory. Run it from the backend root and every static asset 404s while
 *    PHP still answers, which looks like a frontend bug.
 *
 * 2. `-t` IS passed, as an absolute path. It is redundant with cwd by design: it
 *    documents intent and survives anyone "tidying up" the cwd. It must never be
 *    the literal string `public`, which would resolve against the cwd and point
 *    PHP at `<backend>/public/public`.
 *
 * 2b. The router script is OURS (T4), not Laravel's
 *    `Illuminate/Foundation/resources/server.php`, and it deliberately lives
 *    outside the document root — `php -S` accepts any readable path for the
 *    router argument, and keeping it out of `public/` means it can never be
 *    served as a file. The stock router cannot fix the deep-link 404 because the
 *    damage ($_SERVER rewritten to point at `public/app/index.html`) is done by
 *    php -S before any router runs; see resources/desktop-server.php for the full
 *    mechanism. Swapping this back to the stock script silently reintroduces F14.
 *    Since T5 the path arrives as an option (`routerScriptPath`) rather than
 *    being computed here, because the packaged build resolves it from
 *    `process.resourcesPath` — see paths.ts and electron-builder.yml.
 *
 * 3. `-d variables_order=EGPCS` is load-bearing, not cosmetic. Laravel's `env()`
 *    reads `$_SERVER`/`$_ENV` (`Illuminate\Support\Env` → Dotenv's ServerConst and
 *    EnvConst adapters), and those superglobals only contain *environment*
 *    variables when `variables_order` includes `E`. PHP's compiled-in default is
 *    `EGPCS` and the bundled binary currently loads no php.ini at all (verified:
 *    `Loaded Configuration File => (none)`, `variables_order => EGPCS`), but
 *    `php.ini-production` ships `GPCS`. If a php.ini is ever added next to the
 *    binary, every injected variable below would silently become invisible and
 *    the app would quietly fall back to the bundled `.env`. Pinning it here makes
 *    that impossible.
 *
 * 4. The environment is an ALLOWLIST. `{ ...process.env }` is never used: the
 *    Electron process inherits the developer's shell, which on this machine
 *    contains a different `DB_DATABASE`, a different `APP_ENV` and an `APP_KEY`
 *    for another installation. Inheriting it would make the packaged app behave
 *    differently on a developer's machine than on a user's — the worst class of
 *    bug to debug remotely. See Electron-Packaging-Design.md §4.6.
 *
 * 5. Dotenv does not override. Laravel builds an *immutable* repository, so a
 *    variable already present in the real environment wins over the same key in
 *    `.env`. That is what makes this allowlist authoritative even though a `.env`
 *    file still exists next to the backend in dev.
 *
 * NOT here (later sessions): crash supervision/restart and orphan reaping across
 * app restarts, and log rotation. First-run DB provisioning and the generated
 * APP_KEY moved IN to T5 and live in first-run.ts — this module just receives
 * the key it is told to use.
 */

import { spawn, execFile, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { requireRouterScript } from './router-script';

const BIND_HOST = '127.0.0.1';

/** Grace period for a polite stop before the tree is force-killed. */
const DEFAULT_STOP_TIMEOUT_MS = 2_000;

/**
 * Windows environment variables the child genuinely needs in order to function,
 * kept separate from the application allowlist so the distinction stays obvious.
 *
 * This is the one documented widening of "allowlist only": PHP resolves the
 * system temp directory from TEMP/TMP (`sys_get_temp_dir()`, used by file uploads
 * and anything calling `tempnam()`), and Windows itself needs `SystemRoot` to
 * load system DLLs — including the Winsock stack the HTTP server depends on.
 * These carry no application configuration, so they cannot cause the
 * dev-machine-vs-user-machine divergence that rule 4 above exists to prevent.
 */
const OS_PASSTHROUGH_KEYS = ['SystemRoot', 'SYSTEMROOT', 'windir', 'TEMP', 'TMP'] as const;

export interface SpawnPhpOptions {
  /** Loopback port from `pickFreePort`. */
  port: number;
  /** Writable per-user root: `app.getPath('userData')`. */
  userDataPath: string;
  /** Backend project root (the directory containing `public/` and `vendor/`). */
  backendPath: string;
  /** Absolute path to the bundled `php.exe`. */
  phpBinaryPath: string;
  /**
   * Absolute path to `desktop-server.php`, from `resolvePaths()` (T5).
   *
   * Passed in rather than computed here: dev and packaged builds resolve it
   * from completely different roots, and `paths.ts` is the single module that
   * is allowed to know which one applies.
   */
  routerScriptPath: string;
  /** `base64:...` application key. Dev reads it from the backend `.env`; T9 generates it. */
  appKey: string;
}

export interface PhpProcessHandle {
  /** The live child. Exposed for `exitCode`/`pid` inspection and event wiring. */
  readonly child: ChildProcess;
  /** Absolute paths of the two capture files, for the "View logs" action. */
  readonly logPaths: { readonly stdout: string; readonly stderr: string };
  /** The exact argv used, for error reporting. */
  readonly commandLine: string;
  /**
   * Terminates the child and (on Windows) its process tree.
   * Idempotent, and safe to call on an already-dead child.
   */
  stop(timeoutMs?: number): Promise<void>;
}

/**
 * Builds the child environment.
 *
 * Exported for testability: asserting on this object is far cheaper than asserting
 * on a running PHP process, and it is the part most likely to regress silently.
 */
export function buildPhpEnv(opts: SpawnPhpOptions): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    APP_ENV: 'production',
    APP_DEBUG: 'false',
    APP_URL: `http://${BIND_HOST}:${opts.port}`,
    APP_KEY: opts.appKey,

    DB_CONNECTION: 'sqlite',
    DB_DATABASE: path.join(opts.userDataPath, 'data', 'database.sqlite'),

    KAWDLY_STORAGE_PATH: path.join(opts.userDataPath, 'storage'),
    // dev-reset uses this to keep data/ADMIN-CREDENTIALS.txt in sync. Outside
    // Electron the variable is absent and the backend simply skips the write.
    KAWDLY_USERDATA_PATH: opts.userDataPath,

    SESSION_DRIVER: 'database',
    CACHE_STORE: 'database',
    FILESYSTEM_DISK: 'local',

    LOG_CHANNEL: 'single',
    LOG_LEVEL: 'warning',

    /**
     * Literal empty string, and that distinction is the whole point: an absent key
     * would let `config/sanctum.php`'s own default apply, while `''` makes
     * `explode(',', '')` produce `['']`, which matches no host. Either way the
     * request can never be treated as stateful, so login cannot 419 (E2 finding
     * F1). Belt and braces with the config default — see design §4.6.
     */
    SANCTUM_STATEFUL_DOMAINS: '',

    MAIL_MAILER: 'log',
  };

  for (const key of OS_PASSTHROUGH_KEYS) {
    const value = process.env[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }

  /**
   * Founder-only dev reset escape hatch. The marker lives in per-user data,
   * outside the repository and outside the installer, so beta users never get
   * it. The backend still returns 404 when this variable is absent.
   *
   * The CLI flag exists for a source run before a first-run marker is present;
   * it is not exposed by the packaged app's shortcut.
   */
  const devModeMarker = path.join(opts.userDataPath, 'DEV_MODE');
  if (fs.existsSync(devModeMarker) || process.argv.includes('--dev-reset')) {
    env.KAWDLY_DEV_RESET = '1';
  }

  return env;
}

/** Creates `dir` and every missing parent. */
function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Starts the PHP server. Returns as soon as the process is spawned — it is NOT
 * ready to serve yet; pass the port to `waitForBackend` for that.
 */
export function spawnPhp(opts: SpawnPhpOptions): PhpProcessHandle {
  const docRoot = path.join(opts.backendPath, 'public');
  // Throws if the file is missing — see requireRouterScript() for why a missing
  // router is far worse than a missing binary: the server still starts.
  const routerScript = requireRouterScript(opts.routerScriptPath);
  const logDir = path.join(opts.userDataPath, 'logs');

  if (!fs.existsSync(opts.phpBinaryPath)) {
    throw new Error(`spawnPhp: PHP binary not found at ${opts.phpBinaryPath}`);
  }
  if (!fs.existsSync(path.join(docRoot, 'index.php'))) {
    throw new Error(
      `spawnPhp: Laravel front controller not found at ${path.join(docRoot, 'index.php')}. ` +
        'Has `composer install` run in the backend?',
    );
  }

  ensureDir(logDir);

  const stdoutLogPath = path.join(logDir, 'php-stdout.log');
  const stderrLogPath = path.join(logDir, 'php-stderr.log');

  const args = [
    '-d',
    'variables_order=EGPCS',
    '-S',
    `${BIND_HOST}:${opts.port}`,
    // Explicit document root. Redundant with cwd by design: it documents intent
    // and survives anyone "tidying up" the cwd. Absolute, never the literal
    // string "public" (which would resolve to <backend>/public/public).
    '-t',
    docRoot,
    // Our router (T4). Absolute, and intentionally outside docRoot.
    routerScript,
  ];

  const child = spawn(opts.phpBinaryPath, args, {
    cwd: docRoot,
    env: buildPhpEnv(opts),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  // Append-only capture. No rotation yet (T5) — a dev session appends a few KB.
  const stdoutLog = fs.createWriteStream(stdoutLogPath, { flags: 'a' });
  const stderrLog = fs.createWriteStream(stderrLogPath, { flags: 'a' });

  const banner = `\n[${new Date().toISOString()}] --- spawn pid=${String(child.pid)} port=${String(opts.port)} ---\n`;
  stdoutLog.write(banner);
  stderrLog.write(banner);

  child.stdout?.pipe(stdoutLog);
  child.stderr?.pipe(stderrLog);

  // Without this, a write error on the log stream (disk full, file locked by a
  // virus scanner) becomes an unhandled 'error' event and takes the app down.
  stdoutLog.on('error', () => undefined);
  stderrLog.on('error', () => undefined);

  let stopPromise: Promise<void> | null = null;

  async function stop(timeoutMs: number = DEFAULT_STOP_TIMEOUT_MS): Promise<void> {
    stopPromise ??= doStop(timeoutMs);
    return stopPromise;
  }

  async function doStop(timeoutMs: number): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }

    const exited = new Promise<void>((resolve) => {
      child.once('exit', () => resolve());
    });

    // 1. Ask politely. On Windows node maps this to TerminateProcess, which ends
    //    this process but NOT anything it started.
    child.kill();

    // 2. Give it the grace period.
    const graceful = await Promise.race([
      exited.then(() => true),
      delay(timeoutMs).then(() => false),
    ]);

    if (graceful) {
      return;
    }

    // 3. Windows: kill the tree. PHP's built-in server is single-process unless
    //    PHP_CLI_SERVER_WORKERS is set (which it is not — see the note in
    //    main.ts), so this is belt-and-braces against a wrapper or a debugger
    //    holding the pid.
    if (process.platform === 'win32' && child.pid !== undefined) {
      await taskkillTree(child.pid);
    } else if (child.pid !== undefined) {
      child.kill('SIGKILL');
    }

    // 4. Resolve once it is actually gone, but never hang the quit path.
    await Promise.race([exited, delay(timeoutMs)]);
  }

  return {
    child,
    logPaths: { stdout: stdoutLogPath, stderr: stderrLogPath },
    commandLine: [opts.phpBinaryPath, ...args].join(' '),
    stop,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** `taskkill /PID <pid> /T /F` — terminate the process and its descendants. */
function taskkillTree(pid: number): Promise<void> {
  return new Promise<void>((resolve) => {
    execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => {
      // A non-zero exit just means "already gone", which is the desired state.
      resolve();
    });
  });
}
