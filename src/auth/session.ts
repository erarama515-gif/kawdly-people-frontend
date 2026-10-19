import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { env } from '@/config/env';
import { STORAGE_KEYS } from '@/lib/language';
import { authApi } from './api';
import type { LoginInput } from './api';
import { deriveDisplayIdentity } from './identity';
import { getToken, onUnauthorized, setToken } from './token';

/**
 * The authentication seam.
 *
 * Backed by `AuthController` (Sanctum bearer tokens) rather than the old
 * single mock user. `04-Permission-Matrix.md` defines the full 10-role
 * vocabulary — every real account has exactly one or more of these roles,
 * so (unlike the pre-auth version) the type is not limited to the two roles
 * the dashboard happens to have bespoke datasets for; a feature with no
 * role-specific UI yet simply renders its existing default view.
 *
 * The token lives in `auth/token.ts` (in-memory) and is mirrored into
 * `sessionStorage` (never `localStorage`, to bound an XSS token leak to the
 * current tab/session) so a reload doesn't force a re-login.
 */

export const ROLES = [
  'super_admin',
  'hr_admin',
  'hr_manager',
  'hr_officer',
  'payroll_manager',
  'recruiter',
  'department_manager',
  'employee',
  'finance',
  'auditor',
] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** `employee` is the Permission Matrix's baseline role every account carries, so it's the safe default if none of the backend's `roles` are recognised. */
function primaryRole(roles: string[]): Role {
  return roles.find(isRole) ?? 'employee';
}

export interface SessionUser {
  /** Numeric `users.id` of the authenticated account (from `AuthUserWire.id`). */
  id: number;
  /**
   * `employees.company_id` when the account has a linked employee. Most
   * company-scoped write payloads still need a company_id even though
   * `BelongsToCompany` overwrites it server-side for non-privileged users.
   */
  companyId?: number;
  name: { ar: string; en: string };
  initials: { ar: string; en: string };
  email: string;
  photo: string;
}

export type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'unauthenticated';

export interface Session {
  user: SessionUser | null;
  role: Role | null;
  /** True when the role came from the dev switcher rather than the server claim. */
  isRoleOverridden: boolean;
  status: AuthStatus;
}

interface SessionState extends Session {
  /** The role the backend actually issued — `role` tracks this unless overridden. */
  authenticatedRole: Role | null;
  permissions: string[];
  token: string | undefined;

  login: (input: LoginInput) => Promise<void>;
  logout: (options?: { skipRequest?: boolean }) => void;
  /** Revalidates a persisted token on app start; no-ops if there is none. */
  bootstrap: () => Promise<void>;
  setRole: (role: Role) => void;
  clearRoleOverride: () => void;
}

const SIGNED_OUT = {
  user: null,
  role: null,
  authenticatedRole: null,
  permissions: [],
  isRoleOverridden: false,
  token: undefined,
} satisfies Omit<SessionState, 'status' | 'login' | 'logout' | 'bootstrap' | 'setRole' | 'clearRoleOverride'>;

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      ...SIGNED_OUT,
      status: 'idle',

      login: async ({ email, password }) => {
        set({ status: 'authenticating' });
        try {
          const result = await authApi.login({ email, password });
          setToken(result.token);
          const role = primaryRole(result.roles);
          set({
            user: deriveDisplayIdentity(result.user),
            role,
            authenticatedRole: role,
            permissions: result.permissions,
            isRoleOverridden: false,
            token: result.token,
            status: 'authenticated',
          });
        } catch (error) {
          set({ status: 'unauthenticated' });
          throw error;
        }
      },

      logout: (options = {}) => {
        // Idempotent: a 401 from an already-signed-out session must not
        // re-trigger a logout request and loop forever.
        if (get().status === 'unauthenticated' && !getToken()) return;
        const hadToken = Boolean(getToken());
        setToken(undefined);
        if (hadToken && !options.skipRequest) {
          void authApi.logout().catch(() => {
            // Best-effort revoke; the local session is cleared either way.
          });
        }
        set({ ...SIGNED_OUT, status: 'unauthenticated' });
      },

      bootstrap: async () => {
        if (!getToken()) {
          set({ status: 'unauthenticated' });
          return;
        }
        set({ status: 'authenticating' });
        try {
          const result = await authApi.me();
          const role = primaryRole(result.roles);
          const { isRoleOverridden, role: currentRole } = get();
          set({
            user: deriveDisplayIdentity(result.user),
            authenticatedRole: role,
            role: isRoleOverridden && currentRole ? currentRole : role,
            permissions: result.permissions,
            status: 'authenticated',
          });
        } catch {
          // Persisted token is stale or revoked — start over from signed out.
          setToken(undefined);
          set({ ...SIGNED_OUT, status: 'unauthenticated' });
        }
      },

      setRole: (role) => set({ role, isRoleOverridden: true }),
      clearRoleOverride: () => set((state) => ({ role: state.authenticatedRole, isRoleOverridden: false })),
    }),
    {
      name: STORAGE_KEYS.session,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        role: state.role,
        authenticatedRole: state.authenticatedRole,
        permissions: state.permissions,
        isRoleOverridden: state.isRoleOverridden,
      }),
      // The in-memory token (read by every HTTP request) is a separate module
      // from this store's state, so a reload needs to copy it back in once
      // sessionStorage has been read.
      onRehydrateStorage: () => (state) => {
        if (state?.token) setToken(state.token);
      },
    },
  ),
);

// A 401 from any feature's HTTP call (not just the login/me endpoints) means
// the token no longer works — end the session so `RequireAuth` redirects to
// `/login`. `skipRequest` avoids firing a doomed logout request with the
// same dead token.
onUnauthorized(() => useSessionStore.getState().logout({ skipRequest: true }));

/**
 * Convenience hooks for components; each returns only what it needs.
 *
 * Selectors return the primitive fields directly rather than a fresh object —
 * `useSyncExternalStore` compares snapshots with `Object.is`, so building a new
 * object per call would re-render forever.
 *
 * `useSession()` asserts a non-null user/role: it is only ever safe to call
 * from inside `<RequireAuth>`'s subtree, which guarantees both are populated
 * before rendering children.
 */
export function useSession(): { user: SessionUser; role: Role } {
  const user = useSessionStore((state) => state.user);
  const role = useSessionStore((state) => state.role);
  if (!user || !role) {
    throw new Error('useSession() was called outside <RequireAuth> — no authenticated session is available.');
  }
  return { user, role };
}

export function useAuthStatus(): AuthStatus {
  return useSessionStore((state) => state.status);
}

/**
 * The authenticated user's numeric id, for non-React code paths (pure payload
 * builders, module-level helpers) that cannot call `useSession()`.
 *
 * Feature forms only render inside `<RequireAuth>`, so `user` is populated in
 * practice. Throwing here makes a call from outside an authenticated session
 * fail loudly instead of silently writing `created_by: 0` / `updated_by: 0`.
 * The Laravel controllers overwrite those fields server-side, but a wrong
 * client value still hides the real wiring bug.
 */
export function getCurrentUserId(): number {
  const user = useSessionStore.getState().user;
  if (!user) {
    throw new Error('getCurrentUserId() called without an authenticated session');
  }
  return user.id;
}

/**
 * True once the backend's `permissions` claim for the current session includes
 * `permission`. Components use this to hide/disable actions the user's role
 * can't perform — the backend still enforces the real check, this is purely
 * so a 403 isn't the first feedback a user gets.
 */
export function useHasPermission(permission: string): boolean {
  return useSessionStore((state) => state.permissions.includes(permission));
}

export function useRoleOverride(): { role: Role; setRole: (role: Role) => void; isOverridden: boolean } {
  const role = useSessionStore((state) => state.role);
  const setRole = useSessionStore((state) => state.setRole);
  const isOverridden = useSessionStore((state) => state.isRoleOverridden);
  if (!role) {
    throw new Error('useRoleOverride() was called outside <RequireAuth> — no authenticated session is available.');
  }
  return { role, setRole, isOverridden };
}

/** Dev-only affordance for reviewing role-scoped designs before every role has real UI. */
export const canOverrideRole = env.isDev;
