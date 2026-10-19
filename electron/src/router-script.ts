/**
 * Guard for the PHP router script that fixes the SPA deep-link 404 (F14, T4).
 *
 * ---------------------------------------------------------------------------
 * What changed in T5
 * ---------------------------------------------------------------------------
 * T4 resolved the path here, from `__dirname`, with a TODO for the packaged
 * branch. T5 moved all path resolution into `paths.ts`, so this module no
 * longer computes anything — it validates. `resolveRouterScript()` is gone on
 * purpose: two modules computing the same path is exactly how the dev branch
 * and the packaged branch drift apart.
 *
 * ---------------------------------------------------------------------------
 * Why this check exists at all
 * ---------------------------------------------------------------------------
 * `php -S` treats an unreadable router argument as a plain startup warning on
 * stderr — and then keeps listening, serving every request through its own
 * default handler. The app would boot, the window would open, login would
 * work, and the ONLY symptom would be that deep links 404 again. That is F14,
 * silently reintroduced, discovered by a user rather than by a build.
 *
 * `assertPaths()` in paths.ts checks the same file during startup. That is not
 * redundant: this check sits immediately before the path is handed to the
 * spawn, so it still fires if the spawn is ever reached by a code path that
 * skipped the startup assertions.
 */

import * as fs from 'node:fs';

/** Returns `scriptPath`, or throws if nothing readable is there. */
export function requireRouterScript(scriptPath: string): string {
  if (!fs.existsSync(scriptPath)) {
    throw new Error(
      `Router script not found at ${scriptPath}. ` +
        'Expected electron/resources/desktop-server.php (dev) or the extraResources ' +
        'copy under resourcesPath (packaged). Without it, SPA deep links return 404.',
    );
  }

  return scriptPath;
}
