import type { FetchContext, QueryKey } from '@/lib/query';
import type { ContractListWire, ContractWire } from './schema';

/**
 * The Contracts module's remote resource contract.
 *
 * Components never call this directly — they go through the query hooks in
 * `queries.ts`. Two implementations satisfy it: `httpContractApi` (real
 * Laravel endpoints under `/api/v1/contracts`) and `mockContractApi`
 * (in-process, the default until a backend is configured). Mirrors the
 * Employees feature's exact `api/` pattern.
 */

/** Backend-enforced values for `contracts.type`. Note: `amendment` is valid on the wire
 *  but the UI only creates `initial` or `renewal`; `amendment` rows are read-only here. */
export type ContractType = 'initial' | 'renewal' | 'amendment';

/** UI-side subset used for create/filter; we expose amendment as a read-only type. */
export type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated';

export interface ContractListParams {
  page?: number;
  perPage?: number;
  search?: string | undefined;
  status?: ContractStatus | undefined;
  employeeId?: number | undefined;
}

/**
 * Shape of `StoreContractRequest`'s validated fields.
 * Field names match Laravel column names verbatim (snake_case).
 * `created_by` is required by the backend — the UI passes `1` as a
 * placeholder until auth context is wired (same approach as Employees'
 * `company_id`).
 */
export interface ContractInput {
  employee_id: number;
  type: ContractType;
  start_date: string;
  end_date?: string | null;
  probation_months?: number | null;
  basic_salary: number;
  terms?: string | null;
  status?: ContractStatus | null;
  signed_at?: string | null;
  attachment?: string | null;
  parent_contract_id?: number | null;
  created_by: number;
}

/** `UpdateContractRequest` wraps fields in `sometimes` — any subset is valid. */
export type ContractUpdateInput = Partial<ContractInput>;

export interface ContractApi {
  list(context: FetchContext, params: ContractListParams): Promise<ContractListWire>;
  create(context: FetchContext, input: ContractInput): Promise<ContractWire>;
  update(context: FetchContext, id: number, input: ContractUpdateInput): Promise<ContractWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

/** Cache keys. Every contracts read hangs off `all` so invalidation after a write is total. */
export const contractKeys = {
  all: ['contracts'] as const satisfies QueryKey,
  list: (params: ContractListParams) => ['contracts', 'list', params] as const satisfies QueryKey,
};
