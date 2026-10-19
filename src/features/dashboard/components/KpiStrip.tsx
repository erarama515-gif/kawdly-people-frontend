import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CountUp } from '@/components/ui/CountUp';
import type { Kpi } from '../model';
import type { DecisionQueueRow, QueueId } from '../model';

interface KpiStripProps {
  kpis: Kpi[];
  /** Queue rows — used to derive the open-actions count for the navy panel. */
  queues?: DecisionQueueRow[];
  counts?: Record<QueueId, number>;
}

/**
 * KPI strip — the ledger's first band. Three metric tiles + a navy "Open
 * actions" panel (matching the new dashboard design). Tiles are separated by
 * 1px hairlines; each tile shows caption, a tight mono data numeral (gateway
 * link) and its delta + unit. The navy panel shows total pending items with
 * a categorical breakdown bar.
 *
 * Keyed by the caller so a role switch remounts it and restarts the count-up.
 */
export function KpiStrip({ kpis, queues, counts }: KpiStripProps) {
  const { t } = useTranslation();

  // Derive open-actions data from queue rows.
  const total = queues?.reduce((sum, row) => sum + (counts?.[row.id] ?? row.count), 0) ?? 0;
  const urgentCount = queues?.filter((r) => r.urgent).reduce((s, r) => s + (counts?.[r.id] ?? r.count), 0) ?? 0;
  const hasQueues = queues && queues.length > 0;

  return (
    <div
      className="grid gap-px"
      style={{ gridTemplateColumns: hasQueues ? 'repeat(3, 1fr) 1.15fr' : 'repeat(4, 1fr)' }}
      data-testid="kpi-grid"
    >
      {kpis.slice(0, hasQueues ? 3 : 4).map((kpi) => (
        <div key={kpi.id} className="flex min-w-0 flex-col gap-1.5 bg-surface px-4 py-3.5 md:px-5 md:py-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[11px] font-medium text-ink-muted md:text-[12px]">{t(kpi.captionKey)}</span>
            <span className={kpi.up ? 'nums text-[11px] font-semibold text-navy' : 'nums text-[11px] font-semibold text-coral'}>
              {kpi.deltaKey ? t(kpi.deltaKey) : ''}
            </span>
          </div>

          <Link
            to={kpi.path}
            aria-label={t(kpi.captionKey)}
            {...(kpi.id === 'employees' ? { 'data-testid': 'kpi-link-employees' } : {})}
            className="group/number min-w-0 no-underline focus-visible:underline"
          >
            <span className="nums flex items-baseline gap-1 font-mono text-[clamp(30px,4.2vw,40px)] font-medium leading-[1] tracking-[-0.04em] text-navy decoration-coral decoration-2 underline-offset-4 group-hover/number:underline group-focus-visible/number:underline">
              <CountUp value={kpi.value} />
              {kpi.suffix ? (
                <span className="text-[clamp(13px,1.8vw,14px)] font-medium text-navy">
                  {kpi.suffix}
                </span>
              ) : null}
            </span>
          </Link>

          <span className="flex flex-wrap items-baseline gap-x-1.5 text-[11px] leading-none md:text-[12px]">
            <span className={kpi.up ? 'nums font-semibold text-navy' : 'nums font-semibold text-coral'}>
              {t(kpi.deltaKey)}
            </span>
            {kpi.deltaSuffixKey ? <span className="text-ink-muted">{t(kpi.deltaSuffixKey)}</span> : null}
          </span>
        </div>
      ))}

      {/* Navy "Open actions" panel */}
      {hasQueues ? (
        <div className="flex min-w-0 flex-col gap-1.5 bg-navy px-4 py-3.5 text-on-navy md:px-5 md:py-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] opacity-90">{t('dashboard.openActions.label')}</span>
            <span className="text-[11px] font-semibold text-coral">{t('dashboard.openActions.requiresDecision')}</span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="nums font-mono text-[clamp(30px,4.2vw,40px)] font-medium leading-[1]">
              <CountUp value={total} />
            </span>
            {urgentCount > 0 ? (
              <span className="text-[12px] opacity-85">
                {t('dashboard.openActions.ofWhich')} {urgentCount} {t('dashboard.openActions.urgent')}
              </span>
            ) : null}
          </div>

          {/* Categorical breakdown bar */}
          {queues.length > 0 ? (
            <>
              <div className="mt-1 flex h-[6px] gap-0.5">
                {queues.map((row) => {
                  const count = counts?.[row.id] ?? row.count;
                  return (
                    <span
                      key={row.id}
                      className={row.urgent ? 'bg-coral' : count > 3 ? 'bg-on-navy' : 'bg-[#8fb3d1]'}
                      style={{ flex: count }}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-[11px] opacity-85">
                {queues.map((row) => {
                  const count = counts?.[row.id] ?? row.count;
                  const labels: Record<string, string> = {
                    leave: t('dashboard.openActions.leave'),
                    payroll: t('dashboard.openActions.payroll'),
                    contracts: t('dashboard.openActions.contracts'),
                    leaveFromTeam: t('dashboard.openActions.leave'),
                    performanceReview: t('dashboard.openActions.contracts'),
                  };
                  return (
                    <span key={row.id}>
                      {count} {labels[row.id] ?? row.id}
                    </span>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
