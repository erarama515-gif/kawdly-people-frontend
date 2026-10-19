/**
 * Kawdly People — update notification (T6).
 *
 * ---------------------------------------------------------------------------
 * Why this NOTIFIES instead of updating
 * ---------------------------------------------------------------------------
 * `Electron-Packaging-Design.md` §7 decision 4 locks "manual installers for v1,
 * `electron-updater` in v2", and §4.7 attaches a precondition to v2: the
 * artifacts must be signed. Signing is session T5b, which the Phase 1 zero-card
 * policy forbids outright — so the v2 precondition is not merely unmet, it is
 * unreachable for the next twelve months. Shipping `electron-updater` anyway
 * would mean an unsigned binary silently replacing itself from a feed whose
 * publisher nothing can verify. That is a worse trust story than the status quo,
 * where the user makes one deliberate decision at install time.
 *
 * So this module does the one genuinely useful thing that costs no trust: it
 * finds out whether a newer version exists and tells the user, who then
 * downloads it the same way they got the first one.
 *
 * Two further constraints pointed at the same design:
 *
 *   - `electron-builder.yml` excludes `node_modules` from the asar, because the
 *     main process imports only `electron` and node: builtins. Adding
 *     `electron-updater` (or even a `semver` helper) would make the PACKAGED app
 *     die with MODULE_NOT_FOUND while dev kept working. Hence the hand-rolled
 *     comparison below — it is twenty lines and it keeps that invariant intact.
 *   - The founder publishes releases from the Kawdly website, not GitHub
 *     Releases. The repositories are private; the GitHub provider would need a
 *     token at download time, and any token shipped inside the app is plain text
 *     inside the asar for every beta user to read.
 *
 * ---------------------------------------------------------------------------
 * Failure is always silent
 * ---------------------------------------------------------------------------
 * Offline, DNS failure, 404, HTML served instead of JSON, a malformed version
 * string: every one of these returns null and logs. An update check must never
 * be able to interrupt someone opening their HR records, so there is no error
 * dialog anywhere in this file.
 */

import { dialog, net, shell } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * THE ONE LINE TO CHANGE when the website is ready.
 *
 * Deliberately null rather than a guessed path: as of 2026-10-20 every candidate
 * URL on kawdly.vercel.app returns 404, and inventing one would produce a
 * feature that silently never fires while looking configured. Null means
 * "not configured", which `checkForUpdate` reports explicitly in the log.
 *
 * Expected document at that URL (static JSON, public, no auth):
 *   {
 *     "version":     "0.2.0",
 *     "downloadUrl": "https://kawdly.vercel.app/download",
 *     "notesAr":     "اختياري — سطر أو اتنين عن الجديد"
 *   }
 */
const UPDATE_FEED_URL: string | null = null;

/**
 * Only this host may be handed to `shell.openExternal`.
 *
 * Compared as a full host equality, NOT a string prefix. `startsWith(
 * 'https://kawdly.vercel.app')` would happily accept
 * `https://kawdly.vercel.app.attacker.example/`, and `main.ts` (see the
 * `setWindowOpenHandler` comment) already spells out why an attacker-chosen URL
 * reaching `openExternal` is how a content compromise becomes local program
 * execution.
 */
const DOWNLOAD_HOST = 'kawdly.vercel.app';

/** One check per day. The app is opened many times a day; the feed changes rarely. */
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** A feed that has not answered in ten seconds is not going to be useful. */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * A version manifest is a few hundred bytes. This cap is what stops a
 * misconfigured route that returns the whole SPA — or a hostile redirect to
 * something enormous — from being buffered into memory.
 */
const MAX_BODY_BYTES = 64 * 1024;

/** Where the throttle state lives, relative to userData. */
const STATE_FILE = path.join('data', 'update-check.json');

export interface UpdateManifest {
  readonly version: string;
  readonly downloadUrl: string;
  readonly notesAr: string | null;
}

interface UpdateCheckState {
  readonly lastCheckedAt: string | null;
  readonly dismissedVersion: string | null;
}

const EMPTY_STATE: UpdateCheckState = { lastCheckedAt: null, dismissedVersion: null };

export interface UpdateCheckOptions {
  readonly currentVersion: string;
  readonly userDataPath: string;
  /** Test seam: overrides UPDATE_FEED_URL. Never set in production code. */
  readonly feedUrl?: string;
  /** Test seam: bypasses the 24h throttle. */
  readonly force?: boolean;
}

// ─── version comparison ───────────────────────────────────────────────────────

/**
 * The numeric core of a version, or null if it is not a shape we understand.
 *
 * Returning null rather than guessing matters: a feed that answers "latest" or
 * "2026.10-beta" must mean "I cannot tell", never "newer than what you have".
 * An unparseable version can only ever suppress a notification, not cause one.
 */
function parseVersionCore(version: string): readonly number[] | null {
  const withoutBuild = version.trim().replace(/^v/i, '').split('+')[0] ?? '';
  const core = withoutBuild.split('-')[0] ?? '';
  const parts = core.split('.');

  if (parts.length === 0 || parts.length > 4) {
    return null;
  }

  const numbers: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,9}$/.test(part)) {
      return null;
    }
    numbers.push(Number(part));
  }

  return numbers;
}

function hasPrerelease(version: string): boolean {
  return (version.trim().replace(/^v/i, '').split('+')[0] ?? '').includes('-');
}

/**
 * True when `candidate` is strictly newer than `current`.
 *
 * Semver's prerelease rule is honoured in the one direction that matters here:
 * 0.2.0-rc1 is OLDER than 0.2.0, so shipping 0.2.0 to someone running the rc
 * still notifies, and a published rc never notifies someone on the final build.
 */
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = parseVersionCore(candidate);
  const b = parseVersionCore(current);

  if (a === null || b === null) {
    return false;
  }

  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left !== right) {
      return left > right;
    }
  }

  // Identical cores: the only remaining difference is a prerelease suffix.
  return hasPrerelease(current) && !hasPrerelease(candidate);
}

// ─── manifest ─────────────────────────────────────────────────────────────────

function isAllowedDownloadUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  return parsed.protocol === 'https:' && parsed.host === DOWNLOAD_HOST;
}

/** Shape-checks an arbitrary JSON body. Anything unexpected yields null. */
export function parseManifest(body: string): UpdateManifest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const { version, downloadUrl, notesAr } = record;

  if (typeof version !== 'string' || parseVersionCore(version) === null) {
    return null;
  }

  if (typeof downloadUrl !== 'string' || !isAllowedDownloadUrl(downloadUrl)) {
    console.warn('[update] manifest rejected: downloadUrl is not on the expected host');
    return null;
  }

  return {
    version: version.trim(),
    downloadUrl,
    notesAr: typeof notesAr === 'string' && notesAr.trim() !== '' ? notesAr.trim() : null,
  };
}

/**
 * GETs the feed through Electron's `net` module rather than `fetch`.
 *
 * `net` issues the request from the main process using Chromium's own stack, so
 * it picks up the system proxy and certificate store — and, more to the point,
 * it never touches a renderer. The Content-Security-Policy in `main.ts` governs
 * documents, so doing this here means the update check needs no CSP change
 * whatsoever. Widening that policy is forbidden by design §4.5 #9.
 */
async function fetchManifest(url: string): Promise<UpdateManifest | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: UpdateManifest | null): void => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(result);
      }
    };

    const request = net.request({ method: 'GET', url, redirect: 'follow' });

    const timer = setTimeout(() => {
      console.warn(`[update] feed timed out after ${String(REQUEST_TIMEOUT_MS)}ms`);
      request.abort();
      finish(null);
    }, REQUEST_TIMEOUT_MS);

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        // 404 is the EXPECTED answer until the website publishes the feed.
        console.warn(`[update] feed returned HTTP ${String(response.statusCode)}`);
        // abort() rather than draining the body: Electron's IncomingMessage is
        // not a full Node stream and has no resume(), and there is nothing in
        // an error page worth reading.
        request.abort();
        finish(null);
        return;
      }

      const chunks: Buffer[] = [];
      let total = 0;

      response.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > MAX_BODY_BYTES) {
          console.warn('[update] feed body exceeded the size cap');
          request.abort();
          finish(null);
          return;
        }
        chunks.push(chunk);
      });

      response.on('end', () => {
        finish(parseManifest(Buffer.concat(chunks).toString('utf8')));
      });

      response.on('error', () => {
        finish(null);
      });
    });

    request.on('error', (error: Error) => {
      // Offline is the common case here, not an exceptional one.
      console.warn(`[update] feed unreachable: ${error.message}`);
      finish(null);
    });

    request.end();
  });
}

// ─── throttle state ───────────────────────────────────────────────────────────

function readState(userDataPath: string): UpdateCheckState {
  try {
    const raw = fs.readFileSync(path.join(userDataPath, STATE_FILE), 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      lastCheckedAt: typeof parsed['lastCheckedAt'] === 'string' ? parsed['lastCheckedAt'] : null,
      dismissedVersion:
        typeof parsed['dismissedVersion'] === 'string' ? parsed['dismissedVersion'] : null,
    };
  } catch {
    // Missing or corrupt: treat as "never checked". Losing the throttle costs
    // one extra HTTP request; failing here would cost the notification entirely.
    return EMPTY_STATE;
  }
}

function writeState(userDataPath: string, state: UpdateCheckState): void {
  try {
    fs.writeFileSync(
      path.join(userDataPath, STATE_FILE),
      `${JSON.stringify(state, null, 2)}\n`,
      'utf8',
    );
  } catch (error) {
    console.warn(`[update] could not persist check state: ${String(error)}`);
  }
}

function isThrottled(state: UpdateCheckState, now: number): boolean {
  if (state.lastCheckedAt === null) {
    return false;
  }
  const last = Date.parse(state.lastCheckedAt);
  return Number.isFinite(last) && now - last < CHECK_INTERVAL_MS;
}

// ─── public entry point ───────────────────────────────────────────────────────

/**
 * Looks for a newer version and, if there is one, offers it.
 *
 * Fire-and-forget: `main.ts` does not await this, so nothing here can delay the
 * window appearing. Resolves to the version that was offered, or null.
 */
export async function maybeNotifyUpdate(options: UpdateCheckOptions): Promise<string | null> {
  const feedUrl = options.feedUrl ?? UPDATE_FEED_URL;

  if (feedUrl === null || feedUrl === undefined || feedUrl === '') {
    console.log('[update] no feed configured — skipping (see UPDATE_FEED_URL in update-check.ts)');
    return null;
  }

  const now = Date.now();
  const state = readState(options.userDataPath);

  if (options.force !== true && isThrottled(state, now)) {
    console.log('[update] checked within the last 24h — skipping');
    return null;
  }

  const manifest = await fetchManifest(feedUrl);
  const checkedAt = new Date(now).toISOString();

  if (manifest === null) {
    writeState(options.userDataPath, { ...state, lastCheckedAt: checkedAt });
    return null;
  }

  if (!isNewerVersion(manifest.version, options.currentVersion)) {
    console.log(`[update] up to date (installed ${options.currentVersion}, feed ${manifest.version})`);
    writeState(options.userDataPath, { ...state, lastCheckedAt: checkedAt });
    return null;
  }

  // Dismissing suppresses that specific version only, so the next release still
  // gets through. Without this the app would re-ask every single day.
  if (state.dismissedVersion === manifest.version) {
    console.log(`[update] ${manifest.version} was dismissed — not asking again`);
    writeState(options.userDataPath, { ...state, lastCheckedAt: checkedAt });
    return null;
  }

  const { response } = await dialog.showMessageBox({
    type: 'info',
    title: 'Kawdly People — تحديث متاح',
    message: `في نسخة جديدة: ${manifest.version}`,
    detail: [
      `النسخة المثبّتة عندك: ${options.currentVersion}`,
      manifest.notesAr === null ? '' : `\n${manifest.notesAr}`,
      '\nهيفتحلك صفحة التحميل في المتصفح. بياناتك كلها هتفضل زي ما هي بعد التحديث.',
    ]
      .filter((line) => line !== '')
      .join('\n'),
    buttons: ['تحميل التحديث', 'مش دلوقتي'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });

  if (response === 0) {
    // Re-validated at the point of use, not just at parse time: this is the call
    // that can launch a program, and it should not depend on a check made in a
    // different function three minutes ago.
    if (isAllowedDownloadUrl(manifest.downloadUrl)) {
      await shell.openExternal(manifest.downloadUrl);
    } else {
      console.error('[update] refused to open a download URL outside the allowed host');
    }
    writeState(options.userDataPath, { ...state, lastCheckedAt: checkedAt });
  } else {
    writeState(options.userDataPath, {
      lastCheckedAt: checkedAt,
      dismissedVersion: manifest.version,
    });
  }

  return manifest.version;
}
