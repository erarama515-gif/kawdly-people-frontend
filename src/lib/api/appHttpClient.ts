import { getAuthorizationHeader, notifyUnauthorized } from '@/auth/token';
import { env } from '@/config/env';
import type { ApiError } from './errors';
import { createHttpClient } from './http';

/**
 * The one authenticated `HttpClient` instance for the whole app.
 *
 * Every feature's `client.ts` used to call `createHttpClient({...})` itself,
 * each duplicating the same base URL / timeout / retry config and — more
 * importantly — never passing `getAuthorization`, so no request ever carried
 * the signed-in user's bearer token. This is that one shared instance, wired
 * to `auth/token.ts` so every feature authenticates the same way with no
 * per-feature wiring.
 *
 * `token.ts` has no imports of its own, so depending on it here does not
 * create a cycle even though `auth/session.ts` (which owns login/logout)
 * itself ends up depending on this file through `auth/api.ts`.
 */
export const appHttpClient = createHttpClient({
  baseUrl: env.apiBaseUrl || '/api/v1',
  timeoutMs: env.requestTimeoutMs,
  retries: env.requestRetries,
  backoffMs: env.requestBackoffMs,
  getAuthorization: getAuthorizationHeader,
  // A 401 from *any* endpoint means the token is gone or revoked — broadcast
  // it so the session store can clear itself and RequireAuth can redirect to
  // /login, instead of each feature silently surfacing "session expired" in
  // its own error strip. The retry decision itself is unchanged (401s were
  // never retryable).
  shouldRetry: (error: ApiError, attempt: number) => {
    if (error.status === 401) notifyUnauthorized();
    return error.retryable && attempt < 3;
  },
});
