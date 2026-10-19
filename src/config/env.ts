/**
 * Build-time configuration. Everything the app needs to know about *where* data
 * comes from is resolved here, so no component or resource hardcodes a URL, a
 * timeout, or a polling cadence.
 *
 * The dashboard ships with an in-process mock API so the UI is fully
 * exercisable before the Laravel backend exists. Setting `VITE_API_BASE_URL`
 * (or `VITE_USE_MOCK_API=false`) switches every resource to real HTTP with no
 * other change — see `src/features/dashboard/api/client.ts`.
 */

function flag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value !== 'false' && value !== '0';
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/**
 * Shape of the object the Electron preload exposes on the window. Only the part
 * this module consumes is declared; the full contract lives in
 * `electron/src/desktop-config.ts`.
 */
interface KawdlyRuntimeConfig {
  readonly apiBaseUrl?: string;
}

/**
 * Runtime config wins over build-time config.
 *
 * The desktop build is a single static bundle served by a local PHP server on a
 * port that is only known at launch, so nothing about "where the API is" can be
 * baked in at `vite build` time. The Electron preload therefore publishes the
 * answer on `window.__KAWDLY_CONFIG__` *synchronously, before any module runs* —
 * which is why this read can happen here, at module-evaluation time, where the
 * value is already needed by the HTTP client's constructor.
 *
 * `globalThis` rather than `window` so the expression is also safe under a
 * non-DOM evaluation (tests, any future SSR/prerender step). In a plain web build
 * the key is simply absent and the `??` chain falls through to the Vite env var,
 * so this is a no-op there.
 */
const runtimeConfig = (globalThis as { __KAWDLY_CONFIG__?: KawdlyRuntimeConfig })
  .__KAWDLY_CONFIG__;

const apiBaseUrl =
  runtimeConfig?.apiBaseUrl?.trim() ?? import.meta.env.VITE_API_BASE_URL?.trim() ?? '';
const mockExplicitlyRequested = import.meta.env.VITE_USE_MOCK_API === 'true';

// Guard rail: a *production* build must never silently fall back to fabricated
// mock data just because VITE_API_BASE_URL was left unset by a misconfigured
// deploy pipeline. Mock data is only acceptable in prod if someone explicitly
// opted in via VITE_USE_MOCK_API=true. Dev builds keep the old convenience
// default (mock when no base URL) so `npm run dev` works with zero setup.
if (import.meta.env.PROD && apiBaseUrl === '' && !mockExplicitlyRequested) {
  throw new Error(
    'VITE_API_BASE_URL is not configured for this production build. Refusing to ' +
      'start with fabricated mock statistics — set VITE_API_BASE_URL (e.g. /api/v1) ' +
      'in the build environment, or set VITE_USE_MOCK_API=true if mock data is truly intended.',
  );
}

export const env = {
  isDev: import.meta.env.DEV,
  apiBaseUrl,
  /**
   * Mock is the default in dev whenever there is no API to talk to. Real HTTP
   * is used as soon as a base URL is configured, so a dev build pointed at a
   * local Laravel instance never silently returns fake numbers. In prod this
   * is gated by the guard above — see comment there.
   */
  useMockApi: flag(import.meta.env.VITE_USE_MOCK_API, apiBaseUrl === ''),
  requestTimeoutMs: positiveInt(import.meta.env.VITE_REQUEST_TIMEOUT_MS, 10_000),
  requestRetries: positiveInt(import.meta.env.VITE_REQUEST_RETRIES, 2),
  requestBackoffMs: positiveInt(import.meta.env.VITE_REQUEST_BACKOFF_MS, 400),
  /**
   * How often live dashboard resources revalidate. Matches the "5-60min" Redis
   * query cache window from the architecture spec while staying responsive
   * enough for an approvals queue.
   */
  dashboardPollMs: positiveInt(import.meta.env.VITE_DASHBOARD_POLL_MS, 60_000),
} as const;

export type Env = typeof env;
