#!/usr/bin/env node
/**
 * First-run environment check.
 *
 * Wired as `predev` (with --create) and `prebuild` (without). The two modes
 * differ deliberately:
 *
 *   --create   `.env.local` is created from `.env.example` when missing. This is
 *              the dev convenience: clone, `npm install`, `npm run dev`, done.
 *
 *   default    validate only. A production build must NEVER have its
 *              configuration invented for it — writing a `.env.local` during
 *              `prebuild` would inject VITE_API_BASE_URL into a release
 *              artifact, which is a change to production build behaviour rather
 *              than a developer convenience.
 *
 * ── Why this script exists at all ─────────────────────────────────────────────
 * Missing configuration fails in opposite directions depending on the build,
 * and the dev direction is the dangerous one:
 *
 *   - `npm run dev` with no VITE_API_BASE_URL → src/config/env.ts falls back to
 *     the in-process mock API. The app starts, every screen renders, and all the
 *     numbers are fabricated. Nothing warns you. A fresh clone therefore *looks*
 *     correct while showing invented data.
 *   - a production web build → env.ts throws at startup with an explicit,
 *     actionable message. Loud, and already handled.
 *
 * So the value here is catching the silent case. The build-mode check is just an
 * earlier, clearer version of a failure that would otherwise surface in a
 * browser console.
 *
 * ── Why build mode does not hard-fail on a missing file ───────────────────────
 * `VITE_API_BASE_URL` can legitimately arrive from the environment in CI rather
 * than from a file, so process.env is accepted as a source. And the desktop
 * build (`build:desktop`, a different npm script with its own hook namespace)
 * genuinely needs no build-time value at all: electron/src/desktop-config.ts
 * injects `__KAWDLY_CONFIG__`, which src/config/env.ts prefers over the Vite
 * variable. Requiring the variable for every build would break packaging.
 */

import fs from 'node:fs';
import path from 'node:path';

const REQUIRED = ['VITE_API_BASE_URL'];

// npm runs lifecycle scripts with cwd set to the package root, so this resolves
// correctly on Windows and POSIX alike without touching import.meta.url.
const root = process.cwd();
const envPath = path.join(root, '.env.local');
const examplePath = path.join(root, '.env.example');

const create = process.argv.includes('--create');
const label = create ? 'dev' : 'build';

/** True when `key` is assigned a non-empty value on its own line. */
function hasKey(contents, key) {
  const line = new RegExp(`^[ \\t]*${key}[ \\t]*=[ \\t]*(.*)$`, 'm');
  const match = line.exec(contents);

  return match !== null && match[1].trim() !== '';
}

function fail(message) {
  console.error(`\n  x  env check (${label}) failed\n\n${message}\n`);
  process.exit(1);
}

let contents = '';

if (fs.existsSync(envPath)) {
  contents = fs.readFileSync(envPath, 'utf8');
} else if (create) {
  if (!fs.existsSync(examplePath)) {
    fail(
      `     .env.local is missing, and .env.example is not there to copy from.\n\n` +
        `     Create .env.local with at least:\n\n` +
        `       VITE_API_BASE_URL=/api/v1\n\n` +
        `     and start the backend with:  php artisan serve --port=8100`,
    );
  }

  fs.copyFileSync(examplePath, envPath);
  contents = fs.readFileSync(envPath, 'utf8');
  console.log('  >  created .env.local from .env.example (first-time setup)');
} else {
  // Build mode, no file. The environment may still carry the value.
  contents = '';
}

const missing = REQUIRED.filter(
  (key) => !hasKey(contents, key) && !process.env[key],
);

if (missing.length > 0) {
  if (create) {
    fail(
      `     .env.local has no value for: ${missing.join(', ')}\n\n` +
        `     Copy the key from .env.example, or add:\n\n` +
        `       VITE_API_BASE_URL=/api/v1`,
    );
  }

  // Build mode. Not fatal: see the note at the top of this file about the
  // desktop build, which supplies its base URL at runtime instead.
  console.warn(
    `  !  ${missing.join(', ')} is not set for this build.\n` +
      `     A production web build will throw at startup rather than show mock\n` +
      `     data (src/config/env.ts). This is expected for the desktop build,\n` +
      `     which injects __KAWDLY_CONFIG__ at runtime — ignore it there.`,
  );
  process.exit(0);
}

console.log(`  >  env check (${label}) passed`);
