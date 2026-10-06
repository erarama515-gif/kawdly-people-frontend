import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/Avatar';
import { pathById } from '@/config/navigation';
import { resolveLocaleText } from '../model';
import type { DepartmentShare, TeamMember, UpcomingItem, UpcomingKind } from '../model';

const GROUP_ORDER: UpcomingKind[] = ['contract', 'birthday'];

/**
 * Upcoming — contracts and birthdays grouped by kind. Each group has a mono
 * count pill; items lead with a 40px photo avatar, name + contextual line, and
 * a timestamp pill (coral for the soonest, calm tone otherwise).
 */
export function UpcomingCard({
  items,
  language,
  className,
}: {
  items: UpcomingItem[];
  language: 'ar' | 'en';
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className={cn('flex flex-col bg-surface', className)}>
      <p className="border-b border-ink px-4 py-3.5 text-[22px] font-bold leading-[1.1] tracking-[-0.03em] text-ink md:px-6 md:py-4 md:text-[24px]">
        {t('dashboard.upcomingCard.title')}
      </p>

      {GROUP_ORDER.map((kind) => {
        const group = items.filter((item) => item.kind === kind);
        if (group.length === 0) return null;
        const labelKey =
          kind === 'contract' ? 'dashboard.upcomingCard.contractRenewals' : 'dashboard.upcomingCard.birthdays';

        return (
          <section key={kind}>
            <p className="flex items-center gap-2 px-4 pb-1.5 pt-3 uppercase text-[11px] font-semibold tracking-[0.08em] text-ink-muted md:px-6">
              <span>{t(labelKey)}</span>
              <span className="nums rounded-full bg-surface-hover px-2 py-px text-[10px] font-bold text-navy">
                {group.length}
              </span>
            </p>

            <ul className="flex flex-col">
              {group.map((item) => {
                const name = resolveLocaleText(item.name, language);
                const isUrgent = item.urgent === true;
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 border-b border-divider px-4 py-2.5 last:border-b-0 md:px-6"
                  >
                    <Avatar
                      initials={initialsOf(name)}
                      photo={item.photo}
                      size={40}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold tracking-[-0.015em] text-ink">
                        {name}
                      </span>
                      <span className="block truncate text-[12px] text-ink-muted">
                        {resolveLocaleText(item.meta, language)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold',
                        isUrgent ? 'bg-coral text-on-navy' : 'bg-surface-hover text-navy',
                      )}
                    >
                      {resolveLocaleText(item.when, language)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

const SHARE_COLORS = ['bg-navy', 'bg-navy-glow', 'bg-[#5B6B7A]', 'bg-coral'];

/**
 * Headcount by department — striped ledger track, navy bars (the last row,
 * Finance, reads coral per the reference), then a proportional share segment
 * bar with the four-largest-department caption and a view-all link.
 */
export function DepartmentsCard({
  rows,
  language,
  className,
}: {
  rows: DepartmentShare[];
  language: 'ar' | 'en';
  className?: string;
}) {
  const { t } = useTranslation();
  const max = Math.max(...rows.map((row) => row.count));
  const sum = rows.reduce((acc, row) => acc + row.count, 0);

  if (rows.length === 0) return null;

  return (
    <div className={cn('flex flex-col bg-surface', className)}>
      <p className="border-b border-ink px-4 py-3.5 text-[22px] font-bold leading-[1.1] tracking-[-0.03em] text-ink md:px-6 md:py-4 md:text-[24px]">
        {t('dashboard.departmentsCard.title')}
      </p>

      <ul className="flex flex-col px-4 md:px-6">
        {rows.map((row, index) => {
          const isLast = index === rows.length - 1;
          return (
            <li key={resolveLocaleText(row.name, language)}>
              <div className="flex items-center gap-4 py-2.5">
                <span className="w-[100px] shrink-0 truncate text-[14px] font-medium text-ink">
                  {resolveLocaleText(row.name, language)}
                </span>
                <span
                  className="flex h-3 flex-1 overflow-hidden rounded-[1px] bg-surface"
                  aria-hidden="true"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(to right, #E3E7EC 0, #E3E7EC 1px, #FFFFFF 1px, #FFFFFF 8px)',
                  }}
                >
                  <span
                    className={cn(
                      'h-full transition-[width] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
                      isLast ? 'bg-coral' : 'bg-navy',
                    )}
                    style={{ width: `${(row.count / max) * 100}%` }}
                  />
                </span>
                <span
                  className={cn(
                    'nums w-10 shrink-0 text-end font-mono text-[16px] font-bold tracking-[-0.05em]',
                    isLast ? 'text-coral' : 'text-ink',
                  )}
                >
                  {row.count}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="px-4 pb-4 pt-1 md:px-6">
        <div className="flex gap-px overflow-hidden rounded-[2px] bg-hairline" aria-hidden="true">
          {rows.map((row, index) => {
            const pct = Math.round((row.count / sum) * 100);
            const isLast = index === rows.length - 1;
            return (
              <span
                key={resolveLocaleText(row.name, language)}
                className={cn('px-1.5 py-1.5 text-center font-mono text-[11px] font-bold', SHARE_COLORS[index % SHARE_COLORS.length], isLast ? 'text-[#0A1F31]' : 'text-on-navy')}
                style={{ width: `${pct}%` }}
              >
                {pct}%
              </span>
            );
          })}
        </div>
        <p className="nums mt-1.5 font-mono text-[10px] text-ink-faint">{t('dashboard.departmentsCard.share', { total: sum })}</p>
      </div>

      <div className="border-t border-divider px-4 py-3.5 md:px-6">
        <Link
          to={pathById('organization')}
          className="text-[14px] font-semibold text-navy transition-colors duration-150 hover:text-coral"
        >
          {t('dashboard.departmentsCard.viewAll')}
          <span aria-hidden="true" className="rtl:-scale-x-100">
            {' '}→
          </span>
        </Link>
      </div>
    </div>
  );
}

const STATUS_DOT: Record<TeamMember['status'], string> = {
  active: 'bg-navy',
  leave: 'bg-coral',
};

/** Manager ledger card — team roster with a presence dot per member. */
export function RosterCard({
  members,
  language,
  className,
}: {
  members: TeamMember[];
  language: 'ar' | 'en';
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className={cn('flex flex-col bg-surface', className)}>
      <p className="border-b border-ink px-5 py-3.5 text-[clamp(20px,2.6vw,26px)] font-bold leading-[1.1] tracking-[-0.04em] text-ink">
        {t('dashboard.rosterCard.title')}
      </p>
      <ul className="flex flex-col">
        {members.map((member) => {
          const name = resolveLocaleText(member.name, language);
          const statusLabel = t(
            member.status === 'active' ? 'dashboard.rosterCard.active' : 'dashboard.rosterCard.onLeave',
          );

          return (
            <li
              key={name}
              className="flex items-center gap-3 border-b border-divider px-5 py-2.5 last:border-b-0"
            >
              <Avatar initials={initialsOf(name)} photo={member.photo} size={32} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-medium text-ink">{name}</span>
                  <span
                    className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOT[member.status])}
                    role="img"
                    aria-label={statusLabel}
                    title={statusLabel}
                  />
                </span>
                <span className="block truncate text-caption text-ink-muted">
                  {resolveLocaleText(member.title, language)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.charAt(0) ?? '';
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}