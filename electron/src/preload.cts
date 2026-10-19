/**
 * Kawdly People — Electron preload.
 *
 * `.cts` on purpose: a sandboxed preload script MUST be CommonJS, and the root
 * package.json declares `"type": "module"`. A `.cts` source emits `preload.cjs`,
 * which is CommonJS by file extension alone — independent of any package.json
 * `type` field, bundler setting, or future refactor. Belt and braces, because a
 * wrong module format here fails silently inside the sandbox.
 *
 * Its whole job is to copy the main process's config onto the window. There are
 * deliberately NO `ipcRenderer` methods: backend-crash UX is owned by the main
 * process and `safeStorage` is E3 scope. Every method exposed here would be
 * callable by any script that achieves XSS in the renderer, so the surface stays
 * at zero until something genuinely needs it (E2 plan §7).
 */

import { contextBridge } from 'electron';
import type { DesktopConfig } from './desktop-config';

/**
 * ⚠️ Duplicated literal, NOT an import of KAWDLY_CONFIG_ARGV_PREFIX.
 *
 * A sandboxed preload's `require` is a polyfill that resolves only `electron` and
 * a handful of Node built-ins — it cannot load a sibling module. Importing the
 * constant as a *value* would emit `require("./desktop-config")` and the preload
 * would throw before exposing anything, with the renderer left looking like it
 * simply has no config. The type-only import above is erased at compile time and
 * emits nothing, so the shape stays checked while the string stays inline.
 *
 * If this string changes, change it in desktop-config.ts too.
 */
const CONFIG_ARGV_PREFIX = '--kawdly-config=';

/**
 * Last-resort defaults. Reached only if `additionalArguments` was lost or the JSON
 * failed to parse. `apiBaseUrl` still points at the same-origin API, so the app
 * degrades to "works, reports an unknown version" instead of "white screen".
 */
const FALLBACK: DesktopConfig = {
  mode: 'desktop',
  appVersion: '0.0.0-unknown',
  platform: process.platform,
  apiBaseUrl: '/api/v1',
};

function readConfig(): DesktopConfig {
  const entry = process.argv.find((arg) => arg.startsWith(CONFIG_ARGV_PREFIX));
  if (entry === undefined) {
    return FALLBACK;
  }

  try {
    const parsed = JSON.parse(entry.slice(CONFIG_ARGV_PREFIX.length)) as Partial<DesktopConfig>;

    return {
      mode: 'desktop',
      appVersion: parsed.appVersion ?? FALLBACK.appVersion,
      platform: parsed.platform ?? FALLBACK.platform,
      apiBaseUrl: parsed.apiBaseUrl ?? FALLBACK.apiBaseUrl,
    };
  } catch {
    return FALLBACK;
  }
}

/**
 * Frozen before exposure. `contextBridge` already passes a structural clone across
 * the isolated-world boundary, so renderer code cannot mutate what the main
 * process sees — freezing additionally stops renderer code from rewriting its own
 * copy and then confusing a later reader of `window.__KAWDLY_CONFIG__`.
 */
contextBridge.exposeInMainWorld('__KAWDLY_CONFIG__', Object.freeze(readConfig()));
