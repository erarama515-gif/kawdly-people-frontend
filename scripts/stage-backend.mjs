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

import { buildSeedTemplate, verifySeedTemplate } from './build-seed-template.mjs';

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
  // The demo-data generators. Unreachable at run time — first-run.ts runs
  // `migrate` and nothing else, and no route invokes a seeder — but they are
  // 13 files of readable source carrying the developer's company, fabricated
  // employee names, and (in DatabaseSeeder.php) the standing dev login
  // `test@example.com` / `password`. T6.5 cleaned those rows out of the
  // shipped database; leaving the code that re-creates them is leaving the
  // loaded gun next to the unloaded one. If anyone ever wires a "reset demo
  // data" action, or runs `migrate:fresh --seed` on a user's install, the
  // shared-credential leak comes straight back. Pruned for the same reason
  // `tests/` is.
  'database/seeders',
  // Exists only to feed seeders and tests, both of which are now gone.
  // `HasFactory` resolves a factory class lazily, by name, on the first
  // `Model::factory()` call — which production code never makes.
  'database/factories',
]);

/** File extensions pruned wherever they appear. */
const EXCLUDE_EXTENSIONS = new Set(['.sqlite', '.sqlite-journal', '.log']);

/**
 * Design-system artefacts that live in `frontend/public/` and are therefore
 * copied verbatim into the Vite output by every build.
 *
 * They are kept in the repo on purpose — designers reference them — but they
 * must not ship. `public/app/` is the packaged app's document root, so anything
 * in here is served: `HR Dashboard Ledger EN.dc.html` is a static mockup of the
 * dashboard pre-filled with fabricated employees ("Ahmed Sami" and friends),
 * reachable on a clean install at `/app/HR%20Dashboard%20Ledger%20EN.dc.html`.
 * A beta user who finds that URL sees a page of demo PII that the app itself no
 * longer contains anywhere.
 *
 * Matched on basename, relative to the SPA root. NOT part of EXCLUDE_PATHS:
 * `public/app` is pruned wholesale in step 1 and copied explicitly in step 4,
 * so the step-1 filter never sees these files.
 */
const EXCLUDE_SPA_FILES = new Set([
  'HR Dashboard Ledger EN.dc.html',
  'cover-preview.html',
  'tokens.json',
  'README.md',
]);

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
/**
 * Byte-scans the whole staging tree for the standing development credentials.
 *
 * The seed template has its own string gate (verifySeedTemplate), but that only
 * reads one file. This reads every file that ships, because the leak T6.5 fixed
 * existed in two places at once: as rows in the database AND as literals in
 * `database/seeders/DatabaseSeeder.php`, which created a `test@example.com`
 * account whose password was `password` on every machine. Pruning the seeders
 * closes that, and this is what keeps it closed — a re-added seeder, a stray
 * fixture, a `.env` copied in by hand, or a built SPA chunk that inlined a test
 * login all surface here instead of in a beta user's install.
 *
 * Scanned as raw bytes, not parsed: a literal split across a minified chunk
 * boundary is not something a source-level grep would see anyway, and this way
 * the check is indifferent to file type.
 *
 * `@example.com` on its own is NOT an error everywhere. Laravel's own
 * `config/mail.php` defaults `MAIL_FROM_ADDRESS` to `hello@example.com`,
 * `.env.example` ships the same, and Symfony's mailer carries it in docs and in
 * `Address.php`. Those are framework defaults, not credentials, so the scan
 * exempts `vendor/`, `config/`, and `.env.example` for the generic pattern
 * while holding `test@example.com` to zero hits ANYWHERE — that one is a login
 * that exists, with a known password, and has no legitimate reason to ship.
 */
const FORBIDDEN_BYTES = [
  { needle: 'test@example.com', exempt: [] },
  { needle: '@example.com', exempt: ['vendor/', 'config/', '.env.example'] },
];

function scanTreeForCredentials() {
  const failures = [];
  const probes = FORBIDDEN_BYTES.map((entry) => ({
    ...entry,
    buffer: Buffer.from(entry.needle, 'utf8'),
    hits: [],
  }));

  let scannedFiles = 0;
  let scannedBytes = 0;

  for (const entry of fs.readdirSync(STAGING_BACKEND, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) {
      continue;
    }
    const absolute = path.join(entry.parentPath, entry.name);
    const relative = path.relative(STAGING_BACKEND, absolute).split(path.sep).join('/');
    const data = fs.readFileSync(absolute);
    scannedFiles += 1;
    scannedBytes += data.length;

    for (const probe of probes) {
      if (probe.exempt.some((prefix) => relative.startsWith(prefix))) {
        continue;
      }
      if (data.includes(probe.buffer)) {
        probe.hits.push(relative);
      }
    }
  }

  for (const probe of probes) {
    for (const hit of probe.hits) {
      failures.push(`CREDENTIAL STRING: "${probe.needle}" found in ${hit}`);
    }
  }

  return { failures, scannedFiles, scannedBytes };
}

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
    // T6.5: the demo-data generators and the design mockups served from the
    // document root. See EXCLUDE_PATHS and EXCLUDE_SPA_FILES for why.
    'database/seeders',
    'database/factories',
    'public/app/HR Dashboard Ledger EN.dc.html',
    'public/app/cover-preview.html',
    'public/app/tokens.json',
    'public/app/README.md',
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

  // The seed template is the other half of "ships no secrets": the prune list
  // keeps the developer's .env and live database out, and this keeps the
  // developer's DATA out of the file that is deliberately copied in. Re-checked
  // here, against the produced file, for the same reason the prune list is —
  // buildSeedTemplate() validating its own output in-process cannot catch a
  // template replaced by hand afterwards.
  const template = path.join(STAGING_BACKEND, 'database', 'seed-template.sqlite');
  const templateResult = verifySeedTemplate(template);
  for (const failure of templateResult.failures) {
    failures.push(`SEED TEMPLATE: ${failure}`);
  }

  const scan = scanTreeForCredentials();
  failures.push(...scan.failures);

  console.log('\n── staging verification ──────────────────────────────────────');
  console.log(
    '  seed template: '
    + Object.entries(templateResult.counts)
      .map(([table, n]) => `${table}=${String(n)}`)
      .join('  '),
  );
  console.log(
    `  credential scan: ${String(scan.scannedFiles)} files, `
    + `${mb(scan.scannedBytes)}, ${String(scan.failures.length)} hit(s)`,
  );
  if (failures.length === 0) {
    console.log('  PASS — prune list holds, required files present, vendor is --no-dev,');
    console.log('         seed template carries no users and no demo data, and no');
    console.log('         development credentials appear anywhere in the shipped bytes.');
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
  const skippedSpaFiles = [];
  fs.cpSync(spaSrc, path.join(STAGING_BACKEND, 'public', 'app'), {
    recursive: true,
    filter: (absolute) => {
      if (!EXCLUDE_SPA_FILES.has(path.basename(absolute))) {
        return true;
      }
      skippedSpaFiles.push(path.basename(absolute));
      return false;
    },
  });
  for (const skipped of skippedSpaFiles) {
    console.log(`  pruned design artefact      ${skipped}`);
  }
  report('public/app (SPA)', path.join(STAGING_BACKEND, 'public', 'app'));

  console.log('\n── 5. build the clean seed template from the dev database');
  const dbSrc = path.join(BACKEND_SRC, 'database', 'database.sqlite');
  if (!fs.existsSync(dbSrc)) {
    throw new Error(`No template DB at ${dbSrc}.`);
  }
  const dbDest = path.join(STAGING_BACKEND, 'database', 'seed-template.sqlite');
  buildSeedTemplate(dbSrc, dbDest);
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
