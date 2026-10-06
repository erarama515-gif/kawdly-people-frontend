import type { FetchContext, QueryKey } from '@/lib/query';
import type { LoanListWire, LoanWire } from './schema';

/**
 * The Loans module's remote resource contract.
 *
 * Components never call this directly — they go through the query hooks in
 * `queries.ts`. Two implementations satisfy it: `httpLoanApi` (real Laravel
 * endpoints under `/api/v1/loans`) and `mockLoanApi` (in-process, the default
 * until a backend is configured). Mirrors the Employees / Attendance /
 * Contracts features' exact `api/` pattern.
 */

/**
 * Real backend values from `StoreLoanRequest`:
 *   loan | advance
 */
export type LoanType = 'loan' | 'advance';

/**
 * Real backend values from `StoreLoanRequest`:
 *   pending | active | completed | cancelled
 *
 * NOTE: The old UI mock had a `defaulted` status — that is NOT a real backend
 * value and has been dropped entirely.
 */
export type LoanStatus = 'pending' | 'active' | 'completed' | 'cancelled';

export interface LoanListParams {
  page?: number;
  perPage?: number;
  search?: string | undefined;
  status?: LoanStatus | undefined;
  employeeId?: number | undefined;
}

/** Shape of `StoreLoanRequest`'s validated fields (snake_case, verbatim). */
export interface LoanInput {
  employee_id: number;
  type: LoanType;
  amount: number;
  installment_amount: number;
  total_installments: number;
  paid_installments?: number | null;
  remaining_amount: number;
  start_date: string;
  status?: LoanStatus | null;
  reason?: string | null;
  approved_by?: number | null;
  approved_at?: string | null;
}

/** `UpdateLoanRequest` wraps the same fields in `sometimes` — any subset is valid. */
export type LoanUpdateInput = Partial<LoanInput>;

export interface LoanApi {
  list(context: FetchContext, params: LoanListParams): Promise<LoanListWire>;
  create(context: FetchContext, input: LoanInput): Promise<LoanWire>;
  update(context: FetchContext, id: number, input: LoanUpdateInput): Promise<LoanWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

/** Cache keys. Every loan read hangs off `all` so invalidation after a write is total. */
export const loanKeys = {
  all: ['loans'] as const satisfies QueryKey,
  list: (params: LoanListParams) => ['loans', 'list', params] as const satisfies QueryKey,
};
