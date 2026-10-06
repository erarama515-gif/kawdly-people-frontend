import { useTranslation } from 'react-i18next';
import { resolveLocaleText } from '../model';
import type { DecisionQueueRow, QueueId } from '../model';
import type { SessionUser } from '@/auth/session';
import type { Role } from '@/auth/session';
import { DecisionsSentence } from './DecisionsSentence';
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
}

/** The navy hero band — meta role line, greeting, decisions sentence, CTAs. */
export function HeroHeader({ user, role, roleLabel, today, rows, counts, removing }: HeroHeaderProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'en' ? 'en' : 'ar';
  const name = resolveLocaleText(user.name, language);
  const heroPhoto = user.photo.replace('/80?', '/200?');

  return (
    <div
      className="-mx-4 bg-navy text-on-navy md:-mx-12"
      style={{
        backgroundImage:
          'radial-gradient(circle at 0% 0%, rgba(31,123,184,.55), transparent 38%), radial-gradient(circle at 100% 100%, rgba(228,113,78,.35), transparent 34%), linear-gradient(135deg, #0C4874 30%, #072D4A)',
      }}
    >
      <div className="flex flex-col gap-[18px] px-4 py-10 pb-11 md:px-12 md:py-10 md:pb-11">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="nums min-w-0 max-w-full truncate font-mono text-[12px] font-medium uppercase tracking-[0.04em] text-[#C9D2DA]">
            <span className="font-semibold text-[#C9D2DA]">{roleLabel}</span>
            <span className="mx-1.5" aria-hidden="true">
              ·
            </span>
            {today}
          </p>
          <RoleSwitcher />
        </div>

        <div className="flex flex-wrap items-end gap-7 py-2">
          <img
            src={heroPhoto}
            alt={name}
            loading="eager"
            className="h-16 w-16 flex-none rounded-[3px] object-cover [filter:grayscale(1)_contrast(1.05)] md:h-[112px] md:w-[112px]"
          />
          <h1 className="min-w-0 whitespace-pre-line text-greeting text-on-navy">
            {t('dashboard.greeting', { name })}
          </h1>
        </div>

        <DecisionsSentence rows={rows} counts={counts} removing={removing} />
        <QuickActions role={role} />
      </div>
    </div>
  );
}