/**
 * Kawdly People — Electron preload.
 *
 * T1 SCAFFOLDING ONLY: exposes an empty, frozen config object and nothing else.
 *
 * `.cts` on purpose: a sandboxed preload script MUST be CommonJS, and the root
 * package.json declares `"type": "module"`. A `.cts` source emits `preload.cjs`,
 * which is CommonJS by file extension alone — independent of any package.json
 * `type` field, bundler setting, or future refactor. Belt and braces, because a
 * wrong module format here fails silently inside the sandbox.
 *
 * T7 fills the object in (apiBaseUrl / appVersion / platform / mode / isPackaged),
 * read from `process.argv` via `additionalArguments` so it stays synchronous and
 * sandbox-compatible. There are deliberately NO ipcRenderer methods in E2:
 * backend-crash UX is owned by the main process, and safeStorage is E3 scope.
 * See E2-Implementation-Plan.md §7.
 */

import { contextBridge } from 'electron';

/** Shape is defined in T7 (electron/shared/config.ts, shared with src/config/env.ts). */
const desktopConfig = Object.freeze({});

contextBridge.exposeInMainWorld('__KAWDLY_CONFIG__', desktopConfig);
