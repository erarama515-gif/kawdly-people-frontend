import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { payrollRunApi, payslipApi } from './client';
import { payrollRunKeys, payslipKeys } from './resource';
import type {
  PayrollRunInput,
  PayrollRunListParams,
  PayrollRunUpdateInput,
  PayslipInput,
  PayslipListParams,
  PayslipUpdateInput,
} from './resource';
import type {
  PayrollRunListWire,
  PayrollRunWire,
  PayslipListWire,
  PayslipWire,
} from './schema';

/**
 * The Payroll module's data hooks — one set per resource.
 *
 * Mirrors `career/api/queries.ts`: each hook owns its cache key and
 * mutation strategy, and every mutation reconciles the cache itself so
 * PayrollPage never writes to the query store by hand.
 *
 * Optimistic delete + rollback is implemented for both resources.
 */

// ─── PayrollRun hooks ─────────────────────────────────────────────────────────

export interface PayrollRunListData {
  state: QueryState<PayrollRunListWire>;
  refetch: () => void;
}

export function usePayrollRunList(params: PayrollRunListParams): PayrollRunListData {
  const { state, refetch } = useQuery<PayrollRunListWire>({
    queryKey: payrollRunKeys.list(params),
    queryFn: (context) => payrollRunApi.list(context, params),
    staleTime: 15_000,
  });
  return { state, refetch };
}

function isPayrollRunKey(key: readonly unknown[]): boolean {
  return key[0] === 'payroll-runs';
}

export function useCreatePayrollRun() {
  const client = useQueryClient();
  return useMutation<PayrollRunInput, PayrollRunWire>({
    mutationFn: (input, { signal }) => payrollRunApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isPayrollRunKey });
    },
  });
}

export interface UpdatePayrollRunInput extends PayrollRunUpdateInput {
  id: number;
}

export function useUpdatePayrollRun() {
  const client = useQueryClient();
  return useMutation<UpdatePayrollRunInput, PayrollRunWire>({
    mutationFn: ({ id, ...input }, { signal }) => payrollRunApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isPayrollRunKey });
    },
  });
}

/**
 * Deletes one payroll run. Optimistic: the row disappears from the current list
 * immediately; a failure restores the previous snapshot and refetches.
 */
export function useDeletePayrollRun(params: PayrollRunListParams) {
  const client = useQueryClient();
  const key = payrollRunKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => payrollRunApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<PayrollRunListWire>(key, (current) =>
        current
          ? {
              ...current,
              data: current.data.filter((record) => record.id !== id),
              meta: { ...current.meta, total: Math.max(0, current.meta.total - 1) },
            }
          : current,
      );
      return () => {
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate({ predicate: isPayrollRunKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isPayrollRunKey });
    },
  });
}

// ─── Payslip hooks ────────────────────────────────────────────────────────────

export interface PayslipListData {
  state: QueryState<PayslipListWire>;
  refetch: () => void;
}

export function usePayslipList(params: PayslipListParams): PayslipListData {
  const { state, refetch } = useQuery<PayslipListWire>({
    queryKey: payslipKeys.list(params),
    queryFn: (context) => payslipApi.list(context, params),
    staleTime: 15_000,
  });
  return { state, refetch };
}

function isPayslipKey(key: readonly unknown[]): boolean {
  return key[0] === 'payslips';
}

export function useCreatePayslip() {
  const client = useQueryClient();
  return useMutation<PayslipInput, PayslipWire>({
    mutationFn: (input, { signal }) => payslipApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isPayslipKey });
    },
  });
}

export interface UpdatePayslipInput extends PayslipUpdateInput {
  id: number;
}

export function useUpdatePayslip() {
  const client = useQueryClient();
  return useMutation<UpdatePayslipInput, PayslipWire>({
    mutationFn: ({ id, ...input }, { signal }) => payslipApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isPayslipKey });
    },
  });
}

/**
 * Deletes one payslip. Optimistic: the row disappears from the current list
 * immediately; a failure restores the previous snapshot.
 */
export function useDeletePayslip(params: PayslipListParams) {
  const client = useQueryClient();
  const key = payslipKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => payslipApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<PayslipListWire>(key, (current) =>
        current
          ? {
              ...current,
              data: current.data.filter((record) => record.id !== id),
              meta: { ...current.meta, total: Math.max(0, current.meta.total - 1) },
            }
          : current,
      );
      return () => {
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate({ predicate: isPayslipKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isPayslipKey });
    },
  });
}
