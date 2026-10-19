/**
 * The bearer token lives here and nowhere else at module scope.
 *
 * This file is deliberately dependency-free: `session.ts` needs it to build
 * the authenticated session state, and `appHttpClient.ts` needs it to inject
 * the `Authorization` header on every request — including requests made
 * *from* `session.ts`'s own `authApi` calls. Putting the token here instead
 * of inside the Zustand store breaks that session -> http -> session cycle.
 *
 * The token is kept in memory (this module-level variable) rather than read
 * from storage on every request; `sessionStorage` is only used by the auth
 * store to survive a page reload, and `hydrateTokenFromStorage` below is the
 * one place that copies it back into memory at startup.
 */

let token: string | undefined;

export function getToken(): string | undefined {
  return token;
}

export function setToken(next: string | undefined): void {
  token = next;
}

/** `Authorization` header value, or undefined when signed out. */
export function getAuthorizationHeader(): string | undefined {
  return token ? `Bearer ${token}` : undefined;
}

/**
 * Minimal pub-sub so a 401 from *any* feature's HTTP call can end the
 * session, not just the dedicated `auth/me` check. `appHttpClient.ts` calls
 * `notifyUnauthorized` from its retry policy; `session.ts` is the sole
 * subscriber, clearing its state and letting `RequireAuth` redirect to
 * `/login`. Living here (rather than in `session.ts`) keeps the transport
 * layer able to report "the token no longer works" without importing the
 * Zustand store.
 */
const unauthorizedListeners = new Set<() => void>();

export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export function notifyUnauthorized(): void {
  for (const listener of unauthorizedListeners) listener();
}
