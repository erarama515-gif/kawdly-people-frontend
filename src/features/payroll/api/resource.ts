import type { FetchContext, QueryKey } from '@/lib/query';
import type {
  PayrollRunListWire,
  PayrollRunWire,
  PayslipListWire,
  PayslipWire,
  EmployeeSalaryListWire,
  EmployeeSalaryWire,
  PayslipItemListWire,
  PayslipItemWire,
} from './schema';

/**
 * The Payroll module's remote resource contract for FOUR resources:
 *   1. PayrollRun     — /api/v1/payroll-runs
 *   2. Payslip        — /api/v1/payslips
 *   3. EmployeeSalary — /api/v1/employee-salaries
 *   4. PayslipItem    — /api/v1/payslip-items
 *
 * Components never call these directly — they go through the query hooks in
 * `queries.ts`. Each resource has an HTTP implementation and a mock, with mock
 * as the active default until `VITE_API_BASE_URL` is set.
 *
 * Fields verified against:
 *   - StorePayrollRunRequest:
 *       company_id (req int), period_month (req int 1-12), period_year (req int),
 *       status (nullable enum: draft|calculating|calculated|reviewing|approved|posted|paid),
 *       total_gross (nullable int), total_deductions (nullable int), total_net (nullable int),
 *       employee_count (nullable int), notes (nullable str), is_locked (nullable bool),
 *       created_by (req int — authenticated user id; overwritten server-side)
 *   - StorePayslipRequest:
 *       payroll_run_id (req int), employee_id (req int),
 *       basic_salary (req int), gross_salary (req int), total_earnings (req int),
 *       total_deductions (req int), net_salary (req int),
 *       working_days (nullable numeric), present_days (nullable numeric),
 *       absent_days (nullable numeric), overtime_hours (nullable numeric),
 *       overtime_amount (nullable int), status (nullable enum: draft|finalized|paid)
 *   - StoreEmployeeSalaryRequest:
 *       employee_id (req int/exists:employees), salary_structure_id (req int/exists:salary_structures),
 *       effective_date (req date), components (req array), gross_salary (req int),
 *       net_salary (req int), is_current (nullable bool)
 *   - StorePayslipItemRequest:
 *       payslip_id (req int/exists:payslips), salary_component_id (nullable int/exists:salary_components),
 *       description (req str max:255), type (req enum: earning|deduction), amount (req int),
 *       is_taxable (nullable bool), sort_order (nullable int)
 *
 * Pipeline actions:
 *   POST /api/v1/payroll-runs/{id}/calculate  — draft → calculated (runs the calc engine)
 *   POST /api/v1/payroll-runs/{id}/approve    — calculated → approved (locks the run)
 *
 * PayslipItem permissions deliberately reuse `payroll.payslip.*` (line-items of
 * a payslip) rather than having a dedicated `payslip_item.*` set — see
 * backend/routes/api/payroll.php.
 */

// ─── PayrollRun ───────────────────────────────────────────────────────────────

/**
 * Real backend enum values from StorePayrollRunRequest:
 *   draft | calculating | calculated | reviewing | approved | posted | paid
 *
 * NOTE: The old mock used 5 steps and 'reviewed' (not 'reviewing') — both corrected.
 */
export type PayrollRunStatus =
  | 'draft'
  | 'calculating'
  | 'calculated'
  | 'reviewing'
  | 'approved'
  | 'posted'
  | 'paid';

export const PAYROLL_RUN_PIPELINE: PayrollRunStatus[] = [
  'draft',
  'calculating',
  'calculated',
  'reviewing',
  'approved',
  'posted',
  'paid',
];

export interface PayrollRunListParams {
  page?: number;
  perPage?: number;
  status?: PayrollRunStatus | undefined;
  /**
   * Inclusive range filter on the pay period (`YYYY-MM` or `YYYY-MM-DD`),
   * mapped to `period_from`/`period_to` on the wire. There is no single date
   * column on `payroll_runs` — the backend compares the `(period_year,
   * period_month)` tuple against these.
   */
  periodFrom?: string | undefined;
  periodTo?: string | undefined;
}

/** Shape of `StorePayrollRunRequest`'s validated fields. */
export interface PayrollRunInput {
  /** Injected by the backend's auth middleware; omit from form payloads. */
  company_id?: number;
  period_month: number;
  period_year: number;
  status?: PayrollRunStatus | null;
  total_gross?: number | null;
  total_deductions?: number | null;
  total_net?: number | null;
  employee_count?: number | null;
  notes?: string | null;
  is_locked?: boolean | null;
  /** Required by the backend; hardcoded to 1 as placeholder until auth context is wired. */
  created_by: number;
}

/** `UpdatePayrollRunRequest` wraps the same fields in `sometimes` — any subset is valid. */
export type PayrollRunUpdateInput = Partial<PayrollRunInput>;

export interface PayrollRunApi {
  list(context: FetchContext, params: PayrollRunListParams): Promise<PayrollRunListWire>;
  create(context: FetchContext, input: PayrollRunInput): Promise<PayrollRunWire>;
  update(context: FetchContext, id: number, input: PayrollRunUpdateInput): Promise<PayrollRunWire>;
  remove(context: FetchContext, id: number): Promise<void>;
  /** `POST /payroll-runs/{id}/calculate` — draft/calculated → calculated, computes payslips. */
  calculate(context: FetchContext, id: number): Promise<PayrollRunWire>;
  /** `POST /payroll-runs/{id}/approve` — calculated → approved, locks the run. */
  approve(context: FetchContext, id: number): Promise<PayrollRunWire>;
}

export const payrollRunKeys = {
  all: ['payroll-runs'] as const satisfies QueryKey,
  list: (params: PayrollRunListParams) => ['payroll-runs', 'list', params] as const satisfies QueryKey,
};

// ─── Payslip ──────────────────────────────────────────────────────────────────

/**
 * Real backend enum values from StorePayslipRequest:
 *   draft | finalized | paid
 *
 * NOTE: The old mock had 'processed' — that is NOT a real backend value and
 * has been dropped. 'processed' maps conceptually to 'finalized'.
 */
export type PayslipStatus = 'draft' | 'finalized' | 'paid';

export interface PayslipListParams {
  page?: number;
  perPage?: number;
  payroll_run_id?: number | undefined;
  status?: PayslipStatus | undefined;
}

/** Shape of `StorePayslipRequest`'s validated fields. */
export interface PayslipInput {
  payroll_run_id: number;
  employee_id: number;
  basic_salary: number;
  gross_salary: number;
  total_earnings: number;
  total_deductions: number;
  net_salary: number;
  working_days?: number | null;
  present_days?: number | null;
  absent_days?: number | null;
  overtime_hours?: number | null;
  overtime_amount?: number | null;
  status?: PayslipStatus | null;
}

/** `UpdatePayslipRequest` wraps the same fields in `sometimes` — any subset is valid. */
export type PayslipUpdateInput = Partial<PayslipInput>;

export interface PayslipApi {
  list(context: FetchContext, params: PayslipListParams): Promise<PayslipListWire>;
  create(context: FetchContext, input: PayslipInput): Promise<PayslipWire>;
  update(context: FetchContext, id: number, input: PayslipUpdateInput): Promise<PayslipWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

export const payslipKeys = {
  all: ['payslips'] as const satisfies QueryKey,
  list: (params: PayslipListParams) => ['payslips', 'list', params] as const satisfies QueryKey,
};

// ─── EmployeeSalary ───────────────────────────────────────────────────────────

export interface EmployeeSalaryListParams {
  page?: number;
  perPage?: number;
  employee_id?: number | undefined;
  salary_structure_id?: number | undefined;
  is_current?: boolean | undefined;
}

/**
 * Shape of `StoreEmployeeSalaryRequest`'s validated fields. `components` is a
 * required JSON array on the backend; the form does not expose a line-item
 * editor for it yet, so the UI always submits `[]` rather than inventing a
 * shape — the real line items live on SalaryComponent/PayslipItem instead.
 */
export interface EmployeeSalaryInput {
  employee_id: number;
  salary_structure_id: number;
  effective_date: string;
  components: unknown[];
  gross_salary: number;
  net_salary: number;
  is_current?: boolean | null;
}

/** `UpdateEmployeeSalaryRequest` wraps the same fields in `sometimes` — any subset is valid. */
export type EmployeeSalaryUpdateInput = Partial<EmployeeSalaryInput>;

export interface EmployeeSalaryApi {
  list(context: FetchContext, params: EmployeeSalaryListParams): Promise<EmployeeSalaryListWire>;
  create(context: FetchContext, input: EmployeeSalaryInput): Promise<EmployeeSalaryWire>;
  update(context: FetchContext, id: number, input: EmployeeSalaryUpdateInput): Promise<EmployeeSalaryWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

export const employeeSalaryKeys = {
  all: ['employee-salaries'] as const satisfies QueryKey,
  list: (params: EmployeeSalaryListParams) =>
    ['employee-salaries', 'list', params] as const satisfies QueryKey,
};

// ─── PayslipItem ──────────────────────────────────────────────────────────────

/** Mirrors `SalaryComponentType` from the compensation module — same enum. */
export type PayslipItemType = 'earning' | 'deduction';

export interface PayslipItemListParams {
  page?: number;
  perPage?: number;
  payslip_id?: number | undefined;
  salary_component_id?: number | undefined;
  type?: PayslipItemType | undefined;
  is_taxable?: boolean | undefined;
}

/** Shape of `StorePayslipItemRequest`'s validated fields. */
export interface PayslipItemInput {
  payslip_id: number;
  salary_component_id?: number | null;
  description: string;
  type: PayslipItemType;
  amount: number;
  is_taxable?: boolean | null;
  sort_order?: number | null;
}

/** `UpdatePayslipItemRequest` wraps the same fields in `sometimes` — any subset is valid. */
export type PayslipItemUpdateInput = Partial<PayslipItemInput>;

export interface PayslipItemApi {
  list(context: FetchContext, params: PayslipItemListParams): Promise<PayslipItemListWire>;
  create(context: FetchContext, input: PayslipItemInput): Promise<PayslipItemWire>;
  update(context: FetchContext, id: number, input: PayslipItemUpdateInput): Promise<PayslipItemWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

export const payslipItemKeys = {
  all: ['payslip-items'] as const satisfies QueryKey,
  list: (params: PayslipItemListParams) =>
    ['payslip-items', 'list', params] as const satisfies QueryKey,
};
