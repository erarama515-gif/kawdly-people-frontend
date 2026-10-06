import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { employeeApi } from './client';
import { employeeKeys } from './resource';
import type { EmployeeInput, EmployeeListParams, EmployeeUpdateInput } from './resource';
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
