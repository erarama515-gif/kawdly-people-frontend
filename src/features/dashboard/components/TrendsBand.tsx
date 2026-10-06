import { useTranslation } from 'react-i18next';
import { resolveLocaleText } from '../model';
import type { Kpi, LocaleText } from '../model';

interface TrendsBandProps {
  kpis: Kpi[];
  /** One label per trend point (e.g. Sa…Fr); used for the SVG x-axis + header range. */
  labels: LocaleText[];
  language: 'ar' | 'en';
}

const VIEW_W = 240;
const VIEW_H = 86;
const BASELINE_Y = 70;
const LABEL_Y = 83;
const TOP_Y = 8;
const PAD_X = 6;

/** Shared label for each KPI id (design short forms). */
const TREND_LABEL_KEY: Record<string, string> = {
  employees: 'dashboard.trends.headcount',
  attendanceToday: 'dashboard.trends.attendance',
  payrollCostMTD: 'dashboard.trends.payroll',
  openPositions: 'dashboard.trends.openRoles',
  teamMembers: 'dashboard.trends.headcount',
  teamAttendanceToday: 'dashboard.trends.attendance',
  pendingLeave: 'dashboard.trends.openRoles',
  reviewsDue: 'dashboard.trends.openRoles',
};

/** Horizontal positions for `count` data points, spread across the view width. */
function xsFor(count: number): number[] {
  if (count <= 1) return [VIEW_W / 2];
  const span = VIEW_W - PAD_X * 2;
  const step = span / (count - 1);
  return Array.from({ length: count }, (_, index) => PAD_X + index * step);
}

/** Normalised y position for a value inside its chart's TOP_Y..BASELINE_Y band. */
function yOf(trend: number[], value: number): number {
  const min = Math.min(...trend);
  const max = Math.max(...trend);
  const span = max - min || 1;
  return TOP_Y + (1 - (value - min) / span) * (BASELINE_Y - TOP_Y);
}

function polyline(trend: number[], xs: number[]): string {
  return trend.map((value, index) => `${xs[index]?.toFixed(1)},${yOf(trend, value).toFixed(1)}`).join(' ');
}

function formatRange(kpi: Kpi): string {
  const first = String(kpi.trend[0]);
  const lastValue = kpi.trend[kpi.trend.length - 1];
  const suffix = kpi.suffix && kpi.suffix !== '%' ? kpi.suffix : '';
  return `${first} → ${lastValue}${suffix}`;
}

/**
 * The "Last 7 days" band: per-KPI mini line charts drawn from the same trend
 * arrays that feed the KPI strip. Geometry is derived from the actual number of
 * points, so a server-provided series of any length renders correctly.
 */
export function TrendsBand({ kpis, labels, language }: TrendsBandProps) {
  const { t } = useTranslation();
  const chartLabels = labels.map((label) => resolveLocaleText(label, language));
  const xs = xsFor(chartLabels.length);
  const lastX = xs[xs.length - 1] ?? VIEW_W / 2;

  return (
    <div className="flex flex-col bg-surface">
      <div className="flex items-baseline justify-between gap-3 border-b border-divider px-4 py-3 md:px-6">
        <span className="text-[16px] font-bold tracking-[-0.02em] text-ink">{t('dashboard.trends.title')}</span>
        <span className="nums font-mono text-[10px] font-medium text-ink-faint">
          {chartLabels[0]} – {chartLabels[chartLabels.length - 1]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px bg-divider lg:grid-cols-4">
        {kpis.map((kpi) => {
          const labelKey = TREND_LABEL_KEY[kpi.id];
          const title = labelKey ? t(labelKey) : t(kpi.captionKey);
          const endpoint = kpi.trend[kpi.trend.length - 1];
          return (
            <div key={kpi.id} className="min-w-0 bg-surface px-4 py-4 md:px-6">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[12px] text-ink-muted">{title}</span>
                <span className="nums shrink-0 font-mono text-[12px] font-bold text-ink">
                  {formatRange(kpi)}
                </span>
              </div>

              <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="mt-2 block w-full" aria-hidden="true">
                <path d={`M0 ${BASELINE_Y}H${VIEW_W}M0 0V${BASELINE_Y}`} stroke="#C9D2DA" fill="none" />
                <polyline points={polyline(kpi.trend, xs)} stroke="#0C4874" strokeWidth={1} fill="none" />
                <circle cx={lastX} cy={yOf(kpi.trend, endpoint)} r={3.5} fill="#E4714E" />
                <g fontFamily="JetBrains Mono, monospace" fontSize={10} fill="#9AA7B3" textAnchor="middle">
                  {chartLabels.map((label, index) => (
                    <text key={`${label}-${index}`} x={xs[index]} y={LABEL_Y}>
                      {label}
                    </text>
                  ))}
                </g>
              </svg>
            </div>
          );
        })}
      </div>
    </div>
  );
}
