import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import {
  array,
  bool,
  literalUnion,
  num,
  object,
  optional,
  passthrough,
  str,
} from '@/lib/api/decode';

/**
 * Admin-side leave hooks (A6.5): leave types, yearly balances, and policies.
 *
 * These are separate from `queries.ts` (which owns leave *requests*) because
 * they are configuration surfaces with their own permission slugs
 * (`leave.leave_type.*`, `leave.leave_balance.*`, `leave.leave_policy.*`) and
 * their own cache namespace. Creating/editing a leave type also invalidates the
 * request module's type list so the request form picks the change up.
 */

// ─── Leave Types ──────────────────────────────────────────────────────────────

export const leaveTypeAdminDecoder = object({
  id: num(),
  name: str(),
  code: optional(str()),
  is_paid: optional(bool()),
  requires_attachment: optional(bool()),
  max_days_per_request: optional(num()),
  // `decimal:1` cast → string on the wire.
  min_days_per_request: optional(str()),
  allows_half_day: optional(bool()),
  gender_restriction: optional(literalUnion(['male', 'female'] as const)),
  color: optional(str()),
  sort_order: optional(num()),
  is_active: optional(bool()),
});

export type LeaveTypeAdminWire = ReturnType<typeof leaveTypeAdminDecoder.decode>;

const leaveTypeAdminListDecoder = object({
  data: array(leaveTypeAdminDecoder),
  meta: object({
    current_page: num(),
    per_page: num(),
    total: num(),
    last_page: num(),
  }),
});

export type LeaveTypeAdminListWire = ReturnType<typeof leaveTypeAdminListDecoder.decode>;

const leaveTypeEnvelopeDecoder = object({ data: leaveTypeAdminDecoder });

export interface LeaveTypeInput {
  name: string;
  code?: string | null;
  is_paid?: boolean;
  requires_attachment?: boolean;
  max_days_per_request?: number | null;
  min_days_per_request?: number | null;
  allows_half_day?: boolean;
  gender_restriction?: 'male' | 'female' | null;
  color?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

// ─── Leave Policies ───────────────────────────────────────────────────────────

const leaveTypeRefDecoder = object({
  id: num(),
  name: str(),
  color: optional(str()),
});

export const leavePolicyDecoder = object({
  id: num(),
  leave_type_id: num(),
  name: str(),
  annual_entitlement: str(),
  accrual_method: literalUnion(['yearly', 'monthly', 'none'] as const),
  carry_forward_max: optional(str()),
  carry_forward_expiry_months: optional(num()),
  encashment_allowed: optional(bool()),
  encashment_max_days: optional(str()),
  min_service_months: optional(num()),
  conditions: optional(array(passthrough())),
  is_active: optional(bool()),
  leave_type: optional(leaveTypeRefDecoder),
});

export type LeavePolicyWire = ReturnType<typeof leavePolicyDecoder.decode>;

const leavePolicyListDecoder = object({
  data: array(leavePolicyDecoder),
  meta: object({
    current_page: num(),
    per_page: num(),
    total: num(),
    last_page: num(),
  }),
});

export type LeavePolicyListWire = ReturnType<typeof leavePolicyListDecoder.decode>;

const leavePolicyEnvelopeDecoder = object({ data: leavePolicyDecoder });

export interface LeavePolicyInput {
  leave_type_id: number;
  name: string;
  annual_entitlement: number;
  accrual_method: 'yearly' | 'monthly' | 'none';
  carry_forward_max?: number | null;
  carry_forward_expiry_months?: number | null;
  encashment_allowed?: boolean;
  encashment_max_days?: number | null;
  min_service_months?: number | null;
  conditions?: unknown[];
  is_active?: boolean;
}

// ─── Leave Balances ───────────────────────────────────────────────────────────

const employeeRefDecoder = object({
  id: num(),
  first_name: str(),
  last_name: str(),
  first_name_ar: optional(str()),
  last_name_ar: optional(str()),
  employee_number: str(),
});

export const leaveBalanceDecoder = object({
  id: num(),
  employee_id: num(),
  leave_type_id: num(),
  year: num(),
  entitled: str(),
  taken: str(),
  pending: str(),
  carried_forward: str(),
  adjustment: str(),
  balance: str(),
  employee: optional(employeeRefDecoder),
  leave_type: optional(leaveTypeRefDecoder),
});

export type LeaveBalanceWire = ReturnType<typeof leaveBalanceDecoder.decode>;

const leaveBalanceListDecoder = object({
  data: array(leaveBalanceDecoder),
  meta: object({
    current_page: num(),
    per_page: num(),
    total: num(),
    last_page: num(),
  }),
});

export type LeaveBalanceListWire = ReturnType<typeof leaveBalanceListDecoder.decode>;

const leaveBalanceEnvelopeDecoder = object({ data: leaveBalanceDecoder });

export interface LeaveBalanceInput {
  employee_id: number;
  leave_type_id: number;
  year: number;
  entitled?: number;
  taken?: number;
  pending?: number;
  carried_forward?: number;
  adjustment?: number;
}

export interface LeaveBalanceListParams {
  page: number;
  perPage: number;
  employeeId?: number | undefined;
  leaveTypeId?: number | undefined;
  year?: number | undefined;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const ADMIN_ROOT = ['leaveAdmin'] as const;

function isAdminKey(key: readonly unknown[]): boolean {
  return key[0] === 'leaveAdmin';
}

function isLeaveRequestKey(key: readonly unknown[]): boolean {
  return key[0] === 'leaveRequests';
}

/** Remaining is a model accessor (not in `$appends`), so compute it client-side. */
export function remainingDays(balance: LeaveBalanceWire): number {
  const total =
    Number(balance.entitled) +
    Number(balance.carried_forward) +
    Number(balance.adjustment) -
    Number(balance.taken) -
    Number(balance.pending);
  return Math.max(0, Math.round(total * 10) / 10);
}

// ─── Leave type hooks ─────────────────────────────────────────────────────────

export interface UseLeaveTypeAdminListResult {
  state: QueryState<LeaveTypeAdminListWire>;
  refetch: () => void;
}

export function useLeaveTypeAdminList(): UseLeaveTypeAdminListResult {
  const { state, refetch } = useQuery<LeaveTypeAdminListWire>({
    queryKey: [...ADMIN_ROOT, 'leaveTypes'] as const,
    queryFn: async (context) => {
      const { data } = await http('/leave-types', {
        query: { per_page: 200, sort: 'sort_order', direction: 'asc' },
        signal: context.signal,
        schema: leaveTypeAdminListDecoder,
      });
      if (data === undefined) throw new Error('GET /leave-types returned an empty body');
      return data;
    },
    staleTime: 30_000,
  });

  return { state, refetch };
}

export function useCreateLeaveType() {
  const client = useQueryClient();

  return useMutation<LeaveTypeInput, LeaveTypeAdminWire>({
    mutationFn: async (input, { signal }) => {
      const { data } = await http('/leave-types', {
        method: 'POST',
        body: input,
        signal,
        schema: leaveTypeEnvelopeDecoder,
      });
      if (data === undefined) throw new Error('POST /leave-types returned an empty body');
      return data.data;
    },
    onSuccess: () => {
      void client.invalidate({ predicate: isAdminKey });
      void client.invalidate({ predicate: isLeaveRequestKey });
    },
  });
}

export interface UpdateLeaveTypeArgs extends LeaveTypeInput {
  id: number;
}

export function useUpdateLeaveType() {
  const client = useQueryClient();

  return useMutation<UpdateLeaveTypeArgs, LeaveTypeAdminWire>({
    mutationFn: async ({ id, ...input }, { signal }) => {
      const { data } = await http(`/leave-types/${id}`, {
        method: 'PATCH',
        body: input,
        signal,
        schema: leaveTypeEnvelopeDecoder,
      });
      if (data === undefined) throw new Error(`PATCH /leave-types/${id} returned an empty body`);
      return data.data;
    },
    onSuccess: () => {
      void client.invalidate({ predicate: isAdminKey });
      void client.invalidate({ predicate: isLeaveRequestKey });
    },
  });
}

export function useDeleteLeaveType() {
  const client = useQueryClient();

  return useMutation<number, void>({
    mutationFn: async (id, { signal }) => {
      await http(`/leave-types/${id}`, { method: 'DELETE', signal, ignoreBody: true });
    },
    onSuccess: () => {
      void client.invalidate({ predicate: isAdminKey });
      void client.invalidate({ predicate: isLeaveRequestKey });
    },
  });
}

// ─── Leave policy hooks ───────────────────────────────────────────────────────

export interface UseLeavePolicyAdminListResult {
  state: QueryState<LeavePolicyListWire>;
  refetch: () => void;
}

export function useLeavePolicyAdminList(): UseLeavePolicyAdminListResult {
  const { state, refetch } = useQuery<LeavePolicyListWire>({
    queryKey: [...ADMIN_ROOT, 'leavePolicies'] as const,
    queryFn: async (context) => {
      const { data } = await http('/leave-policies', {
        query: { per_page: 100, include: 'leaveType', sort: 'id', direction: 'desc' },
        signal: context.signal,
        schema: leavePolicyListDecoder,
      });
      if (data === undefined) throw new Error('GET /leave-policies returned an empty body');
      return data;
    },
    staleTime: 30_000,
  });

  return { state, refetch };
}

export function useCreateLeavePolicy() {
  const client = useQueryClient();

  return useMutation<LeavePolicyInput, LeavePolicyWire>({
    mutationFn: async (input, { signal }) => {
      const { data } = await http('/leave-policies', {
        method: 'POST',
        body: input,
        signal,
        schema: leavePolicyEnvelopeDecoder,
      });
      if (data === undefined) throw new Error('POST /leave-policies returned an empty body');
      return data.data;
    },
    onSuccess: () => {
      void client.invalidate({ predicate: isAdminKey });
    },
  });
}

export interface UpdateLeavePolicyArgs extends LeavePolicyInput {
  id: number;
}

export function useUpdateLeavePolicy() {
  const client = useQueryClient();

  return useMutation<UpdateLeavePolicyArgs, LeavePolicyWire>({
    mutationFn: async ({ id, ...input }, { signal }) => {
      const { data } = await http(`/leave-policies/${id}`, {
        method: 'PATCH',
        body: input,
        signal,
        schema: leavePolicyEnvelopeDecoder,
      });
      if (data === undefined) throw new Error(`PATCH /leave-policies/${id} returned an empty body`);
      return data.data;
    },
    onSuccess: () => {
      void client.invalidate({ predicate: isAdminKey });
    },
  });
}

export function useDeleteLeavePolicy() {
  const client = useQueryClient();

  return useMutation<number, void>({
    mutationFn: async (id, { signal }) => {
      await http(`/leave-policies/${id}`, { method: 'DELETE', signal, ignoreBody: true });
    },
    onSuccess: () => {
      void client.invalidate({ predicate: isAdminKey });
    },
  });
}

// ─── Leave balance hooks ──────────────────────────────────────────────────────

export interface UseLeaveBalanceAdminListResult {
  state: QueryState<LeaveBalanceListWire>;
  refetch: () => void;
}

export function useLeaveBalanceAdminList(
  params: LeaveBalanceListParams,
): UseLeaveBalanceAdminListResult {
  const { state, refetch } = useQuery<LeaveBalanceListWire>({
    queryKey: [...ADMIN_ROOT, 'leaveBalances', params] as const,
    queryFn: async (context) => {
      const { data } = await http('/leave-balances', {
        query: {
          page: params.page,
          per_page: params.perPage,
          employee_id: params.employeeId,
          leave_type_id: params.leaveTypeId,
          year: params.year,
          include: 'employee,leaveType',
          sort: 'id',
          direction: 'desc',
        },
        signal: context.signal,
        schema: leaveBalanceListDecoder,
      });
      if (data === undefined) throw new Error('GET /leave-balances returned an empty body');
      return data;
    },
    staleTime: 15_000,
  });

  return { state, refetch };
}

export function useCreateLeaveBalance() {
  const client = useQueryClient();

  return useMutation<LeaveBalanceInput, LeaveBalanceWire>({
    mutationFn: async (input, { signal }) => {
      const { data } = await http('/leave-balances', {
        method: 'POST',
        body: input,
        signal,
        schema: leaveBalanceEnvelopeDecoder,
      });
      if (data === undefined) throw new Error('POST /leave-balances returned an empty body');
      return data.data;
    },
    onSuccess: () => {
      void client.invalidate({ predicate: isAdminKey });
    },
  });
}

export interface UpdateLeaveBalanceArgs extends Partial<LeaveBalanceInput> {
  id: number;
}

export function useUpdateLeaveBalance() {
  const client = useQueryClient();

  return useMutation<UpdateLeaveBalanceArgs, LeaveBalanceWire>({
    mutationFn: async ({ id, ...input }, { signal }) => {
      const { data } = await http(`/leave-balances/${id}`, {
        method: 'PATCH',
        body: input,
        signal,
        schema: leaveBalanceEnvelopeDecoder,
      });
      if (data === undefined) throw new Error(`PATCH /leave-balances/${id} returned an empty body`);
      return data.data;
    },
    onSuccess: () => {
      void client.invalidate({ predicate: isAdminKey });
    },
  });
}

export function useDeleteLeaveBalance() {
  const client = useQueryClient();

  return useMutation<number, void>({
    mutationFn: async (id, { signal }) => {
      await http(`/leave-balances/${id}`, { method: 'DELETE', signal, ignoreBody: true });
    },
    onSuccess: () => {
      void client.invalidate({ predicate: isAdminKey });
    },
  });
}
