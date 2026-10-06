/**
 * Presentational / static configuration for the Analytics page.
 *
 * All fabricated KPI numbers and mock trend arrays have been removed.
 * Live data is composed from real query hooks in `hooks.ts`.
 *
 * This file now holds only:
 *   - Color-threshold helpers used by chart/card sub-components.
 */

// ─── Attrition rate colour thresholds ─────────────────────────────────────────

/** CSS class for the KPI value text based on the all-time attrition rate. */
export function attritionRateColor(rate: number): string {
  if (rate >= 15) return 'text-coral';
  if (rate >= 8) return 'text-amber-500';
  return 'text-navy';
}
