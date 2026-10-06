import { array, bool, literalUnion, num, object, optional, str } from '@/lib/api/decode';

/**
 * Wire schemas for the Payroll module — two resources:
 *   1. PayrollRun  (/api/v1/payroll-runs)
 *   2. Payslip     (/api/v1/payslips)
 *
 * Field names match Laravel DB columns verbatim (snake_case). The `index`
 * envelope is the app's custom `{ data, meta }` pager.
 *
 * NOTE: PayrollRun uses period_month (int 1-12) + period_year (int) — not a
 *       string month. Format client-side via
 *       `new Date(period_year, period_month - 1).toLocaleDateString('en-GB', { month: 'long' })`.
 * NOTE: Payslip has no `department` column — resolve via the employee relation
 *       (same convention as Attendance/Leave).
 * NOTE: Payslip `total_deductions` is the real column name; old mock called it
 *       `deductions`.
 */

// ─── PayrollRun ───────────────────────────────────────────────────────────────

export const payrollRunStatusDecoder = literalUnion([
  'draft',
  'calculating',
  'calculated',
  'reviewing',
  'approved',
  'posted',
  'paid',
] as const);

export const payrollRunDecoder = object({
  id: num(),
  company_id: num(),
  period_month: num(),
  period_year: num(),
  status: optional(payrollRunStatusDecoder),
  total_gross: optional(num()),
  total_deductions: optional(num()),
  total_net: optional(num()),
  employee_count: optional(num()),
  notes: optional(str()),
  is_locked: optional(bool()),
  created_by: num(),
  created_at: optional(str()),
  updated_at: optional(str()),
});

export type PayrollRunWire = ReturnType<typeof payrollRunDecoder.decode>;

export const pageMetaDecoder = object({
  current_page: num(),
  per_page: num(),
  total: num(),
  last_page: num(),
});

export type PageMetaWire = ReturnType<typeof pageMetaDecoder.decode>;

export const payrollRunListDecoder = object({
  data: array(payrollRunDecoder),
  meta: pageMetaDecoder,
});

export type PayrollRunListWire = ReturnType<typeof payrollRunListDecoder.decode>;

export const payrollRunEnvelopeDecoder = object({ data: payrollRunDecoder });
export type PayrollRunEnvelopeWire = ReturnType<typeof payrollRunEnvelopeDecoder.decode>;

// ─── Payslip ──────────────────────────────────────────────────────────────────

export const payslipStatusDecoder = literalUnion(['draft', 'finalized', 'paid'] as const);

/** Minimal employee ref embedded when `include=employee` is passed. */
const employeeRefDecoder = object({
  id: num(),
  employee_number: str(),
  first_name: str(),
  last_name: str(),
  photo: optional(str()),
});

export const payslipDecoder = object({
  id: num(),
  payroll_run_id: num(),
  employee_id: num(),
  basic_salary: num(),
  gross_salary: num(),
  total_earnings: num(),
  total_deductions: num(),
  net_salary: num(),
  working_days: optional(num()),
  present_days: optional(num()),
  absent_days: optional(num()),
  overtime_hours: optional(num()),
  overtime_amount: optional(num()),
  status: optional(payslipStatusDecoder),
  created_at: optional(str()),
  updated_at: optional(str()),
  /** Eager-loaded via `include=employee`. */
  employee: optional(employeeRefDecoder),
});

export type PayslipWire = ReturnType<typeof payslipDecoder.decode>;
export type PayslipEmployeeRef = NonNullable<PayslipWire['employee']>;

export const payslipListDecoder = object({
  data: array(payslipDecoder),
  meta: pageMetaDecoder,
});

export type PayslipListWire = ReturnType<typeof payslipListDecoder.decode>;

export const payslipEnvelopeDecoder = object({ data: payslipDecoder });
export type PayslipEnvelopeWire = ReturnType<typeof payslipEnvelopeDecoder.decode>;
