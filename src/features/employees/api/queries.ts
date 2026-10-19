import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { employeeApi } from './client';
import { employeeKeys } from './resource';
import type {
  EmployeeInput,
  EmployeeListParams,
  EmployeePromoteInput,
  EmployeeReinstateInput,
  EmployeeSuspendInput,
  EmployeeTerminateInput,
  EmployeeTransferInput,
  EmployeeUpdateInput,
} from './resource';
import type { EmployeeListWire, EmployeeWire } from './schema';

/**
 * The Employees module's data hooks — the only place components talk to the
 * API. Mirrors the dashboard feature's `queries.ts`: each hook owns its cache
 * key and mutation strategy, and every mutation reconciles the cache itself
 * so `EmployeesPage` never writes to the query store by hand.
 */

export interface EmployeeListData {
  state: QueryState<EmployeeListWire>;
  refetch: () => void;
}

export function useEmployeeList(params: EmployeeListParams): EmployeeListData {
  const { state, refetch } = useQuery<EmployeeListWire>({
    queryKey: employeeKeys.list(params),
    queryFn: (context) => employeeApi.list(context, params),
    staleTime: 15_000,
  });

  return { state, refetch };
}

export interface EmployeeDetailData {
  state: QueryState<EmployeeWire>;
  refetch: () => void;
}

/** Fetches a single employee by id for the 360 Profile page. */
export function useEmployeeDetail(id: number): EmployeeDetailData {
  const { state, refetch } = useQuery<EmployeeWire>({
    queryKey: employeeKeys.detail(id),
    queryFn: (context) => employeeApi.show(context, id),
    staleTime: 30_000,
    enabled: id > 0,
  });

  return { state, refetch };
}

/** True for any cached key under this module, list or single-item alike. */
function isEmployeeKey(key: readonly unknown[]): boolean {
  return key[0] === 'employees';
}

/** Creates an employee, then invalidates every cached list so the new row shows up wherever it belongs (new page, new filter, etc). */
export function useCreateEmployee() {
  const client = useQueryClient();

  return useMutation<EmployeeInput, EmployeeWire>({
    mutationFn: (input, { signal }) => employeeApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isEmployeeKey });
    },
  });
}

export interface UpdateEmployeeInput extends EmployeeUpdateInput {
  id: number;
}

/** Updates an employee, then invalidates every cached list so edited fields (status, department, etc) show up immediately. */
export function useUpdateEmployee() {
  const client = useQueryClient();

  return useMutation<UpdateEmployeeInput, EmployeeWire>({
    mutationFn: ({ id, ...input }, { signal }) => employeeApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isEmployeeKey });
    },
  });
}

export interface PromoteEmployeeInput extends EmployeePromoteInput {
  id: number;
}

/** Promotes an employee (`POST /employees/{id}/promote`), then invalidates every cached list/detail. */
export function usePromoteEmployee() {
  const client = useQueryClient();

  return useMutation<PromoteEmployeeInput, EmployeeWire>({
    mutationFn: ({ id, ...input }, { signal }) => employeeApi.promote({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isEmployeeKey });
    },
  });
}

export interface TransferEmployeeInput extends EmployeeTransferInput {
  id: number;
}

/** Transfers an employee (`POST /employees/{id}/transfer`), then invalidates every cached list/detail. */
export function useTransferEmployee() {
  const client = useQueryClient();

  return useMutation<TransferEmployeeInput, EmployeeWire>({
    mutationFn: ({ id, ...input }, { signal }) => employeeApi.transfer({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isEmployeeKey });
    },
  });
}

export interface SuspendEmployeeInput extends EmployeeSuspendInput {
  id: number;
}

/** Suspends an employee (`POST /employees/{id}/suspend`), then invalidates every cached list/detail. */
export function useSuspendEmployee() {
  const client = useQueryClient();

  return useMutation<SuspendEmployeeInput, EmployeeWire>({
    mutationFn: ({ id, ...input }, { signal }) => employeeApi.suspend({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isEmployeeKey });
    },
  });
}

export interface TerminateEmployeeInput extends EmployeeTerminateInput {
  id: number;
}

/** Terminates an employee (`POST /employees/{id}/terminate`), then invalidates every cached list/detail. */
export function useTerminateEmployee() {
  const client = useQueryClient();

  return useMutation<TerminateEmployeeInput, EmployeeWire>({
    mutationFn: ({ id, ...input }, { signal }) => employeeApi.terminate({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isEmployeeKey });
    },
  });
}

export interface ReinstateEmployeeInput extends EmployeeReinstateInput {
  id: number;
}

/** Reinstates an employee (`POST /employees/{id}/reinstate`), then invalidates every cached list/detail. */
export function useReinstateEmployee() {
  const client = useQueryClient();

  return useMutation<ReinstateEmployeeInput, EmployeeWire>({
    mutationFn: ({ id, ...input }, { signal }) => employeeApi.reinstate({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isEmployeeKey });
    },
  });
}

/**
 * Deletes one employee. Optimistic: the row disappears from the current list
 * immediately so the table feels instant; a failure restores the previous
 * snapshot and refetches, so the ledger can never drift from the server.
 */
export function useDeleteEmployee(params: EmployeeListParams) {
  const client = useQueryClient();
  const key = employeeKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => employeeApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<EmployeeListWire>(key, (current) =>
        current
          ? {
              ...current,
              data: current.data.filter((employee) => employee.id !== id),
              meta: { ...current.meta, total: Math.max(0, current.meta.total - 1) },
            }
          : current,
      );
      return () => {
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate({ predicate: isEmployeeKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isEmployeeKey });
    },
  });
}
