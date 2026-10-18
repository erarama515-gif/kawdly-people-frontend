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
 * `created_by` is sent from the authenticated user id (`getCurrentUserId()`).
 * The controller also overwrites it with `$request->user()->id`, so the value
 * is authoritative server-side either way.
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

/** Shape of `TerminateContractRequest`'s validated fields — both optional. */
export interface ContractTerminateInput {
  termination_date?: string | null;
  reason?: string | null;
}

export interface ContractApi {
  list(context: FetchContext, params: ContractListParams): Promise<ContractListWire>;
  create(context: FetchContext, input: ContractInput): Promise<ContractWire>;
  update(context: FetchContext, id: number, input: ContractUpdateInput): Promise<ContractWire>;
  remove(context: FetchContext, id: number): Promise<void>;
  /** `POST /contracts/{id}/terminate` — sets status=terminated, optionally end_date + a reason note. */
  terminate(context: FetchContext, id: number, input: ContractTerminateInput): Promise<ContractWire>;
}

/** Cache keys. Every contracts read hangs off `all` so invalidation after a write is total. */
export const contractKeys = {
  all: ['contracts'] as const satisfies QueryKey,
  list: (params: ContractListParams) => ['contracts', 'list', params] as const satisfies QueryKey,
};
