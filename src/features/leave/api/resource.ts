import type { FetchContext, QueryKey } from '@/lib/query';
import type { LeaveRequestListWire, LeaveRequestWire, LeaveTypeWire } from './schema';

/**
 * The Leave module's remote resource contract.
 *
 * Components never call this directly — they go through the query hooks in
 * `queries.ts`. Two implementations satisfy it: `httpLeaveRequestApi` (real
 * Laravel endpoints under `/api/v1/leave-requests`) and `mockLeaveRequestApi`
 * (in-process, the default until a backend is configured). Mirrors the
 * Employees feature's exact `api/` pattern.
 */

export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequestListParams {
  page?: number;
  perPage?: number;
  search?: string | undefined;
  sort?: string | undefined;
  direction?: 'asc' | 'desc' | undefined;
  status?: LeaveRequestStatus | undefined;
  employeeId?: number | undefined;
  leaveTypeId?: number | undefined;
  /** Inclusive range filter on `start_date`, mapped to `start_date_from`/`start_date_to` on the wire. */
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

/** Shape of `StoreLeaveRequestRequest`'s validated fields. */
export interface LeaveRequestInput {
  employee_id: number;
  leave_type_id: number;
  start_date: string;
  end_date: string;
  days: number;
  is_half_day?: boolean | null;
  half_day_period?: 'first_half' | 'second_half' | null;
  reason?: string | null;
  attachment?: string | null;
  status?: LeaveRequestStatus | null;
  substitute_employee_id?: number | null;
}

/** `UpdateLeaveRequestRequest` wraps the same fields in `sometimes` — any subset is valid. */
export type LeaveRequestUpdateInput = Partial<LeaveRequestInput>;

export interface LeaveRequestApi {
  list(context: FetchContext, params: LeaveRequestListParams): Promise<LeaveRequestListWire>;
  create(context: FetchContext, input: LeaveRequestInput): Promise<LeaveRequestWire>;
  update(context: FetchContext, id: number, input: LeaveRequestUpdateInput): Promise<LeaveRequestWire>;
  remove(context: FetchContext, id: number): Promise<void>;
  approve(context: FetchContext, id: number): Promise<LeaveRequestWire>;
  reject(context: FetchContext, id: number, rejectionReason?: string | null): Promise<LeaveRequestWire>;
  listLeaveTypes(context: FetchContext): Promise<LeaveTypeWire[]>;
}

/** Cache keys. Every leave-request read hangs off `all` so invalidation after a write is total. */
export const leaveRequestKeys = {
  all: ['leaveRequests'] as const satisfies QueryKey,
  list: (params: LeaveRequestListParams) => ['leaveRequests', 'list', params] as const satisfies QueryKey,
  leaveTypes: ['leaveRequests', 'leaveTypes'] as const satisfies QueryKey,
};
