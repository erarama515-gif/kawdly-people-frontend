/**
 * Kawdly People — build the packaging staging tree for the backend (T5).
 *
 * Produces `frontend/release-staging/backend/`: a pruned copy of `../backend`
 * with its own production-only `vendor/`, the built SPA under `public/app/`, and
 * a seeded template database. electron-builder then ships that directory as an
 * `extraResources` entry (see electron-builder.yml).
 *
 * ---------------------------------------------------------------------------
 * Why a committed script rather than the robocopy one-liner from the plan
 * ---------------------------------------------------------------------------
 * The prune list is the security boundary of the installer: `.env` holds a real
 * APP_KEY and DB credentials, `database/database.sqlite` holds a developer's
 * data, and `.git/` holds the entire project history. A one-liner typed into a
 * shell is reviewed once and then re-typed slightly differently next release.
 * This file is diffable, and the EXCLUDE list below is the single place where
 * "what ships" is defined.
 *
 * It is also the only honest way to prove the installer contains no secrets —
 * `node scripts/stage-backend.mjs --verify` re-asserts the prune list against
 * the tree that was actually produced.
 *
 * ---------------------------------------------------------------------------
 * What is deliberately NOT copied, and why
 * ---------------------------------------------------------------------------
 *   .env                      a real APP_KEY. The packaged app injects its own
 *                             (first-run.ts) and Laravel's dotenv repository is
 *                             immutable, so a shipped .env would WIN over the
 *                             injected env and every install would share one key.
 *   database/*.sqlite         a developer's data. The seeded template is copied
 *                             separately and explicitly, under a name
 *                             (`seed-template.sqlite`) that cannot be mistaken
 *                             for the live file.
 *   storage/                  runtime-writable, and it lives in userData at run
 *                             time via KAWDLY_STORAGE_PATH (backend E1/522ba83).
 *                             Shipping it would create a second, never-read copy
 *                             inside the install directory — and if the env var
 *                             were ever lost, Laravel would silently write there
 *                             instead of failing loudly.
 *   vendor/                   rebuilt with --no-dev. The dev tree carries PHPUnit,
 *                             Pint, Sail and friends (~43 MB total).
 *   tests/, phpunit.xml       not reachable from any route.
 *   .git/                     ~0.8 MB of history, and every deleted secret in it.
 *   public/app/               copied explicitly from the fresh Vite build so a
 *                             stale SPA can never ride along unnoticed.
 *   node_modules/, Dockerfile, serve.log, the stray vite/tailwind/postcss configs
 *                             the Laravel skeleton ships — dead weight here.
 *
 * KEPT on purpose: `bootstrap/cache/*.php`. The plan called for pruning it "it
 * will be regenerated", but at run time the install directory may not be
 * writable, and Laravel's PackageManifest::build() throws when it cannot write
 * its cache. `composer install` below regenerates both files inside the staging
 * tree, so what ships is fresh AND present. They contain package names and
 * relative paths only — nothing machine-specific.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const FRONTEND_ROOT = path.resolve(import.meta.dirname, '..');
const PROJECT_ROOT = path.resolve(FRONTEND_ROOT, '..');
const BACKEND_SRC = path.join(PROJECT_ROOT, 'backend');
const STAGING_ROOT = path.join(FRONTEND_ROOT, 'release-staging');
const STAGING_BACKEND = path.join(STAGING_ROOT, 'backend');
const PHP_BINARY = path.join(PROJECT_ROOT, 'php-runtime-spike', 'php.exe');

/** Directory names pruned wherever they appear. */
const EXCLUDE_DIRS = new Set([
  '.git',
  'node_modules',
  'vendor',
  'storage',
  'tests',
  '.phpunit.cache',
]);

/** Paths pruned at the backend root only (posix-style, relative to BACKEND_SRC). */
const EXCLUDE_PATHS = new Set([
  '.env',
  '.phpunit.result.cache',
  '.smoketoken',
  'serve.log',
  'Dockerfile',
  'phpunit.xml',
  'README.md',
  'package.json',
  'postcss.config.js',
  'tailwind.config.js',
  'vite.config.js',
  // Replaced by the fresh Vite build, copied explicitly after composer runs.
  'public/app',
]);

/** File extensions pruned wherever they appear. */
const EXCLUDE_EXTENSIONS = new Set(['.sqlite', '.sqlite-journal', '.log']);

function rel(absolute) {
  return path.relative(BACKEND_SRC, absolute).split(path.sep).join('/');
}

function shouldCopy(absolute) {
  const relative = rel(absolute);
  if (relative === '') {
    return true;
  }
  const base = path.basename(absolute);
  if (EXCLUDE_DIRS.has(base)) {
    return false;
  }
  if (EXCLUDE_PATHS.has(relative)) {
    return false;
  }
  if (EXCLUDE_EXTENSIONS.has(path.extname(base).toLowerCase())) {
    return false;
  }
  return true;
}

function dirSize(dir) {
  if (!fs.existsSync(dir)) {
    return { bytes: 0, files: 0 };
  }
  let bytes = 0;
  let files = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) {
      bytes += fs.statSync(path.join(entry.parentPath, entry.name)).size;
      files += 1;
    }
  }
  return { bytes, files };
}

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function report(label, dir) {
  const { bytes, files } = dirSize(dir);
  console.log(`  ${label.padEnd(26)} ${mb(bytes).padStart(10)}  ${String(files).padStart(6)} files`);
}

function run(command, args, cwd) {
  console.log(`\n$ ${command} ${args.join(' ')}   (cwd=${cwd})`);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    throw new Error(`${command} exited ${String(result.status)}`);
  }
}

/**
 * Re-asserts the prune list against the tree that was actually produced.
 *
 * This is the check that makes "the installer ships no secrets" a verified
 * statement rather than an intention: a filter bug, a symlink, or someone
 * copying a file in by hand after the fact all show up here.
 */
function verify() {
  const failures = [];

  const mustNotExist = [
    '.env',
    '.git',
    'storage',
    'tests',
    'phpunit.xml',
    'database/database.sqlite',
    'serve.log',
  ];
  for (const candidate of mustNotExist) {
    if (fs.existsSync(path.join(STAGING_BACKEND, candidate))) {
      failures.push(`LEAKED: ${candidate} is present in the staging tree`);
    }
  }

  const mustExist = [
    'artisan',
    'composer.json',
    'bootstrap/app.php',
    'bootstrap/cache/packages.php',
    'bootstrap/cache/services.php',
    'config/app.php',
    'routes/web.php',
    'database/migrations',
    'database/seeders',
    'database/seed-template.sqlite',
    'public/index.php',
    'public/app/index.html',
    'vendor/autoload.php',
    'vendor/composer/autoload_classmap.php',
  ];
  for (const candidate of mustExist) {
    if (!fs.existsSync(path.join(STAGING_BACKEND, candidate))) {
      failures.push(`MISSING: ${candidate} is absent from the staging tree`);
    }
  }

  // A --no-dev vendor must not contain the dev-only toolchain.
  for (const devPackage of ['phpunit', 'laravel/pint', 'laravel/sail', 'mockery', 'fakerphp']) {
    if (fs.existsSync(path.join(STAGING_BACKEND, 'vendor', devPackage))) {
      failures.push(`DEV DEPENDENCY: vendor/${devPackage} should not exist after --no-dev`);
    }
  }

  // Nothing with a secret-ish extension should have survived.
  for (const entry of fs.readdirSync(STAGING_BACKEND, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) {
      continue;
    }
    const relative = path
      .relative(STAGING_BACKEND, path.join(entry.parentPath, entry.name))
      .split(path.sep)
      .join('/');
    if (relative.endsWith('.sqlite') && relative !== 'database/seed-template.sqlite') {
      failures.push(`LEAKED: unexpected sqlite file ${relative}`);
    }
    if (entry.name === '.env' || entry.name.startsWith('.env.') && entry.name !== '.env.example') {
      failures.push(`LEAKED: ${relative}`);
    }
  }

  console.log('\n── staging verification ──────────────────────────────────────');
  if (failures.length === 0) {
    console.log('  PASS — prune list holds, required files present, vendor is --no-dev.');
    return true;
  }
  for (const failure of failures) {
    console.log(`  ${failure}`);
  }
  console.log(`  FAIL — ${String(failures.length)} problem(s).`);
  return false;
}

function stage() {
  if (!fs.existsSync(BACKEND_SRC)) {
    throw new Error(`Backend not found at ${BACKEND_SRC}`);
  }

  console.log(`\n── 1. prune-copy ${BACKEND_SRC} → ${STAGING_BACKEND}`);
  fs.rmSync(STAGING_BACKEND, { recursive: true, force: true });
  fs.mkdirSync(STAGING_ROOT, { recursive: true });
  fs.cpSync(BACKEND_SRC, STAGING_BACKEND, {
    recursive: true,
    dereference: true,
    filter: shouldCopy,
  });
  report('pruned copy', STAGING_BACKEND);

  console.log('\n── 2. composer install --no-dev --optimize-autoloader');
  run('composer', ['install', '--no-dev', '--optimize-autoloader', '--no-interaction'], STAGING_BACKEND);
  report('vendor/', path.join(STAGING_BACKEND, 'vendor'));

  console.log('\n── 3. syntax check with the BUNDLED php (the one that ships)');
  for (const file of ['artisan', 'public/index.php', 'bootstrap/app.php']) {
    run(PHP_BINARY, ['-l', file], STAGING_BACKEND);
  }

  console.log('\n── 4. copy the built SPA');
  const spaSrc = path.join(BACKEND_SRC, 'public', 'app');
  if (!fs.existsSync(path.join(spaSrc, 'index.html'))) {
    throw new Error(
      `No built SPA at ${spaSrc}. Run \`npm run build:desktop\` first — it writes ` +
        'the Vite output straight into the backend document root with --base=/app/.',
    );
  }
  fs.cpSync(spaSrc, path.join(STAGING_BACKEND, 'public', 'app'), { recursive: true });
  report('public/app (SPA)', path.join(STAGING_BACKEND, 'public', 'app'));

  console.log('\n── 5. copy the seeded template database');
  const dbSrc = path.join(BACKEND_SRC, 'database', 'database.sqlite');
  if (!fs.existsSync(dbSrc)) {
    throw new Error(`No template DB at ${dbSrc}.`);
  }
  const dbDest = path.join(STAGING_BACKEND, 'database', 'seed-template.sqlite');
  fs.copyFileSync(dbSrc, dbDest);
  console.log(`  seed-template.sqlite        ${mb(fs.statSync(dbDest).size).padStart(10)}`);

  console.log('\n── totals ────────────────────────────────────────────────────');
  report('staged backend', STAGING_BACKEND);
}

const verifyOnly = process.argv.includes('--verify');
if (!verifyOnly) {
  stage();
}
if (!verify()) {
  process.exit(1);
}
