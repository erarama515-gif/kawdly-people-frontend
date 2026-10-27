import { array, bool, literalUnion, num, object, optional, passthrough, str } from '@/lib/api/decode';

/**
 * Wire schemas for the Payroll module — four resources:
 *   1. PayrollRun     (/api/v1/payroll-runs)
 *   2. Payslip        (/api/v1/payslips)
 *   3. EmployeeSalary (/api/v1/employee-salaries)
 *   4. PayslipItem    (/api/v1/payslip-items)
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

// ─── PayslipItem ──────────────────────────────────────────────────────────────

export const payslipItemTypeDecoder = literalUnion(['earning', 'deduction'] as const);

/** Minimal salary-component ref embedded when `include=salaryComponent` is passed. */
const salaryComponentRefDecoder = object({
  id: num(),
  name: str(),
});

export const payslipItemDecoder = object({
  id: num(),
  payslip_id: num(),
  salary_component_id: optional(num()),
  description: str(),
  type: payslipItemTypeDecoder,
  amount: num(),
  is_taxable: optional(bool()),
  sort_order: optional(num()),
  created_at: optional(str()),
  updated_at: optional(str()),
  /** Eager-loaded via `include=salaryComponent`. */
  salaryComponent: optional(salaryComponentRefDecoder),
});

export type PayslipItemWire = ReturnType<typeof payslipItemDecoder.decode>;

export const payslipItemListDecoder = object({
  data: array(payslipItemDecoder),
  meta: pageMetaDecoder,
});

export type PayslipItemListWire = ReturnType<typeof payslipItemListDecoder.decode>;

export const payslipItemEnvelopeDecoder = object({ data: payslipItemDecoder });
export type PayslipItemEnvelopeWire = ReturnType<typeof payslipItemEnvelopeDecoder.decode>;

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
  /**
   * Salary amounts are stripped by `filter.sensitive` for roles without
   * `employee.salary.view`; the others are payroll-owned totals that always
   * travel with the row. Optional keeps the payslip list decodable for
   * hr_officer (A2.3).
   */
  basic_salary: optional(num()),
  gross_salary: optional(num()),
  total_earnings: num(),
  total_deductions: num(),
  net_salary: optional(num()),
  working_days: optional(str()),
  present_days: optional(str()),
  absent_days: optional(str()),
  overtime_hours: optional(str()),
  overtime_amount: optional(num()),
  status: optional(payslipStatusDecoder),
  created_at: optional(str()),
  updated_at: optional(str()),
  /** Eager-loaded via `include=employee`. */
  employee: optional(employeeRefDecoder),
  /** Eager-loaded via `include=payslipItems` on the show endpoint. */
  payslipItems: optional(array(payslipItemDecoder)),
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

// ─── EmployeeSalary ───────────────────────────────────────────────────────────

/** Minimal salary-structure ref embedded when `include=salaryStructure` is passed. */
const salaryStructureRefDecoder = object({
  id: num(),
  name: str(),
});

export const employeeSalaryDecoder = object({
  id: num(),
  employee_id: num(),
  salary_structure_id: num(),
  effective_date: str(),
  /** Free-form JSON array; not rendered as a line-item editor yet. */
  components: optional(passthrough<unknown[]>('array')),
  /** Stripped without `employee.salary.view` - see payslipDecoder above (A2.3). */
  gross_salary: optional(num()),
  net_salary: optional(num()),
  is_current: optional(bool()),
  created_at: optional(str()),
  updated_at: optional(str()),
  /** Eager-loaded via `include=employee`. */
  employee: optional(employeeRefDecoder),
  /** Eager-loaded via `include=salaryStructure`. */
  salaryStructure: optional(salaryStructureRefDecoder),
});

export type EmployeeSalaryWire = ReturnType<typeof employeeSalaryDecoder.decode>;

export const employeeSalaryListDecoder = object({
  data: array(employeeSalaryDecoder),
  meta: pageMetaDecoder,
});

export type EmployeeSalaryListWire = ReturnType<typeof employeeSalaryListDecoder.decode>;

export const employeeSalaryEnvelopeDecoder = object({ data: employeeSalaryDecoder });
export type EmployeeSalaryEnvelopeWire = ReturnType<typeof employeeSalaryEnvelopeDecoder.decode>;
