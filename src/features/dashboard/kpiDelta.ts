import type { Kpi } from './model';

/**
 * Honest delta derivation for the KPI strip and the trends band.
 *
 * Background (T6.6): the API sends a *static i18n key* as `deltaKey`
 * (`dashboard.kpi.employees.delta` → the literal string `"+12"`), so every
 * install rendered `+12 this month` next to its employee count no matter what
 * that count was. On a demo database nobody noticed; after T6.5 made the first
 * install land on an empty database it read `+12 this month` beside `0`.
 *
 * The only real change information the API actually ships is `trend` — a series
 * reconstructed from real columns (headcount per day from joining/termination
 * dates, attendance rate per day from attendance rows, payroll totals per run).
 * So the delta is derived from that series here, and when the series carries no
 * measurement yet the delta is not rendered at all.
 *
 * TODO(T9): have `GET /dashboard` return a numeric `delta` plus an explicit
 * window descriptor per KPI, and delete the `dashboard.kpi.*.delta` /
 * `*.deltaSuffix` literals together with this module's inference. Until then the
 * `deltaKey` / `deltaSuffixKey` fields are decoded but deliberately not shown.
 */

/**
 * Whether the series carries a real measurement.
 *
 * An all-zero series is "nothing recorded yet", not "measured zero": on a fresh
 * install `headcountTrend()` returns `[0]` and `attendanceRateTrend()` returns
 * `[0.0]`, and the payroll trend is `[]` outright.
 */
export function hasTrendData(trend: readonly number[]): boolean {
  return trend.length > 0 && trend.some((point) => point !== 0);
}

/** Whether the series has two comparable endpoints, so a change can be stated. */
export function canCompareTrend(trend: readonly number[]): boolean {
  return trend.length >= 2 && hasTrendData(trend);
}

/**
 * Formats a number for display next to `suffix`. Integers print without a
 * decimal point so a headcount reads `+1`, not `+1.0`; fractional values keep
 * one place so `0.4%` and `2.7M` survive.
 */
export function formatTrendNumber(value: number, suffix = ''): string {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}${suffix}`;
}

export interface KpiDelta {
  /** Signed, formatted change — e.g. `+1`, `-0.4%`, `+2.7M`. */
  text: string;
  /** i18n key for the window this change was measured over. */
  windowKey: string;
  /** Interpolation values for `windowKey`. */
  windowParams?: Record<string, string | number>;
  /** `undefined` when the change is exactly zero, so the caller can go muted. */
  direction: 'up' | 'down' | undefined;
}

/**
 * The change across `kpi.trend`, or `null` when the series cannot support one.
 *
 * `null` means "render no delta line" — never a fabricated `+12` and never a
 * `0` dressed up as a measurement.
 */
export function deriveKpiDelta(kpi: Kpi): KpiDelta | null {
  if (!canCompareTrend(kpi.trend)) return null;

  const first = kpi.trend[0] as number;
  const last = kpi.trend[kpi.trend.length - 1] as number;
  const diff = Number((last - first).toFixed(1));
  const suffix = kpi.suffix ?? '';

  const sign = diff > 0 ? '+' : diff < 0 ? '-' : '';
  const text = diff === 0
    ? formatTrendNumber(0, suffix)
    : `${sign}${formatTrendNumber(Math.abs(diff), suffix)}`;

  return {
    text,
    direction: diff > 0 ? 'up' : diff < 0 ? 'down' : undefined,
    ...windowFor(kpi),
  };
}

/**
 * How far back the series reaches, phrased truthfully per KPI.
 *
 * The daily series are `TREND_DAYS` points ending today, so the first point is
 * `length - 1` days back — read off the payload rather than hardcoded, so the
 * label stays correct if the backend changes its window. Payroll has no daily
 * granularity: `payrollCostTrend()` returns one point per real payroll run, so
 * its comparison is against the previous run, not against a date.
 */
function windowFor(kpi: Kpi): Pick<KpiDelta, 'windowKey' | 'windowParams'> {
  if (kpi.id === 'payrollCostMTD') {
    return { windowKey: 'dashboard.kpi.delta.windowPreviousRun' };
  }
  return {
    windowKey: 'dashboard.kpi.delta.windowDays',
    windowParams: { days: kpi.trend.length - 1 },
  };
}
