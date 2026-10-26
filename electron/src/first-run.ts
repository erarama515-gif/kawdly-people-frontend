/**
 * Kawdly People — first-run provisioning and upgrade migrations (T5).
 *
 * Owns everything that has to be true about `userData` before PHP is allowed to
 * start: the directory tree, a stable APP_KEY, a database, and the schema
 * matching the installed version.
 *
 * ---------------------------------------------------------------------------
 * Why this runs BEFORE the server, not from inside Laravel
 * ---------------------------------------------------------------------------
 * `php -S` is single-threaded. If Laravel booted and then discovered it had to
 * migrate, the migration would run inside the first HTTP request while the
 * readiness probe hammered the same socket — and a failed migration would
 * surface as a readiness timeout with no diagnosis. Doing it here means a
 * migration failure is a migration failure: one process, one exit code, one
 * stderr capture, and a dialog that can name the problem.
 *
 * ---------------------------------------------------------------------------
 * The install marker
 * ---------------------------------------------------------------------------
 * `userData/.kawdly-installed` is JSON holding the app version that last
 * provisioned this profile, when it last migrated, and a fingerprint of the
 * shipped migrations. Its presence means "userData is usable". It is written
 * LAST, after everything else has succeeded, so a bootstrap that dies halfway
 * is retried on the next launch instead of leaving a profile that claims to be
 * ready and is not.
 *
 * Note that presence — not the version field — gates first-run. Migrations run
 * on every launch (see `migrateIfNeeded`); the version and fingerprint are
 * recorded for diagnosis and to decide when a backup is warranted.
 *
 * ---------------------------------------------------------------------------
 * Template database and the first admin account (T6.5)
 * ---------------------------------------------------------------------------
 * The installer ships `database/seed-template.sqlite`: full schema, all 93
 * migration rows, complete RBAC (869 permissions, 10 roles), reference data
 * and one placeholder company — and no people. It is built by
 * `scripts/build-seed-template.mjs`, which empties every table not on its
 * allowlist, so what ships cannot contain a developer's records.
 *
 * Up to v0.1 this file instead shipped the seeded development database
 * verbatim: 54 demo employees, 2310 attendance rows, and two accounts whose
 * password was literally `password` — the same two on every machine, and
 * written down in the repository. That was survivable while every install was
 * ours. It stopped being survivable the moment a build could be handed to
 * someone outside the team, which is what this release is for.
 *
 * So the admin account is created HERE, per install, with a password generated
 * on this machine (`ensureAdminAccount` below). Nothing about the credentials
 * is shipped: the template has zero rows in `users`, which the packaging
 * verifier re-asserts against the file that actually got built.
 *
 * Still deferred to v1.0, deliberately: a first-launch wizard that asks for the
 * real company name and the admin's own email, and forcing a password change on
 * first login. This is the smaller change that makes a shared credential
 * impossible; it is not the whole onboarding story.
 *
 * The APP_KEY is likewise generated per install and never shipped.
 */

import { spawn } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { buildPhpEnv } from './php-process';
import type { RuntimePaths } from './paths';

/** Marker filename, relative to userData. */
const INSTALL_MARKER = '.kawdly-installed';

/** Where the generated Laravel key is cached, relative to userData. */
const APP_KEY_FILE = path.join('data', 'appkey');

/** Pre-T5 location of the same file. Read once, then migrated. */
const LEGACY_APP_KEY_FILE = '.appkey';

/** The live SQLite file, relative to userData. */
const DATABASE_FILE = path.join('data', 'database.sqlite');

/** Where the generated admin password is written, relative to userData. */
const CREDENTIALS_FILE = path.join('data', 'ADMIN-CREDENTIALS.txt');

/** A migration that has not finished in five minutes is not going to. */
const MIGRATE_TIMEOUT_MS = 5 * 60 * 1000;

/** Creating one user is a sub-second operation; a minute is already generous. */
const CREATE_ADMIN_TIMEOUT_MS = 60 * 1000;

const ADMIN_EMAIL = 'admin@kawdly.local';
const ADMIN_NAME = 'Administrator';
const PASSWORD_LENGTH = 20;

/**
 * Password alphabet: digits and letters, minus `0 O l I 1`.
 *
 * The user's first encounter with this password is reading it off a dialog and
 * typing it into a login form, possibly having written it on paper first. A
 * character set that cannot produce "l vs 1 vs I" is worth more here than the
 * ~0.3 bits per character the exclusions cost (56 symbols instead of 62, so
 * 20 characters still carry ~116 bits).
 */
const PASSWORD_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';

interface InstallMarker {
  readonly version: string;
  readonly installedAt: string;
  readonly lastMigratedAt?: string;
  /**
   * Short hash of `database/migrations/*.php` as of the last launch.
   *
   * Informational for diagnosis AND the trigger for the pre-migration backup:
   * a rebuild that ships new migrations without changing the version bumps
   * this, so the profile is backed up before the schema moves. See
   * `migrateIfNeeded()`.
   */
  readonly migrationFingerprint?: string;
}

/** The account created on a fresh install, as handed to the UI once. */
export interface AdminCredentials {
  readonly email: string;
  readonly password: string;
  /** Absolute path of the file the password was written to. */
  readonly credentialsPath: string;
  /** False when a previous interrupted run had already created the account. */
  readonly created: boolean;
}

export interface BootstrapOptions {
  readonly paths: RuntimePaths;
  /** Version of the running build, from `resolveAppVersion()` in main.ts. */
  readonly appVersion: string;
  /** Progress text for the splash. Called with user-facing Arabic. */
  readonly onProgress?: (message: string) => void;
  /**
   * Shows the generated password to the user. Awaited, and awaited BEFORE the
   * install marker is written, so a profile is never marked ready while the
   * one-time credentials are still unacknowledged.
   *
   * A callback rather than a `dialog.showMessageBox` call in this file: every
   * other window and dialog in the app is owned by main.ts, and provisioning
   * that cannot open a window is provisioning that can be unit-tested.
   */
  readonly onCredentials?: (credentials: AdminCredentials) => Promise<void>;
}

/** Thrown when `artisan migrate` fails. Carries the output for the dialog. */
export class MigrationFailedError extends Error {
  constructor(
    message: string,
    readonly exitCode: number | null,
    readonly output: string,
  ) {
    super(message);
    this.name = 'MigrationFailedError';
  }
}

// ─── marker ───────────────────────────────────────────────────────────────────

function markerPath(userDataPath: string): string {
  return path.join(userDataPath, INSTALL_MARKER);
}

function readMarker(userDataPath: string): InstallMarker | null {
  const file = markerPath(userDataPath);
  if (!fs.existsSync(file)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<InstallMarker>;
    if (typeof parsed.version === 'string' && parsed.version !== '') {
      return {
        version: parsed.version,
        installedAt: typeof parsed.installedAt === 'string' ? parsed.installedAt : '',
        ...(typeof parsed.lastMigratedAt === 'string'
          ? { lastMigratedAt: parsed.lastMigratedAt }
          : {}),
        ...(typeof parsed.migrationFingerprint === 'string'
          ? { migrationFingerprint: parsed.migrationFingerprint }
          : {}),
      };
    }
  } catch {
    // A corrupt marker is treated as absent. Re-provisioning is idempotent
    // (every step below checks before it writes), so the recovery is safe and
    // far better than refusing to start.
  }

  return null;
}

function writeMarker(userDataPath: string, marker: InstallMarker): void {
  fs.writeFileSync(markerPath(userDataPath), `${JSON.stringify(marker, null, 2)}\n`, 'utf8');
}

/** True when this profile has never been provisioned by a successful run. */
export function isFirstRun(userDataPath: string): boolean {
  return readMarker(userDataPath) === null;
}

// ─── directories ──────────────────────────────────────────────────────────────

/**
 * The full writable tree, created up front.
 *
 * Laravel does NOT create `storage/framework/views` on demand, and a missing
 * one surfaces as a Blade compile failure inside an HTTP 200 — a response the
 * readiness probe has to parse to notice. Creating the tree is cheaper than
 * diagnosing that.
 */
export function ensureUserDataTree(userDataPath: string): void {
  const dirs = [
    'data',
    'logs',
    'backups',
    path.join('storage', 'app', 'public'),
    path.join('storage', 'app', 'private'),
    path.join('storage', 'framework', 'cache'),
    path.join('storage', 'framework', 'sessions'),
    path.join('storage', 'framework', 'views'),
    path.join('storage', 'logs'),
  ];

  for (const dir of dirs) {
    fs.mkdirSync(path.join(userDataPath, dir), { recursive: true });
  }
}

// ─── APP_KEY ──────────────────────────────────────────────────────────────────

/**
 * Returns this installation's Laravel key, generating it once if needed.
 *
 * Format is `base64:` + 32 random bytes, which is exactly what
 * `artisan key:generate` produces — Laravel's `Encrypter` requires 32 bytes for
 * the configured AES-256-CBC cipher and rejects anything else at boot.
 *
 * `randomBytes` (CSPRNG), never `Math.random`: this key encrypts session
 * payloads and everything written through `Crypt`.
 *
 * The key MUST be stable across launches — regenerating it would invalidate
 * every stored session and make previously encrypted columns unreadable. Hence
 * the cache file, and hence the legacy migration below rather than "generate a
 * new one if the old path is used".
 *
 * Stored in plaintext under the user's profile, protected only by filesystem
 * permissions. That is the same posture as the `.env` of any self-hosted
 * Laravel install, and appropriate for a single-user desktop app where the
 * database sits next to it unencrypted anyway. Electron's `safeStorage` (DPAPI
 * on Windows) is the upgrade, deferred to a later session because it has to be
 * introduced together with a re-encryption path for existing profiles.
 */
export function ensureAppKey(userDataPath: string): string {
  const explicit = process.env['KAWDLY_APP_KEY'];
  if (explicit !== undefined && explicit !== '') {
    return explicit;
  }

  const keyFile = path.join(userDataPath, APP_KEY_FILE);
  const existing = readTrimmedFile(keyFile);
  if (existing !== null) {
    return existing;
  }

  // Pre-T5 profiles cached the key at userData/.appkey. Moving it rather than
  // regenerating keeps a developer's existing sessions and encrypted data
  // readable across the upgrade.
  const legacy = readTrimmedFile(path.join(userDataPath, LEGACY_APP_KEY_FILE));
  if (legacy !== null) {
    fs.mkdirSync(path.dirname(keyFile), { recursive: true });
    fs.writeFileSync(keyFile, legacy, 'utf8');
    return legacy;
  }

  const generated = `base64:${crypto.randomBytes(32).toString('base64')}`;
  fs.mkdirSync(path.dirname(keyFile), { recursive: true });
  fs.writeFileSync(keyFile, generated, { encoding: 'utf8', mode: 0o600 });

  return generated;
}

function readTrimmedFile(file: string): string | null {
  if (!fs.existsSync(file)) {
    return null;
  }
  const value = fs.readFileSync(file, 'utf8').trim();
  return value === '' ? null : value;
}

// ─── database ─────────────────────────────────────────────────────────────────

/**
 * Puts a database in place, from the shipped template when one exists.
 *
 * Returns true if a template was copied, false if the file had to be created
 * empty — the caller uses that to decide whether `migrate` is a formality or
 * the thing that builds the entire schema.
 *
 * An empty file is a legitimate fallback, not a failure: SQLite treats a
 * zero-byte file as a valid empty database, so `migrate --force` will build all
 * 93 migrations into it. The result is an app with no demo data and no login,
 * which is bad — but it is recoverable and honest, where refusing to start
 * would not be.
 */
function ensureDatabase(paths: RuntimePaths): boolean {
  const target = path.join(paths.userDataPath, DATABASE_FILE);

  if (fs.existsSync(target) && fs.statSync(target).size > 0) {
    return true;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });

  if (fs.existsSync(paths.templateDbPath)) {
    fs.copyFileSync(paths.templateDbPath, target);
    return true;
  }

  console.warn(
    `[first-run] No template database at ${paths.templateDbPath}. ` +
      'Creating an empty one and letting migrate build the schema; this install ' +
      'will have no seeded login.',
  );
  fs.writeFileSync(target, '');

  return false;
}

/**
 * Copies the live database aside before a schema change.
 *
 * Laravel migrations are not reliably reversible in practice, and a desktop
 * user has no DBA and no snapshot. The copy is the difference between "the
 * upgrade broke my data" and "roll back to the file from before the upgrade".
 * SQLite is a single file, so this is a `copyFileSync` rather than a dump.
 *
 * Returns the backup path, or null when there was nothing to back up.
 */
export function backupDatabase(userDataPath: string, reason: string): string | null {
  const source = path.join(userDataPath, DATABASE_FILE);
  if (!fs.existsSync(source)) {
    return null;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeReason = reason.replace(/[^a-zA-Z0-9._-]/g, '_');
  const target = path.join(userDataPath, 'backups', `database-${stamp}-${safeReason}.sqlite`);

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);

  return target;
}

// ─── migrate ──────────────────────────────────────────────────────────────────

/**
 * Short digest of the migration files this build ships.
 *
 * Both the filename and its contents are hashed: a build can add a migration
 * (new name) or edit one that has not run yet (same name), and in either case
 * the installed schema may be about to change. Ordering is explicit so the
 * fingerprint does not depend on directory enumeration order.
 *
 * Costs ~100 small reads (<10 ms). Deliberately not memoised: this runs at most
 * once per launch, and a stale cache is the one failure mode worth ruling out.
 */
export function migrationFingerprint(backendPath: string): string {
  const dir = path.join(backendPath, 'database', 'migrations');

  let files: string[];
  try {
    files = fs
      .readdirSync(dir)
      .filter((name) => name.endsWith('.php'))
      .sort();
  } catch {
    // A missing migrations directory means the build is broken, not that there
    // is nothing to migrate; a stable sentinel keeps the marker readable.
    return 'unavailable';
  }

  const hash = crypto.createHash('sha256');
  for (const file of files) {
    hash.update(file);
    hash.update('\0');
    try {
      hash.update(fs.readFileSync(path.join(dir, file)));
    } catch {
      hash.update('unreadable');
    }
  }

  return hash.digest('hex').slice(0, 16);
}

/**
 * Runs `php artisan migrate --force` against the userData database.
 *
 * Uses `buildPhpEnv()` — the SAME allowlist the HTTP server gets — so the
 * migration and the running application can never disagree about which
 * database, which storage path or which APP_KEY they are using. A migration
 * that ran against a different DB than the server reads would be the worst
 * possible outcome here, and sharing the builder makes it impossible.
 *
 * `--force` is required: Laravel refuses to migrate a production environment
 * interactively, and `APP_ENV` is `production` in the packaged app.
 */
interface ArtisanResult {
  /** Process exit code, or null when it never got that far. */
  readonly code: number | null;
  /** stdout and stderr, interleaved in arrival order. */
  readonly output: string;
  /** Set when the process could not be started or did not finish in time. */
  readonly failure?: string;
}

/**
 * Runs one artisan command with the packaged PHP and resolves with its result.
 *
 * Deliberately does NOT reject on a non-zero exit: "the command ran and said
 * no" is a different thing from "the command could not run", and the two
 * callers here want to treat them differently — a failed migration is fatal,
 * an admin account that already exists is not.
 *
 * `secretStdin` exists so a generated password never appears in argv, where
 * anything able to read the process table could see it.
 */
async function runArtisan(
  paths: RuntimePaths,
  appKey: string,
  commandArgs: readonly string[],
  options: { readonly timeoutMs: number; readonly secretStdin?: string },
): Promise<ArtisanResult> {
  const env = buildPhpEnv({
    port: 0, // unused by artisan; APP_URL is irrelevant here
    userDataPath: paths.userDataPath,
    backendPath: paths.backendPath,
    phpBinaryPath: paths.phpBinaryPath,
    routerScriptPath: paths.routerScriptPath,
    appKey,
  });

  const args = [
    '-d',
    'variables_order=EGPCS',
    path.join(paths.backendPath, 'artisan'),
    ...commandArgs,
  ];

  return new Promise<ArtisanResult>((resolve) => {
    const child = spawn(paths.phpBinaryPath, args, {
      cwd: paths.backendPath,
      env,
      stdio: [options.secretStdin === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let captured = '';
    const capture = (chunk: Buffer): void => {
      captured += chunk.toString('utf8');
    };
    child.stdout?.on('data', capture);
    child.stderr?.on('data', capture);

    if (options.secretStdin !== undefined) {
      child.stdin?.end(options.secretStdin, 'utf8');
    }

    let settled = false;
    const settle = (result: ArtisanResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill();
      settle({
        code: null,
        output: captured,
        failure: `artisan ${commandArgs[0] ?? ''} timed out after ${String(
          options.timeoutMs / 1000,
        )}s.`,
      });
    }, options.timeoutMs);

    child.once('error', (error) => {
      settle({ code: null, output: captured, failure: `Could not start PHP: ${error.message}` });
    });

    child.once('exit', (code) => {
      settle({ code, output: captured });
    });
  });
}

async function runMigrate(paths: RuntimePaths, appKey: string): Promise<void> {
  const result = await runArtisan(paths, appKey, ['migrate', '--force', '--no-interaction'], {
    timeoutMs: MIGRATE_TIMEOUT_MS,
  });

  if (result.failure !== undefined) {
    throw new MigrationFailedError(result.failure, result.code, result.output);
  }
  if (result.code !== 0) {
    throw new MigrationFailedError(
      `artisan migrate exited with code ${String(result.code)}.`,
      result.code,
      result.output,
    );
  }

  // Written to the same log directory the server uses, so "View logs" from the
  // failure dialog shows the migration too.
  const logFile = path.join(paths.userDataPath, 'logs', 'migrate.log');
  fs.appendFileSync(
    logFile,
    `\n[${new Date().toISOString()}] migrate --force\n${result.output}\n`,
  );
}

// ─── admin account ────────────────────────────────────────────────────────────

/**
 * A cryptographically random password over PASSWORD_ALPHABET.
 *
 * Rejection sampling rather than `byte % alphabet.length`. 256 is not a
 * multiple of 56, so the plain modulo makes the first 32 symbols of the
 * alphabet ~14% likelier than the rest. The practical entropy loss is small
 * (~116 bits either way) and nobody would ever notice — but this is the one
 * secret the whole feature exists to protect, and the correct version costs
 * one extra line and an average of 1.14 bytes per character.
 */
export function generatePassword(length: number = PASSWORD_LENGTH): string {
  const alphabet = PASSWORD_ALPHABET;
  // Largest multiple of the alphabet size that fits in a byte; bytes at or
  // above it are discarded rather than folded.
  const limit = 256 - (256 % alphabet.length);
  let password = '';

  while (password.length < length) {
    for (const byte of crypto.randomBytes(length)) {
      if (byte >= limit) {
        continue;
      }
      password += alphabet.charAt(byte % alphabet.length);
      if (password.length === length) {
        break;
      }
    }
  }

  return password;
}

function credentialsFilePath(userDataPath: string): string {
  return path.join(userDataPath, CREDENTIALS_FILE);
}

function renderCredentialsFile(email: string, password: string): string {
  return [
    'Kawdly People — Admin Credentials',
    '=================================',
    '',
    `Email:    ${email}`,
    `Password: ${password}`,
    '',
    'IMPORTANT:',
    '  - This password was generated for this installation only. No other',
    '    install of Kawdly People has the same one.',
    '  - Change it from Settings after your first login.',
    '  - Once you have stored the password somewhere safe, delete this file.',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
  ].join('\n');
}

/** Reads the password back out of a credentials file written by a prior run. */
function readStoredPassword(file: string): string | null {
  if (!fs.existsSync(file)) {
    return null;
  }
  const match = /^Password:\s*(.+)$/m.exec(fs.readFileSync(file, 'utf8'));
  const password = match?.[1]?.trim();

  return password === undefined || password === '' ? null : password;
}

/**
 * Creates the one administrator account for this installation.
 *
 * Returns the credentials to show the user, or null when there is an account
 * but no password we are entitled to claim (see below).
 *
 * ---------------------------------------------------------------------------
 * Why the credentials FILE is the idempotency guard
 * ---------------------------------------------------------------------------
 * The install marker is written after the password dialog is dismissed, so
 * closing the app while that dialog is open leaves `isFirstRun()` true — and
 * the next launch runs this function again against a database that already has
 * an admin in it. Keying off the file means that second run re-shows the same
 * password instead of failing on the unique email index, and the loop closes
 * only when the user actually acknowledges the dialog.
 *
 * The remaining hole is narrow and handled honestly: if the file is deleted but
 * the database is kept (and the marker is somehow still absent), there is an
 * account whose password nobody can recover. That is reported to the log and
 * the dialog is skipped, because inventing a new password here would silently
 * lock out a user who had already changed theirs.
 */
async function ensureAdminAccount(
  paths: RuntimePaths,
  appKey: string,
): Promise<AdminCredentials | null> {
  const file = credentialsFilePath(paths.userDataPath);

  const existing = readStoredPassword(file);
  if (existing !== null) {
    console.log('[first-run] admin credentials file already present; reusing it');

    return { email: ADMIN_EMAIL, password: existing, credentialsPath: file, created: false };
  }

  const password = generatePassword();
  const result = await runArtisan(
    paths,
    appKey,
    [
      'kawdly:create-admin',
      `--email=${ADMIN_EMAIL}`,
      `--name=${ADMIN_NAME}`,
      '--password-stdin',
      '--no-interaction',
    ],
    { timeoutMs: CREATE_ADMIN_TIMEOUT_MS, secretStdin: password },
  );

  if (result.code !== 0) {
    if (/already exists/i.test(result.output)) {
      console.warn(
        '[first-run] an admin account exists but no credentials file does. '
          + 'Not resetting the password: the existing one may be in use. '
          + `Output: ${result.output.trim()}`,
      );

      return null;
    }

    throw new MigrationFailedError(
      result.failure ?? `kawdly:create-admin exited with code ${String(result.code)}.`,
      result.code,
      result.output,
    );
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });
  // 0o600 is honoured on POSIX and a no-op on Windows, where the file inherits
  // the ACL of %APPDATA% — already per-user. Set anyway: this module is the
  // only thing standing between a generated password and a world-readable file
  // if the app is ever packaged for Linux.
  fs.writeFileSync(file, renderCredentialsFile(ADMIN_EMAIL, password), {
    encoding: 'utf8',
    mode: 0o600,
  });

  console.log(`[first-run] created ${ADMIN_EMAIL}; credentials at ${file}`);

  return { email: ADMIN_EMAIL, password, credentialsPath: file, created: true };
}

// ─── public entry points ──────────────────────────────────────────────────────

/**
 * Provisions a brand-new profile. Safe to re-run: every step checks first.
 *
 * Order matters. The key is generated before the database is touched because
 * `migrate` needs it in the environment, and the marker is written last so a
 * crash anywhere above leaves `isFirstRun()` true and the next launch retries.
 */
export async function initializeUserData(options: BootstrapOptions): Promise<void> {
  const { paths, appVersion, onProgress, onCredentials } = options;

  onProgress?.('جاري تجهيز التطبيق لأول مرة…');
  ensureUserDataTree(paths.userDataPath);

  const appKey = ensureAppKey(paths.userDataPath);

  onProgress?.('جاري تجهيز قاعدة البيانات…');
  const fromTemplate = ensureDatabase(paths);

  onProgress?.(fromTemplate ? 'جاري تحديث قاعدة البيانات…' : 'جاري إنشاء قاعدة البيانات…');
  await runMigrate(paths, appKey);

  // After migrate, because the account needs the schema; before the marker,
  // because an install whose password was never shown is not a finished
  // install. If the user closes the dialog's window instead of answering, the
  // marker stays absent and the next launch shows it again.
  onProgress?.('جاري إنشاء حساب المدير…');
  const credentials = await ensureAdminAccount(paths, appKey);
  if (credentials !== null) {
    await onCredentials?.(credentials);
  }

  writeMarker(paths.userDataPath, {
    version: appVersion,
    installedAt: new Date().toISOString(),
    lastMigratedAt: new Date().toISOString(),
    migrationFingerprint: migrationFingerprint(paths.backendPath),
  });

  console.log(
    `[first-run] provisioned ${paths.userDataPath} for ${appVersion} ` +
      `(template=${String(fromTemplate)}, admin=${String(credentials !== null)})`,
  );
}

/**
 * Upgrade path for an existing profile.
 *
 * Runs `artisan migrate --force` on EVERY launch, not only when the version
 * string changes.
 *
 * Why the version gate was wrong: `appVersion` is a release string, not a
 * schema version. Rebuilding 0.1.0 with four new migrations produced an
 * installer that looked like "same version" to the marker and skipped the
 * migrate entirely — observed 2026-10-26, when the installed profile was left
 * with 17 tables missing `company_id`, `leave_requests.approved_at` missing,
 * and writes to Recruitment/Documents/Payroll/Contracts/Attendance/Onboarding
 * answering HTTP 500. The upgrade path was fine for a version bump and
 * silently broken for a rebuild, which is exactly the build a beta tester
 * receives.
 *
 * Why always-migrate is safe: Laravel records applied migrations in the
 * `migrations` table and skips them, so a launch with nothing to do costs one
 * PHP spawn (~2s) behind the splash screen. A "did database/migrations change?"
 * gate would also work, but it is another moving part that can be wrong;
 * always-migrate cannot forget.
 *
 * The backup keys off BOTH the version and the migration fingerprint, so a
 * rebuild that adds migrations still copies the database aside before touching
 * it, while a plain relaunch does not accumulate one backup per start.
 */
export async function migrateIfNeeded(options: BootstrapOptions): Promise<void> {
  const { paths, appVersion, onProgress } = options;

  // Cheap repairs first: these cost nothing and fix a profile a user has
  // partially deleted (which does happen — people clean out "cache" folders).
  ensureUserDataTree(paths.userDataPath);
  const appKey = ensureAppKey(paths.userDataPath);
  ensureDatabase(paths);

  const marker = readMarker(paths.userDataPath);
  const previous = marker?.version ?? 'unknown';
  const fingerprint = migrationFingerprint(paths.backendPath);

  const versionChanged = marker === null || marker.version !== appVersion;
  const migrationsChanged = marker?.migrationFingerprint !== fingerprint;

  if (versionChanged || migrationsChanged) {
    const backup = backupDatabase(
      paths.userDataPath,
      versionChanged ? `upgrade-from-${previous}` : 'migrations-changed',
    );
    console.log(
      `[first-run] ${
        versionChanged ? `version ${previous} → ${appVersion}` : 'migration set changed'
      }; backup=${backup ?? '(none)'}; running migrate`,
    );
  }

  onProgress?.('جاري تحديث قاعدة البيانات…');
  await runMigrate(paths, appKey);

  // Rewritten on every launch: `lastMigratedAt` is the "did the migrate
  // actually run?" evidence a support session needs, and the fingerprint has
  // to move with it or the next launch would back the database up again.
  writeMarker(paths.userDataPath, {
    version: appVersion,
    installedAt: marker?.installedAt !== undefined && marker.installedAt !== ''
      ? marker.installedAt
      : new Date().toISOString(),
    lastMigratedAt: new Date().toISOString(),
    migrationFingerprint: fingerprint,
  });
}
