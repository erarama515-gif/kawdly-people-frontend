import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { pathById } from '@/config/navigation';
import type { Role } from '@/auth/session';

type Tone = 'primary' | 'secondary' | 'tertiary';

interface QuickAction {
  labelKey: string;
  to: string;
  /** primary = coral pill (the single CTA), secondary = navy outline, tertiary = outline. */
  tone: Tone;
}

/**
 * Only the two roles with bespoke dashboard datasets have a bespoke action
 * set; every other real role (Permission Matrix) falls back to the admin
 * actions below rather than rendering nothing.
 */
const QUICK_ACTIONS: Partial<Record<Role, QuickAction[]>> = {
  hr_admin: [
    { labelKey: 'dashboard.quickActions.publishJob', to: pathById('recruitment'), tone: 'secondary' },
    { labelKey: 'dashboard.quickActions.runPayroll', to: pathById('payroll'), tone: 'secondary' },
    { labelKey: 'dashboard.quickActions.addEmployee', to: pathById('employees'), tone: 'primary' },
  ],
  department_manager: [
    { labelKey: 'dashboard.quickActions.requestLeave', to: pathById('leave'), tone: 'secondary' },
    { labelKey: 'dashboard.quickActions.manualAttendance', to: pathById('attendance'), tone: 'secondary' },
    { labelKey: 'dashboard.quickActions.startReview', to: pathById('performance'), tone: 'primary' },
  ],
};

/** Button styles adapted for light background (new dashboard design). */
const TONE_STYLES: Record<Tone, string> = {
  primary: 'bg-coral text-on-navy hover:brightness-110',
  secondary: 'border border-navy text-navy bg-surface hover:bg-surface-hover',
  tertiary: 'border border-navy text-navy bg-transparent hover:bg-surface-hover',
};

export function QuickActions({ role }: { role: Role }) {
  const { t } = useTranslation();
  const actions = QUICK_ACTIONS[role] ?? QUICK_ACTIONS.hr_admin ?? [];

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('dashboard.quickActions.label')}>
      {actions.map((action) => (
        <Link
          key={action.labelKey}
          to={action.to}
          className={cn(
            'inline-flex items-center gap-1.5 whitespace-nowrap px-3.5 py-[7px] text-[13px] font-semibold transition-colors duration-150 md:px-4',
            TONE_STYLES[action.tone],
          )}
        >
          {action.tone === 'primary' ? (
            <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
          ) : null}
          {t(action.labelKey)}
        </Link>
      ))}
    </div>
  );
}
