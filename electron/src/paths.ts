/**
 * Kawdly People — the one place that knows where anything lives (T5).
 *
 * Before T5 the main process resolved the backend and php.exe inline, from
 * `__dirname`, and refused to think about a packaged build (`resolveDevPaths`,
 * marked DEV-ONLY). This module replaces that with a single function whose two
 * branches are the two realities the app actually runs in.
 *
 * ---------------------------------------------------------------------------
 * Why the packaged branch cannot just be "the same paths, shifted"
 * ---------------------------------------------------------------------------
 * In a packaged Electron app the JavaScript lives inside `app.asar`, a virtual
 * filesystem that only Electron's patched `fs` can read. `php.exe` is a
 * separate OS process with an ordinary `fs`, so every path it touches — the
 * binary itself, the Laravel tree it serves, the router script handed to
 * `php -S` — must be a REAL file. electron-builder puts those under
 * `process.resourcesPath` via `extraResources` (see electron-builder.yml).
 *
 * Getting this wrong does not produce a clean crash. php.exe would start,
 * fail to open the document root, and answer every request with a 404 or a
 * blank 200 — which looks exactly like a frontend bug. Hence `assertPaths()`.
 *
 * ---------------------------------------------------------------------------
 * The layouts
 * ---------------------------------------------------------------------------
 * Dev (`__dirname` = <repo>/frontend/electron/dist):
 *     <repo>/backend/                              backend
 *     <repo>/php-runtime-spike/php.exe             binary (E1 spike artifact)
 *     <repo>/frontend/electron/resources/…php      router
 *
 * Packaged (`process.resourcesPath` = <install>/resources):
 *     <install>/resources/backend/                 pruned, composer --no-dev
 *     <install>/resources/php/php.exe
 *     <install>/resources/resources/…php           router
 *
 * The doubled `resources` segment is not a typo — `extraResources.to` is
 * relative to the resources directory, and the entry is written as
 * `to: resources/desktop-server.php`. The comment in electron-builder.yml is
 * the other half of this pair; change one and you must change both.
 */

import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface RuntimePaths {
  /** Laravel project root — the directory containing `public/` and `vendor/`. */
  readonly backendPath: string;
  /** The bundled PHP CLI binary that serves the backend. */
  readonly phpBinaryPath: string;
  /** Our `desktop-server.php`, always OUTSIDE the document root. */
  readonly routerScriptPath: string;
  /** Per-user writable root. Pinned by `app.setPath` before this is called. */
  readonly userDataPath: string;
  /** Seeded SQLite template copied into userData on first run. */
  readonly templateDbPath: string;
  /** True when running from an installed build rather than the repo. */
  readonly isPackaged: boolean;
}

/**
 * Resolves every runtime path for the current mode.
 *
 * Must be called after `app` is ready enough for `getPath('userData')`, i.e.
 * after the `app.setPath` pin in main.ts.
 */
export function resolvePaths(): RuntimePaths {
  const userDataPath = app.getPath('userData');

  if (app.isPackaged) {
    const resources = process.resourcesPath;
    const backendPath = path.join(resources, 'backend');

    return {
      backendPath,
      phpBinaryPath: path.join(resources, 'php', 'php.exe'),
      routerScriptPath: path.join(resources, 'resources', 'desktop-server.php'),
      userDataPath,
      templateDbPath: path.join(backendPath, 'database', 'seed-template.sqlite'),
      isPackaged: true,
    };
  }

  // `__dirname` is <repo>/frontend/electron/dist — tsc emits there, and the
  // electron/tsconfig.json pins "module": "CommonJS", so `import.meta` is a
  // compile error here rather than a style choice.
  const frontendRoot = path.resolve(__dirname, '..', '..');
  const projectRoot = path.resolve(frontendRoot, '..');
  const backendPath = path.join(projectRoot, 'backend');

  /**
   * Dev prefers the same `seed-template.sqlite` the installer ships, and falls
   * back to the developer's live `database.sqlite` only if the staging step has
   * never run. Preferring the template means the first-run path exercised in
   * dev is the one users actually get, instead of a code path that only ever
   * executes on a stranger's machine.
   */
  const stagedTemplate = path.join(
    frontendRoot,
    'release-staging',
    'backend',
    'database',
    'seed-template.sqlite',
  );
  const devTemplate = fs.existsSync(stagedTemplate)
    ? stagedTemplate
    : path.join(backendPath, 'database', 'database.sqlite');

  return {
    backendPath,
    phpBinaryPath: path.join(projectRoot, 'php-runtime-spike', 'php.exe'),
    routerScriptPath: path.join(frontendRoot, 'electron', 'resources', 'desktop-server.php'),
    userDataPath,
    templateDbPath: devTemplate,
    isPackaged: false,
  };
}

/**
 * Fails loudly if a shipped path is missing.
 *
 * This is the check that converts "the installer was built wrong" from a
 * mystery into a sentence. Each of these is a separate, realistic packaging
 * mistake:
 *
 *   php.exe              an `extraResources` glob that matched nothing
 *   public/index.php     the backend staged before `composer install` ran
 *   vendor/autoload.php  the staging tree copied with vendor/ still excluded
 *   public/app/index.html  the SPA never built, or built without --base=/app/
 *   desktop-server.php   the `to:` path and paths.ts drifted apart (F14 returns)
 *
 * The template DB is checked separately by first-run.ts, because a missing
 * template is recoverable (migrate from empty) while these are not.
 */
export function assertPaths(paths: RuntimePaths): void {
  const required: ReadonlyArray<readonly [string, string]> = [
    [paths.phpBinaryPath, 'bundled PHP binary'],
    [path.join(paths.backendPath, 'public', 'index.php'), 'Laravel front controller'],
    [path.join(paths.backendPath, 'vendor', 'autoload.php'), 'Composer autoloader'],
    [path.join(paths.backendPath, 'public', 'app', 'index.html'), 'built SPA'],
    [paths.routerScriptPath, 'PHP router script (desktop-server.php)'],
  ];

  const missing = required
    .filter(([candidate]) => !fs.existsSync(candidate))
    .map(([candidate, label]) => `  - ${label}: ${candidate}`);

  if (missing.length > 0) {
    throw new Error(
      `${paths.isPackaged ? 'Packaged' : 'Development'} installation is incomplete. ` +
        `Missing ${String(missing.length)} required path(s):\n${missing.join('\n')}\n\n` +
        (paths.isPackaged
          ? 'This build is broken — reinstall from a fresh installer.'
          : 'Run `npm run electron:build` (and `npm run stage:backend` if you are ' +
            'testing the packaged layout).'),
    );
  }
}
