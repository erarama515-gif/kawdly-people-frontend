import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { canOverrideRole } from '@/auth/session';
import { useDashboardRoleOverride } from '../useDashboardRoleOverride';
import type { Role } from '@/auth/session';

const OPTIONS: Array<{ value: Role; labelKey: string }> = [
  { value: 'hr_admin', labelKey: 'dashboard.roleSwitch.admin' },
  { value: 'department_manager', labelKey: 'dashboard.roleSwitch.manager' },
];

/**
 * DEV ONLY segmented role switcher — see useDashboardRoleOverride.
 * Rendered as a navy segmented control inside the hero.
 */
export function RoleSwitcher() {
  const { t } = useTranslation();
  const { role, setRole } = useDashboardRoleOverride();

  if (!canOverrideRole) return null;

  return (
    <div
      role="group"
      aria-label={t('dashboard.roleSwitch.label')}
      className="inline-flex items-center whitespace-nowrap rounded-full bg-on-navy-fill-12 p-[3px] text-[12px]"
    >
      {OPTIONS.map((option) => {
        const active = role === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => setRole(option.value)}
            className={cn(
              'cursor-pointer rounded-full px-3.5 py-[5px] transition-colors duration-150',
              active
                ? 'bg-on-navy font-semibold text-navy'
                : 'text-on-navy-muted-85 hover:text-on-navy',
            )}
          >
            {t(option.labelKey)}
          </button>
        );
      })}
    </div>
  );
}