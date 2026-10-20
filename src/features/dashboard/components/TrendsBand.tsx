import { useTranslation } from 'react-i18next';
import { canCompareTrend, formatTrendNumber, hasTrendData } from '../kpiDelta';
import { resolveLocaleText } from '../model';
import type { Kpi, LocaleText } from '../model';

interface TrendsBandProps {
  kpis: Kpi[];
  /** One label per trend point (e.g. Sa…Fr); used for the SVG x-axis + header range. */
  labels: LocaleText[];
  language: 'ar' | 'en';
}

const VIEW_W = 240;
const VIEW_H = 90;
const BASELINE_Y = 82;
const TOP_Y = 8;
const PAD_X = 0;

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

function linePath(trend: number[], xs: number[]): string {
  return trend.map((value, index) => `${index === 0 ? 'M' : 'L'}${xs[index]?.toFixed(1)} ${yOf(trend, value).toFixed(1)}`).join(' ');
}

function areaPath(trend: number[], xs: number[]): string {
  const line = linePath(trend, xs);
  return `${line} L${VIEW_W} ${BASELINE_Y} L0 ${BASELINE_Y} Z`;
}

/**
 * Short answer text derived from the KPI's trend data.
 *
 * Guards the empty series on purpose. `payrollCostTrend()` returns `[]` when no
 * payroll run exists, which on a fresh install is every install: `trend[0]` and
 * `trend[length - 1]` were then both `undefined`, `diff` was `NaN` (so neither
 * comparison branch was taken) and the fallback interpolated `undefined` into
 * the string — the `undefinedM — no change` the budget card used to render.
 *
 * `noUncheckedIndexedAccess` is off in `tsconfig.app.json`, so `trend[0]` types
 * as `number` and the compiler could not catch it; the guards below are the
 * check the type system is not making.
 */
function deriveAnswer(kpi: Kpi, t: (key: string) => string): string {
  const suffix = kpi.suffix ?? '';

  // Nothing recorded yet (empty series, or every point still zero).
  if (!hasTrendData(kpi.trend)) return t('dashboard.trends.noData');

  const last = kpi.trend[kpi.trend.length - 1] as number;

  // A single real point: state it, but claim no movement.
  if (!canCompareTrend(kpi.trend)) return formatTrendNumber(last, suffix);

  const first = kpi.trend[0] as number;
  const diff = Number((last - first).toFixed(1));
  const from = formatTrendNumber(first, suffix);
  const to = formatTrendNumber(last, suffix);

  if (diff === 0) return `${to} — ${t('dashboard.trends.noChange')}`;
  const change = `${diff > 0 ? '+' : '-'}${formatTrendNumber(Math.abs(diff), suffix)}`;
  return `${from} → ${to} (${change})`;
}

/** Question key per KPI id. */
const QUESTION_KEY: Record<string, string> = {
  employees: 'dashboard.trends.questions.employees',
  attendanceToday: 'dashboard.trends.questions.attendanceToday',
  payrollCostMTD: 'dashboard.trends.questions.payrollCostMTD',
  openPositions: 'dashboard.trends.questions.openPositions',
  teamMembers: 'dashboard.trends.questions.teamMembers',
  teamAttendanceToday: 'dashboard.trends.questions.teamAttendanceToday',
  pendingLeave: 'dashboard.trends.questions.pendingLeave',
  reviewsDue: 'dashboard.trends.questions.reviewsDue',
};

/**
 * Trends section — "Where the organization is heading". Per-KPI charts with
 * question/answer labels and filled area paths, matching the new dashboard
 * design. A section header with title and date range precedes the chart grid.
 */
export function TrendsBand({ kpis, labels, language }: TrendsBandProps) {
  const { t } = useTranslation();
  const chartLabels = labels.map((label) => resolveLocaleText(label, language));

  return (
    <div className="flex flex-col bg-surface">
      {/* Section header — matching new design */}
      <div className="flex items-baseline justify-between gap-3 border-b border-ink px-4 py-3 md:px-6">
        <span className="text-[19px] font-bold tracking-[-0.02em] text-ink">{t('dashboard.trends.sectionTitle')}</span>
        <span className="nums font-mono text-[11px] text-ink-faint">
          {t('dashboard.trends.sectionSubtitle')}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-x-auto bg-divider sm:overflow-x-visible lg:grid-cols-4">
        {kpis.map((kpi) => {
          const question = QUESTION_KEY[kpi.id] ? t(QUESTION_KEY[kpi.id]) : t(kpi.captionKey);
          const answer = deriveAnswer(kpi, t);

          // Spaced across this KPI's own point count, not the weekday-label
          // count: the payroll series is one point per real payroll run, so a
          // shared 7-point x-axis drew its line across the left third while the
          // endpoint marker sat at the far right. An empty series also made
          // `endpoint` undefined and `cy` NaN, which the browser rejected.
          const xs = xsFor(kpi.trend.length);
          const lastX = xs[xs.length - 1] ?? VIEW_W / 2;
          const endpoint = kpi.trend[kpi.trend.length - 1];
          const plottable = kpi.trend.length > 0 && endpoint !== undefined;

          return (
            <div key={kpi.id} className="min-w-0 bg-surface px-4 py-4 md:px-[18px]">
              {/* Question */}
              <p className="text-[12px] text-ink-muted">{question}</p>
              {/* Answer */}
              <p className="mt-0.5 min-h-[42px] text-[14px] font-semibold leading-snug text-ink">
                {answer}
              </p>

              {/* Area chart */}
              <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="mt-2 block w-full" aria-hidden="true" style={{ direction: 'ltr' }}>
                <line x1="0" y1={BASELINE_Y} x2={VIEW_W} y2={BASELINE_Y} stroke="var(--color-hairline, #d5dbe3)" />
                <line x1="0" y1={45} x2={VIEW_W} y2={45} stroke="var(--color-divider, #eef1f5)" />
                {plottable ? (
                  <>
                    <path d={areaPath(kpi.trend, xs)} fill="var(--color-navy, #0C4874)" fillOpacity={0.07} />
                    <path d={linePath(kpi.trend, xs)} fill="none" stroke="var(--color-navy, #0C4874)" strokeWidth={1.8} />
                    <circle cx={lastX} cy={yOf(kpi.trend, endpoint)} r={3.5} fill="var(--color-coral, #E4714E)" />
                  </>
                ) : null}
              </svg>

              {/* X-axis labels */}
              <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-faint" dir="ltr">
                <span>{chartLabels[0]}</span>
                <span>{chartLabels[chartLabels.length - 1]}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
