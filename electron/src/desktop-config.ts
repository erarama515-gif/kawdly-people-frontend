/**
 * Kawdly People — the contract between the Electron main process and the renderer.
 *
 * The config is handed over as a single `process.argv` entry via
 * `webPreferences.additionalArguments`, and the preload copies it onto
 * `window.__KAWDLY_CONFIG__`. Why argv and not IPC:
 *
 *  - It is SYNCHRONOUS. `src/config/env.ts` reads the API base URL at module
 *    evaluation time, before React mounts. An async IPC round-trip would mean the
 *    first HTTP client created during module init had no base URL.
 *  - It works in a SANDBOXED preload. A sandboxed preload cannot read files and
 *    cannot `require` a local module (its `require` is a polyfill limited to
 *    `electron` and a few Node built-ins), so the value has to arrive in-band.
 *  - It adds no IPC channel, and therefore no new attack surface from the
 *    renderer towards the main process.
 *
 * ⚠️ `KAWDLY_CONFIG_ARGV_PREFIX` is duplicated as a literal inside preload.cts.
 * That is deliberate and must stay that way: see the note there. Only the TYPE is
 * shared, via `import type`, which TypeScript erases completely so no runtime
 * `require` is emitted into the preload bundle.
 */

/** Prefix of the single argv entry carrying the JSON config. */
export const KAWDLY_CONFIG_ARGV_PREFIX = '--kawdly-config=';

/**
 * Exactly what the renderer is allowed to know. No paths, no port, no pid — the
 * renderer talks to its own origin and has no business knowing where things live
 * on disk. `apiBaseUrl` is relative on purpose: the SPA is served same-origin by
 * the same Laravel instance that answers the API, so a relative base is both
 * correct and immune to the port changing between runs.
 */
export interface DesktopConfig {
  readonly mode: 'desktop';
  readonly appVersion: string;
  readonly platform: string;
  readonly apiBaseUrl: string;
}
