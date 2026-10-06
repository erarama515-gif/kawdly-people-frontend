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
  /** primary = coral pill (the single CTA), secondary = white, tertiary = outline. */
  tone: Tone;
}

const QUICK_ACTIONS: Record<Role, QuickAction[]> = {
  hr_admin: [
    { labelKey: 'dashboard.quickActions.addEmployee', to: pathById('employees'), tone: 'primary' },
    { labelKey: 'dashboard.quickActions.runPayroll', to: pathById('payroll'), tone: 'secondary' },
    { labelKey: 'dashboard.quickActions.publishJob', to: pathById('recruitment'), tone: 'tertiary' },
  ],
  manager: [
    { labelKey: 'dashboard.quickActions.startReview', to: pathById('performance'), tone: 'primary' },
    { labelKey: 'dashboard.quickActions.requestLeave', to: pathById('leave'), tone: 'secondary' },
    { labelKey: 'dashboard.quickActions.manualAttendance', to: pathById('attendance'), tone: 'tertiary' },
  ],
};

const TONE_STYLES: Record<Tone, string> = {
  primary: 'rounded-full bg-coral text-on-navy hover:bg-coral-hover',
  secondary: 'rounded-[3px] bg-surface text-navy hover:bg-surface-hover',
  tertiary: 'rounded-[3px] border-[1.5px] border-on-navy text-on-navy hover:bg-on-navy-fill-12',
};

export function QuickActions({ role }: { role: Role }) {
  const { t } = useTranslation();
  const actions = QUICK_ACTIONS[role];

  return (
    <div className="flex flex-wrap items-center gap-2 md:gap-3" role="group" aria-label={t('dashboard.quickActions.label')}>
      {actions.map((action) => (
        <Link
          key={action.labelKey}
          to={action.to}
          className={cn(
            'inline-flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-[13px] font-semibold transition-colors duration-150 md:px-[26px] md:py-3 md:text-[15px]',
            TONE_STYLES[action.tone],
          )}
        >
          {action.tone === 'primary' ? (
            <Plus className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" strokeWidth={2} aria-hidden="true" />
          ) : null}
          {t(action.labelKey)}
        </Link>
      ))}
    </div>
  );
}