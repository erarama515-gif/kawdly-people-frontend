import type { FetchContext, QueryKey } from '@/lib/query';
import type {
  PayrollRunListWire,
  PayrollRunWire,
  PayslipListWire,
  PayslipWire,
} from './schema';

/**
 * The Payroll module's remote resource contract for TWO resources:
 *   1. PayrollRun  — /api/v1/payroll-runs
 *   2. Payslip     — /api/v1/payslips
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
 *       created_by (req int — hardcoded 1)
 *   - StorePayslipRequest:
 *       payroll_run_id (req int), employee_id (req int),
 *       basic_salary (req int), gross_salary (req int), total_earnings (req int),
 *       total_deductions (req int), net_salary (req int),
 *       working_days (nullable numeric), present_days (nullable numeric),
 *       absent_days (nullable numeric), overtime_hours (nullable numeric),
 *       overtime_amount (nullable int), status (nullable enum: draft|finalized|paid)
 *
 * SKIPPED actions (same precedent as Loans skipping /approve):
 *   POST /api/v1/payroll-runs/{id}/calculate  — requires auth/session context
 *   POST /api/v1/payroll-runs/{id}/approve    — requires auth/session context
 * Wire both up as a follow-up once authentication is in place.
 *
 * OUT OF SCOPE for this task (separate follow-up):
 *   EmployeeSalary  (/api/v1/employee-salaries)
 *   PayslipItem     (/api/v1/payslip-items)
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
}

/** Shape of `StorePayrollRunRequest`'s validated fields. */
export interface PayrollRunInput {
  company_id: number;
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
