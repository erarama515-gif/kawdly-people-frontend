/**
 * Kawdly People — backend readiness probe (T3).
 *
 * Why this is not a one-line `fetch('/up')`:
 *
 * E1 established that **HTTP 200 is not proof of health**. PHP's built-in server
 * answers 200 with an error page in the body for a fatal error raised during
 * bootstrap (no APP_KEY, unreadable SQLite file, a missing extension), because the
 * fatal happens after headers are sent. A probe that only checks the status code
 * therefore reports "ready" and the user gets a blank or broken window. Every
 * check below asserts on the *body*.
 *
 * Two stages, deliberately:
 *   1. `/up` — Laravel's framework-level health route. Proves PHP booted, the
 *      framework container built, Blade compiled a view (so KAWDLY_STORAGE_PATH is
 *      writable) and routing works. Its view renders "Application
 *      {{ $exception ? 'experiencing problems' : 'up' }}", so the literal string
 *      "Application up" is a real assertion, not a tautology — a bootstrap
 *      exception renders the other branch with the same 200 status.
 *   2. `/api/v1/health` — the app's own check (`routes/api/health.php`): a real
 *      `SELECT 1` through PDO, a cache round-trip, and a disk-space check. Proves
 *      the SQLite file in userData is openable and the `cache` table exists. It
 *      returns `status: "degraded"` with HTTP 503 when a subsystem is down.
 *
 * `node:http` rather than `fetch` on purpose: this runs in the main process before
 * any window exists, needs no TLS, and must not depend on Electron's net stack
 * being initialised.
 */

import * as http from 'node:http';

const BIND_HOST = '127.0.0.1';

/** Per-request ceiling. Generous: the first request pays Laravel's cold boot. */
const REQUEST_TIMEOUT_MS = 4_000;

/** The exact string Laravel's health-up view renders when nothing threw. */
const UP_MARKER = 'Application up';

export interface ReadinessOptions {
  /** Number of `/up` attempts before giving up. */
  maxAttempts: number;
  /** Delay between attempts, in milliseconds. */
  intervalMs: number;
  /** Optional progress callback, for the splash window. 1-based attempt. */
  onProgress?: (attempt: number, maxAttempts: number) => void;
}

interface ProbeResult {
  status: number;
  body: string;
}

/** Thrown when the backend never became ready. Carries diagnostics for the UI. */
export class BackendNotReadyError extends Error {
  constructor(
    message: string,
    readonly stage: 'up' | 'health',
    readonly attempts: number,
    readonly lastStatus: number | null,
    readonly lastBody: string,
  ) {
    super(message);
    this.name = 'BackendNotReadyError';
  }
}

function request(port: number, urlPath: string): Promise<ProbeResult> {
  return new Promise<ProbeResult>((resolve, reject) => {
    const req = http.request(
      {
        host: BIND_HOST,
        port,
        path: urlPath,
        method: 'GET',
        // Identifies the probe in the access log (which server.php writes to
        // stdout), so a log tail distinguishes probe traffic from the renderer.
        headers: { Accept: '*/*', 'User-Agent': 'kawdly-desktop-readiness' },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`timeout after ${String(REQUEST_TIMEOUT_MS)}ms`));
    });
    req.on('error', reject);
    req.end();
  });
}

function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Resolves once the backend is serving and healthy.
 *
 * @throws {BackendNotReadyError} with the last status and body, so the error
 *         window can show something more useful than "startup failed".
 */
export async function waitForBackend(port: number, opts: ReadinessOptions): Promise<void> {
  let lastStatus: number | null = null;
  let lastBody = '';

  // ── Stage 1: /up ────────────────────────────────────────────────────────────
  let up = false;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt += 1) {
    opts.onProgress?.(attempt, opts.maxAttempts);

    try {
      const result = await request(port, '/up');
      lastStatus = result.status;
      lastBody = result.body;

      if (result.status === 200 && result.body.includes(UP_MARKER)) {
        up = true;
        break;
      }
      // A 200 WITHOUT the marker is the E1 failure mode: PHP answered but
      // bootstrap threw. Retrying is still correct (the first request can race
      // the server's socket being ready), but the body is kept for the report.
    } catch (error) {
      // ECONNREFUSED while the server is still binding is the normal case.
      lastStatus = null;
      lastBody = error instanceof Error ? error.message : String(error);
    }

    if (attempt < opts.maxAttempts) {
      await delay(opts.intervalMs);
    }
  }

  if (!up) {
    throw new BackendNotReadyError(
      `Backend did not answer /up with "${UP_MARKER}" after ${String(opts.maxAttempts)} attempts ` +
        `(~${String(Math.round((opts.maxAttempts * opts.intervalMs) / 1000))}s).`,
      'up',
      opts.maxAttempts,
      lastStatus,
      lastBody,
    );
  }

  // ── Stage 2: /api/v1/health (single shot — /up already proved PHP is alive) ──
  let health: ProbeResult;
  try {
    health = await request(port, '/api/v1/health');
  } catch (error) {
    throw new BackendNotReadyError(
      `/up passed but /api/v1/health could not be reached: ${
        error instanceof Error ? error.message : String(error)
      }`,
      'health',
      1,
      null,
      '',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(health.body);
  } catch {
    throw new BackendNotReadyError(
      '/api/v1/health did not return JSON. This usually means a PHP error page was ' +
        'rendered with a 200 status — read php-stderr.log.',
      'health',
      1,
      health.status,
      health.body,
    );
  }

  const status = (parsed as { status?: unknown }).status;
  if (status !== 'ok') {
    throw new BackendNotReadyError(
      `/api/v1/health reported status="${String(status)}" (expected "ok").`,
      'health',
      1,
      health.status,
      health.body,
    );
  }
}
