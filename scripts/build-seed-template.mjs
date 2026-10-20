/**
 * Kawdly People — turn a developer's database into the shipped seed template (T6.5).
 *
 * `stage-backend.mjs` used to copy `backend/database/database.sqlite` straight
 * to `seed-template.sqlite`. That is the file every installation starts life
 * as, so every installation started life with the developer's seeded demo
 * company: 54 employees, 2310 attendance rows, and — the reason this file
 * exists — two accounts whose password is literally `password`, identical on
 * every machine and written down in the repo. Fine while the only installs
 * were ours. Not fine the moment a build is handed to someone outside the team.
 *
 * This module runs between the copy and the package, on the COPY only. The
 * developer's own database is never opened for writing, which matters because
 * the project's test login (`test@example.com` / `password`) is a documented
 * part of the dev workflow and must keep working.
 *
 * ---------------------------------------------------------------------------
 * Allowlist, not denylist
 * ---------------------------------------------------------------------------
 * KEEP_WITH_DATA below names the tables whose rows ship. Everything else is
 * emptied. The inverse — a list of tables to clear — reads more naturally and
 * is the wrong shape: when a future migration adds a table and a seeder fills
 * it with demo rows, a denylist ships it silently, while an allowlist empties
 * it by default. The failure modes are not symmetric. A wrongly-emptied
 * reference table is a visibly broken dropdown someone reports on day one; a
 * wrongly-shipped demo table is a data leak nobody notices.
 *
 * Same reasoning as `buildPhpEnv()` in electron/src/php-process.ts, which
 * allowlists environment variables rather than filtering `process.env`.
 *
 * ---------------------------------------------------------------------------
 * What "clean" means here, and what it does not
 * ---------------------------------------------------------------------------
 * Schema is untouched: all 93 migration rows stay, so Laravel's migrator sees
 * a fully-migrated database and does nothing on first run. RBAC stays whole
 * (869 permissions, 10 roles, 2089 role-permission links) because rebuilding
 * it on the user's machine would mean shipping and running the seeders, which
 * is slower and has more ways to fail than shipping the result.
 *
 * What ships is a company with no people in it. There is deliberately no
 * admin account in the template: the account is created per install by
 * `kawdly:create-admin` with a password generated on that machine
 * (electron/src/first-run.ts). A shipped admin row, however it was created,
 * would be a shared credential again.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

/**
 * Tables whose rows ship. Everything not listed is emptied.
 *
 * Grouped by why they survive, because "is this reference data or demo data?"
 * is the only question this file asks and the answer should be reviewable.
 */
const KEEP_WITH_DATA = new Set([
  // Schema ledger. Without these rows Laravel re-runs every migration.
  'migrations',

  // RBAC. Expensive to rebuild on the user's machine, contains no personal data.
  'permissions',
  'roles',
  'role_has_permissions',
  'role_data_scopes',

  // The single company row, rebranded below.
  'companies',

  // System configuration.
  'settings',
  'work_schedules',
  'shift_rotations',
  'holidays',
  'workflow_definitions',
  'rules',
  'custom_fields',
  'form_definitions',

  // Org-structure placeholders. Named positions and departments with nobody
  // in them: a starting point to rename, not somebody else's org chart.
  'departments',
  'branches',
  'cost_centers',
  'job_positions',
  'job_grades',
  'job_levels',

  // Reference catalogues.
  'leave_types',
  'leave_policies',
  'salary_structures',
  'salary_components',
  'document_types',
  'document_templates',
  'competencies',
  'position_competencies',
  'career_paths',
  'career_path_levels',
  'learning_paths',
  'learning_path_steps',
  'onboarding_templates',
  'onboarding_template_tasks',
]);

/*
 * Deliberately NOT kept, despite looking like reference data:
 *
 *   training_programs   Reads like a course catalogue, and the titles are
 *                       generic ("Workplace Safety Certification"), but every
 *                       row is a scheduled instance: a named trainer (two of
 *                       them real-looking people), fixed 2026 start/end dates,
 *                       a room ("Cairo HQ — Training Room A"), and a status of
 *                       "ongoing". A customer opening the Training module
 *                       would see somebody else's September 2026 schedule
 *                       already in progress. learning_path_steps references
 *                       these programmes by title in free text, which is
 *                       harmless, and by nullable FK, which is handled by
 *                       clearDanglingReferences().
 */

/**
 * Strings that must not survive anywhere in the shipped bytes.
 *
 * Checked against the raw file after VACUUM rather than with SELECTs, because
 * a SELECT only sees live rows. Deleted rows linger in freed pages until a
 * VACUUM rewrites the file, and "the row is gone from the table" is a weaker
 * claim than "the bytes are not in the file".
 *
 * Scope of this check, stated honestly: it catches the demo identities that
 * exist in the dataset today. It cannot catch a demo name nobody has noticed
 * yet — `training_programs.trainer_name` held "Layla Mostafa" and this list
 * did not know about her until the build failed on her colleague. The actual
 * guarantee is KEEP_WITH_DATA: a table not on it ships empty whether or not
 * anyone audited its contents. This list is the second line, not the first.
 */
const FORBIDDEN_STRINGS = [
  // Covers every seeded address at once, not just the two login accounts.
  '@example.com',
  'Kawdly Tech',
  'Kawdly Technologies',
  'Test User',
  'Ahmed Sami',
  'Layla Mostafa',
];

/** Post-clean row counts that must hold exactly, or the build stops. */
const EXPECTED_COUNTS = {
  users: 0,
  employees: 0,
  personal_access_tokens: 0,
  sessions: 0,
  model_has_roles: 0,
  attendances: 0,
  payslips: 0,
  roles: 10,
  permissions: 869,
  companies: 1,
};

const COMPANY_NAME = 'My Company';
const COMPANY_NAME_AR = 'شركتي';

function listTables(db) {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((row) => row.name);
}

function countRows(db, table) {
  return db.prepare(`SELECT COUNT(*) AS n FROM \`${table}\``).get().n;
}

/**
 * Clear columns in KEPT tables that point at rows we just deleted.
 *
 * SQLite does not enforce foreign keys unless asked, so emptying `employees`
 * leaves `departments.head_employee_id` pointing at employee 7, who no longer
 * exists. Laravel's SQLite connection DOES enable foreign_keys, so the first
 * write that touches such a row on the user's machine would fail — on their
 * machine, not ours.
 *
 * Derived from the schema rather than hardcoded so a new column gets handled
 * without anyone remembering to come back here. NOT NULL columns cannot be
 * nulled, so they are reported and the caller aborts.
 */
function clearDanglingReferences(db, keptTables, emptiedTables, log) {
  const problems = [];
  let cleared = 0;

  for (const table of keptTables) {
    const columns = db.prepare(`PRAGMA table_info(\`${table}\`)`).all();
    const foreignKeys = db.prepare(`PRAGMA foreign_key_list(\`${table}\`)`).all();

    for (const fk of foreignKeys) {
      if (!emptiedTables.has(fk.table)) {
        continue;
      }
      const column = columns.find((c) => c.name === fk.from);
      const affected = countRows(db, table) === 0
        ? 0
        : db.prepare(`SELECT COUNT(*) AS n FROM \`${table}\` WHERE \`${fk.from}\` IS NOT NULL`).get().n;

      if (affected === 0) {
        continue;
      }
      if (column?.notnull) {
        problems.push(
          `${table}.${fk.from} -> ${fk.table} is NOT NULL with ${affected} row(s); `
          + `cannot be nulled. Either keep ${fk.table} or stop keeping ${table}.`,
        );
        continue;
      }
      db.prepare(`UPDATE \`${table}\` SET \`${fk.from}\` = NULL WHERE \`${fk.from}\` IS NOT NULL`).run();
      log(`  nulled ${table}.${fk.from} (${affected} row(s)) -> ${fk.table} is now empty`);
      cleared += affected;
    }
  }

  if (problems.length > 0) {
    throw new Error(`Dangling foreign keys cannot be resolved:\n  - ${problems.join('\n  - ')}`);
  }
  return cleared;
}

/**
 * Replace the demo company's identity with a neutral placeholder.
 *
 * `companies` is not the only place the name lives: `settings` carries a
 * `general.companyName` row that the UI reads in preference to the companies
 * table, so rebranding only the companies row leaves the old name on screen.
 * The logo setting points at a Kawdly asset, which would otherwise show up as
 * the customer's own logo.
 */
function rebrandCompany(db, log) {
  const before = db.prepare('SELECT name, name_ar FROM companies WHERE id = 1').get();
  if (before === undefined) {
    throw new Error('No company row with id = 1; the template would ship with no company at all.');
  }

  db.prepare(
    `UPDATE companies
        SET name = ?, name_ar = ?, legal_name = NULL, registration_number = NULL,
            tax_number = NULL, logo = NULL, email = NULL, phone = NULL, website = NULL,
            address = NULL, city = NULL, updated_at = ?
      WHERE id = 1`,
  ).run(COMPANY_NAME, COMPANY_NAME_AR, new Date().toISOString().slice(0, 19).replace('T', ' '));

  // Any company row beyond id=1 is demo data by definition.
  const extras = db.prepare('DELETE FROM companies WHERE id <> 1').run();

  const nameSetting = db
    .prepare("UPDATE settings SET value = ? WHERE `group` = 'general' AND `key` = 'companyName'")
    .run(COMPANY_NAME);
  const logoSetting = db
    .prepare("UPDATE settings SET value = '' WHERE `group` = 'general' AND `key` = 'logo'")
    .run();

  log(`  companies.name  "${before.name}" -> "${COMPANY_NAME}"`);
  log(`  companies.name_ar  "${before.name_ar ?? ''}" -> "${COMPANY_NAME_AR}"`);
  log(`  settings general.companyName  ${nameSetting.changes} row(s) updated`);
  log(`  settings general.logo  ${logoSetting.changes} row(s) cleared`);
  if (extras.changes > 0) {
    log(`  removed ${extras.changes} extra company row(s)`);
  }
}

/**
 * Build the shipped template from a source database.
 *
 * @param {string} sourcePath  the developer's database. Opened read-only.
 * @param {string} destPath    written; overwritten if present.
 * @param {{ log?: (line: string) => void }} [options]
 */
export function buildSeedTemplate(sourcePath, destPath, options = {}) {
  const log = options.log ?? ((line) => { console.log(line); });

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`No source database at ${sourcePath}`);
  }

  // Work on a byte copy. The source is never opened for writing, so a crash
  // halfway through cannot damage the developer's data.
  fs.rmSync(destPath, { force: true });
  fs.copyFileSync(sourcePath, destPath);
  const sizeBefore = fs.statSync(destPath).size;

  const db = new DatabaseSync(destPath);
  let emptied = 0;
  let rowsDeleted = 0;

  try {
    const tables = listTables(db);

    // An allowlist entry that matches no table is a typo, and a typo here
    // silently ships a demo table. Catch it before it matters.
    const unknown = [...KEEP_WITH_DATA].filter((name) => !tables.includes(name));
    if (unknown.length > 0) {
      throw new Error(
        `KEEP_WITH_DATA names ${unknown.length} table(s) that do not exist: ${unknown.join(', ')}. `
        + 'A migration probably renamed or dropped them; update the allowlist.',
      );
    }

    const keptTables = tables.filter((name) => KEEP_WITH_DATA.has(name));
    const emptiedTables = new Set(tables.filter((name) => !KEEP_WITH_DATA.has(name)));

    log(`\n  ${tables.length} tables: ${keptTables.length} keep data, ${emptiedTables.size} emptied`);

    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN');

    for (const table of emptiedTables) {
      const n = countRows(db, table);
      if (n === 0) {
        continue;
      }
      db.prepare(`DELETE FROM \`${table}\``).run();
      rowsDeleted += n;
      emptied += 1;
    }
    log(`  deleted ${rowsDeleted} row(s) from ${emptied} table(s)`);

    clearDanglingReferences(db, keptTables, emptiedTables, log);
    rebrandCompany(db, log);

    // Let the first real record in each emptied table get id = 1 instead of
    // continuing from the demo data's high-water mark.
    const sequences = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = 'sqlite_sequence'")
      .all();
    if (sequences.length > 0) {
      const placeholders = [...emptiedTables].map(() => '?').join(', ');
      const reset = db
        .prepare(`DELETE FROM sqlite_sequence WHERE name IN (${placeholders})`)
        .run(...emptiedTables);
      log(`  reset ${reset.changes} autoincrement counter(s)`);
    }

    db.exec('COMMIT');

    // Must come after COMMIT: foreign_key_check reports against committed state.
    db.exec('PRAGMA foreign_keys = ON');
    const violations = db.prepare('PRAGMA foreign_key_check').all();
    if (violations.length > 0) {
      const summary = violations
        .slice(0, 10)
        .map((v) => `${v.table} row ${v.rowid} -> missing ${v.parent}`)
        .join('; ');
      throw new Error(
        `${violations.length} foreign key violation(s) after cleaning: ${summary}`,
      );
    }
    log('  PRAGMA foreign_key_check: 0 violations');

    // Rewrites the file so deleted rows stop occupying freed pages. This is
    // what makes the byte scan in verifySeedTemplate() meaningful, and it is
    // also why the template is ~4x smaller than the dev database.
    db.exec('VACUUM');
  } finally {
    db.close();
  }

  const sizeAfter = fs.statSync(destPath).size;
  log(
    `  VACUUM: ${(sizeBefore / 1024 / 1024).toFixed(2)} MB -> `
    + `${(sizeAfter / 1024 / 1024).toFixed(2)} MB`,
  );

  return { sizeBefore, sizeAfter, rowsDeleted, tablesEmptied: emptied };
}

/**
 * Re-assert that a template on disk is clean.
 *
 * Separate from buildSeedTemplate so the staging verifier can re-check the
 * file that was actually produced, the same way `stage-backend.mjs --verify`
 * re-checks the prune list. A build step that only validates its own output
 * in-process cannot catch a file replaced after the fact.
 *
 * @param {string} dbPath
 * @returns {{ ok: boolean, failures: string[], counts: Record<string, number> }}
 */
export function verifySeedTemplate(dbPath) {
  const failures = [];
  const counts = {};

  if (!fs.existsSync(dbPath)) {
    return { ok: false, failures: [`MISSING: no template at ${dbPath}`], counts };
  }

  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const tables = new Set(listTables(db));

    for (const [table, expected] of Object.entries(EXPECTED_COUNTS)) {
      if (!tables.has(table)) {
        failures.push(`MISSING TABLE: ${table}`);
        continue;
      }
      const actual = countRows(db, table);
      counts[table] = actual;
      if (actual !== expected) {
        failures.push(`COUNT: ${table} is ${actual}, expected ${expected}`);
      }
    }

    const company = db.prepare('SELECT name, name_ar FROM companies WHERE id = 1').get();
    if (company === undefined) {
      failures.push('MISSING: companies row id = 1');
    } else if (company.name !== COMPANY_NAME) {
      failures.push(`BRANDING: companies.name is "${company.name}", expected "${COMPANY_NAME}"`);
    }

    // Any table outside the allowlist that still holds rows means the
    // allowlist and the cleaner disagree.
    for (const table of tables) {
      if (KEEP_WITH_DATA.has(table)) {
        continue;
      }
      const n = countRows(db, table);
      if (n > 0) {
        failures.push(`NOT EMPTIED: ${table} still has ${n} row(s)`);
      }
    }

    const violations = db.prepare('PRAGMA foreign_key_check').all();
    if (violations.length > 0) {
      failures.push(`FOREIGN KEYS: ${violations.length} violation(s)`);
    }
  } finally {
    db.close();
  }

  // Raw-byte scan: the claim is about the shipped file, not about live rows.
  const bytes = fs.readFileSync(dbPath);
  for (const needle of FORBIDDEN_STRINGS) {
    if (bytes.includes(Buffer.from(needle, 'utf8'))) {
      failures.push(`LEAKED STRING: "${needle}" is present in the template bytes`);
    }
  }

  return { ok: failures.length === 0, failures, counts };
}

/** SHA-256 of the produced file, so the report can name what was shipped. */
export function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').toUpperCase();
}

// ─── CLI ────────────────────────────────────────────────────────────────────
// node scripts/build-seed-template.mjs <source.sqlite> <dest.sqlite>
// node scripts/build-seed-template.mjs --verify <template.sqlite>

const isMain = process.argv[1] !== undefined
  && import.meta.filename === fs.realpathSync(process.argv[1]);

if (isMain) {
  const args = process.argv.slice(2);

  if (args[0] === '--verify') {
    const target = args[1];
    if (target === undefined) {
      console.error('usage: build-seed-template.mjs --verify <template.sqlite>');
      process.exit(2);
    }
    const result = verifySeedTemplate(target);
    console.log('\n── seed template verification ────────────────────────────────');
    for (const [table, n] of Object.entries(result.counts)) {
      console.log(`  ${table.padEnd(26)} ${String(n).padStart(6)}`);
    }
    if (result.ok) {
      console.log('  PASS — template is clean.');
    } else {
      for (const failure of result.failures) {
        console.log(`  ${failure}`);
      }
      console.log(`  FAIL — ${String(result.failures.length)} problem(s).`);
      process.exit(1);
    }
  } else {
    const [source, dest] = args;
    if (source === undefined || dest === undefined) {
      console.error('usage: build-seed-template.mjs <source.sqlite> <dest.sqlite>');
      process.exit(2);
    }
    buildSeedTemplate(source, dest);
    const result = verifySeedTemplate(dest);
    console.log('\n── seed template verification ────────────────────────────────');
    for (const [table, n] of Object.entries(result.counts)) {
      console.log(`  ${table.padEnd(26)} ${String(n).padStart(6)}`);
    }
    if (!result.ok) {
      for (const failure of result.failures) {
        console.log(`  ${failure}`);
      }
      process.exit(1);
    }
    console.log(`  PASS — template is clean.`);
    console.log(`  sha256 ${sha256(dest)}`);
  }
}
