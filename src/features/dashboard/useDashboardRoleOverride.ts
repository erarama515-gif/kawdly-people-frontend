import { canOverrideRole, useRoleOverride } from '@/auth/session';
import type { Role } from '@/auth/session';

/**
 * DEV ONLY: lets the header `RoleSwitcher` preview any role's dashboard
 * without actually signing in as that role — `useRoleOverride()` already
 * tracks whether the current role is the real authenticated one or a dev
 * override; this just no-ops the switch outside of dev builds.
 */
export function useDashboardRoleOverride(): { role: Role; setRole: (role: Role) => void } {
  const { role, setRole } = useRoleOverride();
  if (!canOverrideRole) {
    return { role, setRole: () => {} };
  }
  return { role, setRole };
}
