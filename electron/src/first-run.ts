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
 * provisioned this profile. Its presence means "userData is usable"; its
 * version field drives the upgrade path. It is written LAST, after everything
 * else has succeeded, so a bootstrap that dies halfway is retried on the next
 * launch instead of leaving a profile that claims to be ready and is not.
 *
 * ---------------------------------------------------------------------------
 * Template database — v0.1 beta decision
 * ---------------------------------------------------------------------------
 * The installer ships `database/seed-template.sqlite`: the repository's SEEDED
 * development database (10 roles, 816 permissions, 53 demo employees, and the
 * `test@example.com` / `password` login). For a beta whose purpose is to get
 * the product in front of people, an empty app with no way in is worse than
 * obviously-fake data.
 *
 * This is a deliberate, dated trade and it MUST NOT reach 1.0:
 *   - every install shares the same demo records, so "my data" is not actually
 *     the user's data until they delete it;
 *   - a known-password account exists on every machine. It is a local-only,
 *     loopback-bound app with no network listener beyond 127.0.0.1, which is
 *     what makes this tolerable for a beta — and unacceptable the moment any
 *     remote surface exists.
 * v1.0 needs a clean-install flow: empty schema + a first-launch wizard that
 * creates the company and the first admin. Tracked in the completion plan.
 *
 * The APP_KEY, by contrast, is generated per install and never shipped.
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

/** A migration that has not finished in five minutes is not going to. */
const MIGRATE_TIMEOUT_MS = 5 * 60 * 1000;

interface InstallMarker {
  readonly version: string;
  readonly installedAt: string;
  readonly lastMigratedAt?: string;
}

export interface BootstrapOptions {
  readonly paths: RuntimePaths;
  /** Version of the running build, from `resolveAppVersion()` in main.ts. */
  readonly appVersion: string;
  /** Progress text for the splash. Called with user-facing Arabic. */
  readonly onProgress?: (message: string) => void;
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
async function runMigrate(paths: RuntimePaths, appKey: string): Promise<void> {
  const env = buildPhpEnv({
    port: 0, // unused by artisan; APP_URL is irrelevant to a migration
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
    'migrate',
    '--force',
    '--no-interaction',
  ];

  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn(paths.phpBinaryPath, args, {
      cwd: paths.backendPath,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let captured = '';
    const capture = (chunk: Buffer): void => {
      captured += chunk.toString('utf8');
    };
    child.stdout?.on('data', capture);
    child.stderr?.on('data', capture);

    const timer = setTimeout(() => {
      child.kill();
      reject(
        new MigrationFailedError(
          `Migration timed out after ${String(MIGRATE_TIMEOUT_MS / 1000)}s.`,
          null,
          captured,
        ),
      );
    }, MIGRATE_TIMEOUT_MS);

    child.once('error', (error) => {
      clearTimeout(timer);
      reject(new MigrationFailedError(`Could not start PHP: ${error.message}`, null, captured));
    });

    child.once('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(captured);
      } else {
        reject(
          new MigrationFailedError(
            `artisan migrate exited with code ${String(code)}.`,
            code,
            captured,
          ),
        );
      }
    });
  });

  // Written to the same log directory the server uses, so "View logs" from the
  // failure dialog shows the migration too.
  const logFile = path.join(paths.userDataPath, 'logs', 'migrate.log');
  fs.appendFileSync(logFile, `\n[${new Date().toISOString()}] migrate --force\n${output}\n`);
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
  const { paths, appVersion, onProgress } = options;

  onProgress?.('جاري تجهيز التطبيق لأول مرة…');
  ensureUserDataTree(paths.userDataPath);

  const appKey = ensureAppKey(paths.userDataPath);

  onProgress?.('جاري تجهيز قاعدة البيانات…');
  const fromTemplate = ensureDatabase(paths);

  onProgress?.(fromTemplate ? 'جاري تحديث قاعدة البيانات…' : 'جاري إنشاء قاعدة البيانات…');
  await runMigrate(paths, appKey);

  writeMarker(paths.userDataPath, {
    version: appVersion,
    installedAt: new Date().toISOString(),
    lastMigratedAt: new Date().toISOString(),
  });

  console.log(
    `[first-run] provisioned ${paths.userDataPath} for ${appVersion} ` +
      `(template=${String(fromTemplate)})`,
  );
}

/**
 * Upgrade path for an existing profile.
 *
 * Only acts when the installed version differs from the marker, so a normal
 * launch pays nothing: no PHP spawn, no file copy. Version STRINGS are
 * compared rather than ordered, which also covers a downgrade — running an
 * older build against a newer schema is exactly when a backup matters most.
 */
export async function migrateIfNeeded(options: BootstrapOptions): Promise<void> {
  const { paths, appVersion, onProgress } = options;

  // Cheap repairs first: these cost nothing and fix a profile a user has
  // partially deleted (which does happen — people clean out "cache" folders).
  ensureUserDataTree(paths.userDataPath);
  const appKey = ensureAppKey(paths.userDataPath);
  ensureDatabase(paths);

  const marker = readMarker(paths.userDataPath);
  if (marker !== null && marker.version === appVersion) {
    return;
  }

  const previous = marker?.version ?? 'unknown';
  onProgress?.('جاري تحديث قاعدة البيانات…');

  const backup = backupDatabase(paths.userDataPath, `upgrade-from-${previous}`);
  console.log(
    `[first-run] version changed ${previous} → ${appVersion}; ` +
      `backup=${backup ?? '(none)'}; running migrate`,
  );

  await runMigrate(paths, appKey);

  writeMarker(paths.userDataPath, {
    version: appVersion,
    installedAt: marker?.installedAt !== undefined && marker.installedAt !== ''
      ? marker.installedAt
      : new Date().toISOString(),
    lastMigratedAt: new Date().toISOString(),
  });
}
