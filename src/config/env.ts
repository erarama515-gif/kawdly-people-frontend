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

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';

export const env = {
  isDev: import.meta.env.DEV,
  apiBaseUrl,
  /**
   * Mock is the default whenever there is no API to talk to. Real HTTP is used
   * as soon as a base URL is configured, so a dev build pointed at a local
   * Laravel instance never silently returns fake numbers.
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
