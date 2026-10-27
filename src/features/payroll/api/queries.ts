import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { payrollRunApi, payslipApi, employeeSalaryApi, payslipItemApi } from './client';
import { payrollRunKeys, payslipKeys, employeeSalaryKeys, payslipItemKeys } from './resource';
import type {
  PayrollRunInput,
  PayrollRunListParams,
  PayrollRunUpdateInput,
  PayslipInput,
  PayslipListParams,
  PayslipUpdateInput,
  EmployeeSalaryInput,
  EmployeeSalaryListParams,
  EmployeeSalaryUpdateInput,
  PayslipItemInput,
  PayslipItemListParams,
  PayslipItemUpdateInput,
} from './resource';
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

/**
 * `POST /payroll-runs/{id}/calculate` — draft/calculated → calculated, totals
 * and employee_count recomputed server-side (or aggregated from mock payslips).
 */
export function useCalculatePayrollRun() {
  const client = useQueryClient();
  return useMutation<number, PayrollRunWire>({
    mutationFn: (id, { signal }) => payrollRunApi.calculate({ signal }, id),
    onSuccess: () => {
      void client.invalidate({ predicate: isPayrollRunKey });
    },
  });
}

/**
 * `POST /payroll-runs/{id}/approve` — calculated → approved, locks the run.
 */
export function useApprovePayrollRun() {
  const client = useQueryClient();
  return useMutation<number, PayrollRunWire>({
    mutationFn: (id, { signal }) => payrollRunApi.approve({ signal }, id),
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

export interface PayslipData {
  state: QueryState<PayslipWire>;
  refetch: () => void;
}

export function usePayslip(id: number | undefined, enabled = true): PayslipData {
  const { state, refetch } = useQuery<PayslipWire>({
    queryKey: payslipKeys.single(id ?? -1),
    queryFn: (context) => payslipApi.get(context, id as number),
    staleTime: 15_000,
    enabled: enabled && id !== undefined,
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

// ─── EmployeeSalary hooks ─────────────────────────────────────────────────────

export interface EmployeeSalaryListData {
  state: QueryState<EmployeeSalaryListWire>;
  refetch: () => void;
}

export function useEmployeeSalaryList(params: EmployeeSalaryListParams): EmployeeSalaryListData {
  const { state, refetch } = useQuery<EmployeeSalaryListWire>({
    queryKey: employeeSalaryKeys.list(params),
    queryFn: (context) => employeeSalaryApi.list(context, params),
    staleTime: 15_000,
  });
  return { state, refetch };
}

function isEmployeeSalaryKey(key: readonly unknown[]): boolean {
  return key[0] === 'employee-salaries';
}

export function useCreateEmployeeSalary() {
  const client = useQueryClient();
  return useMutation<EmployeeSalaryInput, EmployeeSalaryWire>({
    mutationFn: (input, { signal }) => employeeSalaryApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isEmployeeSalaryKey });
    },
  });
}

export interface UpdateEmployeeSalaryInput extends EmployeeSalaryUpdateInput {
  id: number;
}

export function useUpdateEmployeeSalary() {
  const client = useQueryClient();
  return useMutation<UpdateEmployeeSalaryInput, EmployeeSalaryWire>({
    mutationFn: ({ id, ...input }, { signal }) => employeeSalaryApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isEmployeeSalaryKey });
    },
  });
}

/**
 * Deletes one employee-salary assignment. Optimistic: the row disappears from
 * the current list immediately; a failure restores the previous snapshot.
 */
export function useDeleteEmployeeSalary(params: EmployeeSalaryListParams) {
  const client = useQueryClient();
  const key = employeeSalaryKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => employeeSalaryApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<EmployeeSalaryListWire>(key, (current) =>
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
        void client.invalidate({ predicate: isEmployeeSalaryKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isEmployeeSalaryKey });
    },
  });
}

// ─── PayslipItem hooks ────────────────────────────────────────────────────────

export interface PayslipItemListData {
  state: QueryState<PayslipItemListWire>;
  refetch: () => void;
}

export function usePayslipItemList(params: PayslipItemListParams, enabled = true): PayslipItemListData {
  const { state, refetch } = useQuery<PayslipItemListWire>({
    queryKey: payslipItemKeys.list(params),
    queryFn: (context) => payslipItemApi.list(context, params),
    staleTime: 15_000,
    enabled,
  });
  return { state, refetch };
}

function isPayslipItemKey(key: readonly unknown[]): boolean {
  return key[0] === 'payslip-items';
}

export function useCreatePayslipItem() {
  const client = useQueryClient();
  return useMutation<PayslipItemInput, PayslipItemWire>({
    mutationFn: (input, { signal }) => payslipItemApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isPayslipItemKey });
    },
  });
}

export interface UpdatePayslipItemInput extends PayslipItemUpdateInput {
  id: number;
}

export function useUpdatePayslipItem() {
  const client = useQueryClient();
  return useMutation<UpdatePayslipItemInput, PayslipItemWire>({
    mutationFn: ({ id, ...input }, { signal }) => payslipItemApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isPayslipItemKey });
    },
  });
}

/**
 * Deletes one payslip line item. Optimistic: the row disappears from the
 * current breakdown list immediately; a failure restores the previous snapshot.
 */
export function useDeletePayslipItem(params: PayslipItemListParams) {
  const client = useQueryClient();
  const key = payslipItemKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => payslipItemApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<PayslipItemListWire>(key, (current) =>
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
        void client.invalidate({ predicate: isPayslipItemKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isPayslipItemKey });
    },
  });
}
