import { useTranslation } from 'react-i18next';
import { resolveLocaleText } from '../model';
import type { DashboardQuickAction, DecisionQueueRow, QueueId } from '../model';
import type { SessionUser } from '@/auth/session';
import type { Role } from '@/auth/session';
import { QuickActions } from './QuickActions';
import { RoleSwitcher } from './RoleSwitcher';

interface HeroHeaderProps {
  user: SessionUser;
  role: Role;
  roleLabel: string;
  today: string;
  rows: DecisionQueueRow[];
  counts: Record<QueueId, number>;
  removing: ReadonlySet<QueueId>;
  actions?: DashboardQuickAction[];
}

/**
 * Dashboard header — simplified to match the new design. Shows:
 * - Date + role meta line
 * - Large greeting with user name
 * - Quick action buttons
 *
 * No oversized photo or decisions sentence — those are handled by the KPI
 * strip's "Open actions" panel and the DecisionQueue below.
 */
export function HeroHeader({ user, role, roleLabel, today, actions }: HeroHeaderProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'en' ? 'en' : 'ar';
  const name = resolveLocaleText(user.name, language);

  return (
    <div className="-mx-4 md:-mx-12">
      <div className="flex flex-col gap-[14px] px-4 pb-[18px] pt-[22px] md:px-12">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="nums min-w-0 max-w-full truncate text-[11px] text-ink-muted">
            {today}
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span className="font-medium text-ink">{roleLabel}</span>
          </p>
          <RoleSwitcher />
        </div>

        <h1 className="text-[26px] font-bold leading-[1.3] tracking-[-0.2px] text-ink">
          {t('dashboard.greeting', { name })}
        </h1>

        <QuickActions role={role} actions={actions} />
      </div>
    </div>
  );
}
