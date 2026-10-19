import { useEffect, useSyncExternalStore } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSessionStore } from './session';

/**
 * Layout-route guard wrapping every authenticated route (see `App.tsx`).
 *
 * On first mount it revalidates a persisted `sessionStorage` token against
 * `GET /auth/me` (status starts `idle`); a 401 from *any* request later in
 * the session routes through `auth/token.ts`'s `onUnauthorized` and ends up
 * here too, since both paths flow through the same `status` field.
 *
 * RACE-CONDITION FIX (Sprint 1, task 1.3):
 * Zustand's `persist` middleware rehydrates asynchronously from
 * `sessionStorage`. If `bootstrap()` fires before rehydration completes,
 * `getToken()` returns `undefined` (the in-memory token hasn't been copied
 * back yet), so bootstrap immediately sets `status: 'unauthenticated'` and
 * the user sees a flash redirect to `/login`.
 *
 * Fix: we subscribe to `persist.onFinishHydration` and only call
 * `bootstrap()` once hydration is confirmed complete. This ensures the
 * in-memory token is populated before any API call fires.
 */

/** Subscribe to Zustand persist hydration state. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      // If already hydrated, no need to subscribe
      if (useSessionStore.persist.hasHydrated()) return () => {};
      // Otherwise listen for the finish event
      const unsub = useSessionStore.persist.onFinishHydration(onStoreChange);
      return unsub;
    },
    () => useSessionStore.persist.hasHydrated(),
    () => false, // server snapshot
  );
}

export function RequireAuth() {
  const status = useSessionStore((state) => state.status);
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const location = useLocation();
  const hydrated = useHydrated();

  useEffect(() => {
    // Only bootstrap after persist hydration has restored the token
    if (hydrated && status === 'idle') void bootstrap();
  }, [hydrated, status, bootstrap]);

  // Show spinner while waiting for hydration or authentication
  if (!hydrated || status === 'idle' || status === 'authenticating') {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-faint" aria-hidden="true" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
