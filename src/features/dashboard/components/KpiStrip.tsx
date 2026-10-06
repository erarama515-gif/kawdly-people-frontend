import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CountUp } from '@/components/ui/CountUp';
import type { Kpi } from '../model';

interface KpiStripProps {
  kpis: Kpi[];
}

/**
 * KPI strip: the ledger's first band. Tiles are separated by 1px hairlines
 * (the wrapping section already fills `hairline`); each tile shows caption,
 * a tight mono data numeral (gateway link) and its delta + unit.
 * Keyed by the caller so a role switch remounts it and restarts the count-up.
 */
export function KpiStrip({ kpis }: KpiStripProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-px min-[900px]:grid-cols-4" data-testid="kpi-grid">
      {kpis.map((kpi) => (
        <div key={kpi.id} className="flex min-w-0 flex-col gap-1 bg-surface px-4 py-3 md:px-6 md:py-5">
          <span className="truncate text-[11px] font-medium text-ink-muted md:text-[13px]">{t(kpi.captionKey)}</span>

          <Link
            to={kpi.path}
            aria-label={t(kpi.captionKey)}
            {...(kpi.id === 'employees' ? { 'data-testid': 'kpi-link-employees' } : {})}
            className="group/number min-w-0 no-underline focus-visible:underline"
          >
            <span className="nums flex items-baseline gap-px font-mono text-[clamp(30px,4.6vw,52px)] font-bold leading-[1.1] tracking-[-0.05em] text-navy decoration-coral decoration-2 underline-offset-4 group-hover/number:underline group-focus-visible/number:underline">
              <CountUp value={kpi.value} />
              {kpi.suffix ? (
                <span className="text-[clamp(14px,2.1vw,24px)] font-bold tracking-[-0.04em] text-ink-muted">
                  {kpi.suffix}
                </span>
              ) : null}
            </span>
          </Link>

          <span className="flex flex-wrap items-baseline gap-x-1.5 text-[11px] leading-none md:text-[12px]">
            <span className={kpi.up ? 'nums font-bold text-navy' : 'nums font-bold text-coral'}>
              {t(kpi.deltaKey)}
            </span>
            {kpi.deltaSuffixKey ? <span className="text-ink-muted">{t(kpi.deltaSuffixKey)}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}