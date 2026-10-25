/**
 * Salary rendering helpers (Sprint A / A2.3).
 *
 * The API strips salary fields (`basic_salary`, `gross_salary`, `net_salary`,
 * ...) for every role without `employee.salary.view`. The wire types therefore
 * describe them as optional, and the UI must render something honest instead
 * of assuming a number: a dash means "you are not allowed to see this", which
 * is different from 0 and must never be formatted as one.
 */

/** Shown wherever a salary amount was withheld by field-level permissions. */
export const RESTRICTED_AMOUNT = '—';

/**
 * Formats an amount for display, returning the restricted placeholder when the
 * field was stripped from the payload (or is genuinely null in the database).
 */
export function formatAmount(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return RESTRICTED_AMOUNT;

  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) return RESTRICTED_AMOUNT;

  return numeric.toLocaleString();
}
