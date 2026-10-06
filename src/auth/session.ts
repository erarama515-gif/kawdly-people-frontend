import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { currentUser } from '@/config/currentUser';
import { env } from '@/config/env';
import { STORAGE_KEYS } from '@/lib/language';

/**
 * The authentication seam.
 *
 * There is no backend yet, so the session is derived from the single mock user
 * in `config/currentUser`. Everything downstream (dashboard datasets, route
 * guards, permission checks) reads the role from here rather than from a
 * feature-local store, so replacing this file with a real `useAuth()` backed by
 * Sanctum is a one-file change.
 *
 * `04-Permission-Matrix.md` defines the full 10-role vocabulary. Only the two
 * roles the dashboard currently has datasets for are declared here; widening
 * `ROLES` without a dataset per role would produce an empty dashboard rather
 * than an obviously wrong one, so the type is the checklist.
 */

export const ROLES = ['hr_admin', 'manager'] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export interface SessionUser {
  name: { ar: string; en: string };
  initials: { ar: string; en: string };
  email: string;
  photo: string;
}

export interface Session {
  user: SessionUser;
  role: Role;
  /** True when the role came from the dev switcher rather than a real claim. */
  isRoleOverridden: boolean;
}

interface SessionState extends Session {
  setRole: (role: Role) => void;
  clearRoleOverride: () => void;
}

const AUTHENTICATED_ROLE: Role = isRole(currentUser.role) ? currentUser.role : 'hr_admin';

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      user: currentUser,
      role: AUTHENTICATED_ROLE,
      isRoleOverridden: false,
      setRole: (role) => set({ role, isRoleOverridden: true }),
      clearRoleOverride: () => set({ role: AUTHENTICATED_ROLE, isRoleOverridden: false }),
    }),
    {
      name: STORAGE_KEYS.session,
      // The user identity is never a client-owned value; only the dev override is.
      partialize: (state) =>
        state.isRoleOverridden ? { role: state.role, isRoleOverridden: true } : {},
    },
  ),
);

/**
 * Convenience hooks for components; each returns only what it needs.
 *
 * Selectors return the primitive fields directly rather than a fresh object —
 * `useSyncExternalStore` compares snapshots with `Object.is`, so building a new
 * object per call would re-render forever.
 */
export function useSession(): Pick<Session, 'user' | 'role'> {
  const user = useSessionStore((state) => state.user);
  const role = useSessionStore((state) => state.role);
  return { user, role };
}

export function useRoleOverride(): { role: Role; setRole: (role: Role) => void; isOverridden: boolean } {
  const role = useSessionStore((state) => state.role);
  const setRole = useSessionStore((state) => state.setRole);
  const isOverridden = useSessionStore((state) => state.isRoleOverridden);
  return { role, setRole, isOverridden };
}

/** Dev-only affordance for reviewing role-scoped designs before auth lands. */
export const canOverrideRole = env.isDev;
