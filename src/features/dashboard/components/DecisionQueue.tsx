import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { AvatarStack } from '@/components/ui/Avatar';
import { RollingNumber } from '@/components/ui/RollingNumber';
import { useMounted } from '@/hooks/useMounted';
import { pathById } from '@/config/navigation';
import { resolveLocaleText, QUEUE_DESTINATIONS, type DecisionQueueRow, type QueueId } from '../model';
import type { Role } from '@/auth/session';

interface DecisionQueueProps {
  rows: DecisionQueueRow[];
  counts: Record<QueueId, number>;
  removing: ReadonlySet<QueueId>;
  removed: ReadonlySet<QueueId>;
  role: Role;
  /** True while a resolve mutation is in flight; disables the row buttons. */
  isResolving: boolean;
  onResolve: (id: QueueId) => void;
}

/**
 * The hero ledger section: what needs a decision today. Rows collapse
 * (grid-rows 1fr→0fr, content fades and lifts first) as they are resolved;
 * when every row is gone the empty state cross-fades in with a self-drawing
 * checkmark. A footer row closes the queue with the live count + "View all".
 */
export function DecisionQueue({
  rows,
  counts,
  removing,
  removed,
  role,
  isResolving,
  onResolve,
}: DecisionQueueProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'en' ? 'en' : 'ar';
  const total = rows.reduce((sum, row) => sum + (counts[row.id] ?? 0), 0);

  // Cross-fade in only after the last row has finished collapsing.
  const showEmpty = rows.length > 0 && rows.every((row) => (counts[row.id] ?? 0) === 0 && removed.has(row.id));
  const aliveRows = rows.filter((row) => !removed.has(row.id));

  // "View all" points at the biggest remaining queue, which is the one the
  // reviewer most likely wants to clear next.
  const largestPendingId = aliveRows.reduce<QueueId | undefined>(
    (best, row) => (best === undefined || row.count > (counts[best] ?? 0) ? row.id : best),
    undefined,
  );

  return (
    <div className="flex flex-col bg-surface">
      <p className="flex items-center gap-3 border-b border-ink px-4 py-3.5 md:px-6 md:py-4">
        <span className="text-[22px] font-bold leading-[1.1] tracking-[-0.03em] text-ink md:text-[24px]">
          {t('dashboard.queue.title')}
        </span>
        {total > 0 ? (
          <span className="nums rounded-full bg-coral px-2.5 py-0.5 text-[11px] font-bold leading-normal text-on-navy md:text-[12px]">
            {total}
          </span>
        ) : null}
      </p>

      {aliveRows.map((row, index) => {
        const exiting = removing.has(row.id) || (counts[row.id] ?? 0) === 0;
        return (
          <QueueRow
            key={row.id}
            row={row}
            index={index}
            count={counts[row.id] ?? 0}
            exiting={exiting}
            language={language}
            wired={role === 'hr_admin' && !exiting}
            isResolving={isResolving}
            onResolve={onResolve}
          />
        );
      })}

      {total > 0 ? (
        <div className="flex items-center justify-between gap-3 bg-page px-4 py-3 md:px-6 md:py-3.5">
          <p className="min-w-0 truncate text-[13px] text-ink-muted md:text-[14px]">
            <bdi className="nums font-mono text-[14px] font-bold tracking-[-0.04em] text-ink md:text-[14px]">
              {total}
            </bdi>{' '}
            {t('dashboard.queue.footerCount')}
          </p>
          <Link
            to={aliveRows.length > 0 && largestPendingId ? QUEUE_DESTINATIONS[largestPendingId] : pathById('leave')}
            className="shrink-0 font-semibold text-navy transition-colors duration-150 hover:text-coral"
          >
            {t('dashboard.queue.viewAll')}
            <span aria-hidden="true" className="rtl:-scale-x-100">
              {' '}→
            </span>
          </Link>
        </div>
      ) : null}

      {showEmpty ? <EmptyStateRow /> : null}
    </div>
  );
}

function QueueRow({
  row,
  index,
  count,
  exiting,
  language,
  wired,
  isResolving,
  onResolve,
}: {
  row: DecisionQueueRow;
  index: number;
  count: number;
  exiting: boolean;
  language: 'ar' | 'en';
  wired: boolean;
  isResolving: boolean;
  onResolve: (id: QueueId) => void;
}) {
  const { t } = useTranslation();

  // React 18 has no `inert` prop, so the attribute is set on the DOM node. An
  // exiting row must not intercept clicks meant for the rows below it.
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    contentRef.current?.toggleAttribute('inert', exiting);
  }, [exiting]);

  const people =
    row.sample?.map((person) => ({
      initials: resolveLocaleText(person.initials, language),
      photo: person.photo,
      size: 32 as const,
    })) ?? [];

  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
        exiting ? '[grid-template-rows:0fr]' : '[grid-template-rows:1fr]',
      )}
      style={{ transitionDelay: exiting ? '140ms' : '0ms' }}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          ref={contentRef}
          className={cn(
            'flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-divider px-4 py-3 transition-[opacity,transform] duration-[260ms] ease-[cubic-bezier(0.4,0,1,1)] md:gap-x-5 md:px-6 md:py-[18px]',
            exiting && 'translate-y-1 opacity-0',
          )}
        >
          <bdi className="nums w-6 shrink-0 font-mono text-[11px] font-bold text-ink-faint md:text-[13px]">
            {String(index + 1).padStart(2, '0')}
          </bdi>

          <div className="min-w-0 flex-1 basis-[160px] md:basis-[200px]">
            <p className="flex min-w-0 items-baseline gap-1.5">
              <bdi className="nums text-[15px] font-bold tracking-[-0.02em] text-ink md:text-[17px]">
                {count}
              </bdi>
              <span className="truncate text-[15px] font-semibold tracking-[-0.02em] text-ink md:text-[17px]">
                {t(row.captionKey)}
              </span>
              {row.urgent ? (
                <span className="shrink-0 whitespace-nowrap rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold tracking-[0.06em] text-on-navy md:px-2.5 md:text-[11px]">
                  {t('dashboard.queue.urgent')}
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 truncate text-[12px] text-ink-muted md:text-[13px]">
              {row.descriptionParams ? t(row.descriptionKey, row.descriptionParams) : t(row.descriptionKey)}
            </p>
          </div>

          {row.kind === 'company' ? (
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[3px] bg-surface-hover" aria-hidden="true">
              <bdi className="nums font-mono text-[14px] font-bold text-navy">{count}</bdi>
            </span>
          ) : people.length > 0 ? (
            <span className="flex shrink-0 items-center" aria-hidden={count === 0}>
              <AvatarStack className="shrink-0" size={32} avatars={people} />
              {row.overflowCount != null ? (
                <bdi className="nums ms-3 font-mono text-[12px] font-bold text-ink-muted">+{row.overflowCount}</bdi>
              ) : null}
            </span>
          ) : null}

          <ResolveButton row={row} wired={wired} disabled={isResolving} onResolve={onResolve} />

          {/* Visually-hidden count readout (sr-only) — announces the remaining
              queue count and keeps the automated verify contract stable. */}
          <RollingNumber value={count} className="sr-only text-[22px]" />
        </div>
      </div>
    </div>
  );
}

function ResolveButton({
  row,
  wired,
  disabled,
  onResolve,
}: {
  row: DecisionQueueRow;
  wired: boolean;
  disabled: boolean;
  onResolve: (id: QueueId) => void;
}) {
  const { t } = useTranslation();

  const handleClick = () => {
    if (!wired || disabled) return;
    onResolve(row.id);
  };

  return (
    <button
      type="button"
      data-testid={`decision-action-${row.id}`}
      onClick={handleClick}
      disabled={disabled}
      aria-disabled={!wired || disabled}
      className={cn(
        'shrink-0 whitespace-nowrap px-4 py-2 text-[13px] font-semibold outline-none transition-colors duration-150 md:px-[22px] md:py-2.5 md:text-[14px]',
        (disabled || !wired) && 'cursor-not-allowed opacity-60',
        row.urgent
          ? 'rounded-full border-[1.5px] border-coral bg-coral text-on-navy hover:bg-coral-hover'
          : row.priority === 'primary'
            ? 'rounded-[3px] border-[1.5px] border-navy bg-navy text-on-navy hover:bg-navy-deep'
            : 'rounded-[3px] border-[1.5px] border-navy bg-transparent text-navy hover:bg-navy hover:text-on-navy',
      )}
    >
      {t(row.actionKey)}
    </button>
  );
}

/** Empty state — checkmark draws itself ~950ms after the row reveals. */
function EmptyStateRow() {
  const { t } = useTranslation();
  const mounted = useMounted();

  return (
    <div className="border-t border-divider px-5 py-9" data-testid="decision-empty-state">
      <div className="flex animate-content-in flex-col items-center gap-3 text-center">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-surface-hover">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M4.5 8.3 7 10.8 11.5 5.7"
              stroke="var(--color-ink)"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={mounted ? 0 : 1}
              style={{ transition: 'stroke-dashoffset 520ms cubic-bezier(0.22, 1, 0.36, 1) 950ms' }}
            />
          </svg>
        </span>
        <div>
          <p className="text-[15px] font-semibold text-ink">{t('dashboard.queue.empty.headline')}</p>
          <p className="mt-1 text-[13px] text-ink-muted">{t('dashboard.queue.empty.detail')}</p>
        </div>
      </div>
    </div>
  );
}