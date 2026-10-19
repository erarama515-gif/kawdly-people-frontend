/**
 * Locates the PHP router script that fixes the deep-link 404 (F14).
 *
 * Kept in its own module rather than inlined in php-process.ts because dev and
 * packaged builds resolve it from different places, and T5 has to change exactly
 * one of those branches.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Absolute path to `desktop-server.php`.
 *
 * Dev: `__dirname` is `<repo>/frontend/electron/dist` (tsc emits there), so the
 * sibling `resources/` directory is one level up. `__dirname` is used rather
 * than `import.meta.url` because this project emits CommonJS — electron/
 * tsconfig.json pins `"module": "CommonJS"` and electron/package.json declares
 * `"type": "commonjs"` so the preload can run sandboxed. `import.meta` is a
 * compile error under that setting, not a style preference.
 *
 * Packaged (T5): the file must sit OUTSIDE the asar — php.exe is a separate
 * process and cannot read through Electron's virtual filesystem. It will be
 * shipped via electron-builder `extraResources` and resolved from
 * `process.resourcesPath`. That branch is deliberately absent until T5 adds the
 * build config, so it cannot silently point at a path nothing produces yet.
 */
export function resolveRouterScript(): string {
  return path.resolve(__dirname, '..', 'resources', 'desktop-server.php');
}

/**
 * Same path, but fails loudly if the file is missing.
 *
 * Worth the extra call: php -S treats an unreadable router argument as a plain
 * startup error on stderr, then keeps listening and serves every request through
 * its default handler. The app would boot, the window would open, and the only
 * symptom would be deep links 404-ing again — i.e. exactly the bug this task
 * exists to fix, silently reintroduced. Checking here turns that into a startup
 * failure the existing error dialog can show.
 */
export function requireRouterScript(): string {
  const scriptPath = resolveRouterScript();

  if (!fs.existsSync(scriptPath)) {
    throw new Error(
      `Router script not found at ${scriptPath}. ` +
        'Expected electron/resources/desktop-server.php (dev) or the extraResources ' +
        'copy (packaged). Without it, SPA deep links return 404.',
    );
  }

  return scriptPath;
}
