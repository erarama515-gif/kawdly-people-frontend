import { canOverrideRole, useRoleOverride } from '@/auth/session';
import type { Role } from '@/auth/session';

/**
 * DEV ONLY: temporary role source for design review. There is no auth yet, so
 * the active role comes from the (also temporary) header switcher instead of a
 * session. Swap this for a session/`useAuth()` role once auth lands, then remove
 * `RoleSwitcher` from the page header.
 */
export function useDashboardRoleOverride(): { role: Role; setRole: (role: Role) => void } {
  const { role, setRole } = useRoleOverride();
  if (!canOverrideRole) {
    return { role, setRole: () => {} };
  }
  return { role, setRole };
}
