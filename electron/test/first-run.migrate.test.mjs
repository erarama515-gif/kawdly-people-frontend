/**
 * Regression test for P0-3: migrations must run on EVERY launch.
 *
 * Why this is an integration test rather than a mocked unit test
 * -------------------------------------------------------------
 * The bug was not in a decision function â€” it was in the wiring between the
 * install marker and `artisan migrate`. Mocking `runMigrate` would have proven
 * that a mock was called; it would not have proven that a real second launch
 * against the same profile reaches PHP again. There is no JS test runner in
 * this repo (no vitest/jest), and adding one for a single test is a bigger
 * change than the fix, so this uses `node --test` against the compiled
 * `electron/dist` output, with a real temp profile and the bundled PHP binary.
 *
 * What it pins down
 * -----------------
 *   1. A profile whose marker says the same version still migrates (this is
 *      the exact scenario that failed: rebuild 0.1.0, reinstall over 0.1.0).
 *   2. The marker records `lastMigratedAt` and `migrationFingerprint`.
 *   3. A second launch migrates again.
 *   4. The pre-migration backup happens once for the changed migration set,
 *      not once per launch â€” always-migrate must not mean always-backup.
 *
 * Run: npm run test:electron   (after `npm run electron:build`)
 */

import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '..', '..');
const projectRoot = path.resolve(frontendRoot, '..');
const distEntry = path.join(frontendRoot, 'electron', 'dist', 'first-run.js');
const phpBinary = path.join(projectRoot, 'php-runtime-spike', 'php.exe');
const backendPath = path.join(projectRoot, 'backend');

/** The shipped template is the closest thing to a real install; fall back to
 * the dev database if staging has never run, because either is a valid
 * already-migrated profile for this test. */
const templateCandidates = [
  path.join(frontendRoot, 'release-staging', 'backend', 'database', 'seed-template.sqlite'),
  path.join(backendPath, 'database', 'database.sqlite'),
];

function assertPreconditions() {
  assert.ok(
    fs.existsSync(distEntry),
    `Missing ${distEntry}. Run "npm run electron:build" (or "npm run typecheck:desktop" first) before this test.`,
  );
  assert.ok(
    fs.existsSync(phpBinary),
    `Missing bundled PHP at ${phpBinary}; this test needs the real binary to prove the migrate spawns.`,
  );
}

function readMarker(userDataPath) {
  return JSON.parse(fs.readFileSync(path.join(userDataPath, '.kawdly-installed'), 'utf8'));
}

function migrateLogEntries(userDataPath) {
  const logFile = path.join(userDataPath, 'logs', 'migrate.log');
  if (!fs.existsSync(logFile)) {
    return 0;
  }

  return fs.readFileSync(logFile, 'utf8').match(/migrate --force/g)?.length ?? 0;
}

function backups(userDataPath) {
  const dir = path.join(userDataPath, 'backups');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.sqlite')) : [];
}

test('migrateIfNeeded migrates on every launch, same version included', async () => {
  assertPreconditions();

  const { migrateIfNeeded } = await import(pathToFileURL(distEntry).href);

  const template = templateCandidates.find((candidate) => fs.existsSync(candidate));
  assert.ok(template, 'No seed template or dev database to build the test profile from');

  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'kawdly-firstrun-'));

  try {
    fs.mkdirSync(path.join(userDataPath, 'data'), { recursive: true });
    fs.copyFileSync(template, path.join(userDataPath, 'data', 'database.sqlite'));

    // A profile written by the OLD code: same version, no fingerprint. This is
    // the state a 0.1.0-over-0.1.0 reinstall left behind.
    fs.writeFileSync(
      path.join(userDataPath, '.kawdly-installed'),
      `${JSON.stringify(
        { version: '0.1.0', installedAt: '2026-10-20T00:00:00.000Z' },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const paths = {
      backendPath,
      phpBinaryPath: phpBinary,
      routerScriptPath: path.join(frontendRoot, 'electron', 'resources', 'desktop-server.php'),
      userDataPath,
      templateDbPath: template,
      isPackaged: false,
    };

    // â”€â”€ launch 1 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    await migrateIfNeeded({ paths, appVersion: '0.1.0' });

    assert.equal(migrateLogEntries(userDataPath), 1, 'first launch must run migrate');
    assert.equal(backups(userDataPath).length, 1, 'changed migration set must be backed up');

    const firstMarker = readMarker(userDataPath);
    assert.equal(firstMarker.version, '0.1.0');
    assert.equal(firstMarker.installedAt, '2026-10-20T00:00:00.000Z', 'installedAt is preserved');
    assert.ok(firstMarker.lastMigratedAt, 'marker must record lastMigratedAt');
    assert.match(
      String(firstMarker.migrationFingerprint),
      /^[0-9a-f]{16}$/,
      'marker must record a migration fingerprint',
    );

    // â”€â”€ launch 2 (same version, same migrations) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    await new Promise((resolve) => setTimeout(resolve, 1100)); // distinct ISO second
    await migrateIfNeeded({ paths, appVersion: '0.1.0' });

    assert.equal(
      migrateLogEntries(userDataPath),
      2,
      'second launch must run migrate again (this is the P0-3 regression)',
    );
    assert.equal(
      backups(userDataPath).length,
      1,
      'an unchanged migration set must not create another backup on every launch',
    );

    const secondMarker = readMarker(userDataPath);
    assert.notEqual(
      secondMarker.lastMigratedAt,
      firstMarker.lastMigratedAt,
      'lastMigratedAt must be refreshed on every launch',
    );
    assert.equal(secondMarker.installedAt, '2026-10-20T00:00:00.000Z');
  } finally {
    fs.rmSync(userDataPath, { recursive: true, force: true });
  }
});

test('migrationFingerprint changes when the migration set changes', async () => {
  assertPreconditions();

  const { migrationFingerprint } = await import(pathToFileURL(distEntry).href);

  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'kawdly-fingerprint-'));

  try {
    const dir = path.join(base, 'database', 'migrations');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '2026_01_01_000000_a.php'), '<?php // a', 'utf8');

    const before = migrationFingerprint(base);

    fs.writeFileSync(path.join(dir, '2026_01_02_000000_b.php'), '<?php // b', 'utf8');
    const afterAdd = migrationFingerprint(base);

    fs.writeFileSync(path.join(dir, '2026_01_01_000000_a.php'), '<?php // a edited', 'utf8');
    const afterEdit = migrationFingerprint(base);

    assert.match(before, /^[0-9a-f]{16}$/);
    assert.notEqual(afterAdd, before, 'a new migration file must change the fingerprint');
    assert.notEqual(afterEdit, afterAdd, 'editing an unrun migration must change the fingerprint');
    assert.equal(migrationFingerprint(base), afterEdit, 'fingerprint is stable across calls');
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});
