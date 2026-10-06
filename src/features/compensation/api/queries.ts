import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { salaryStructureApi, salaryComponentApi } from './client';
import { salaryStructureKeys, salaryComponentKeys } from './resource';
import type {
  SalaryStructureInput,
  SalaryStructureListParams,
  SalaryStructureUpdateInput,
  SalaryComponentInput,
  SalaryComponentListParams,
  SalaryComponentUpdateInput,
} from './resource';
import type {
  SalaryStructureListWire,
  SalaryStructureWire,
  SalaryComponentListWire,
  SalaryComponentWire,
} from './schema';

/**
 * Compensation module data hooks — the only place components talk to the API.
 * Two resource families: SalaryStructure + SalaryComponent. Each mirrors
 * the Attendance/Contracts `queries.ts` pattern exactly.
 */

// ─── SalaryStructure hooks ────────────────────────────────────────────────────

export interface SalaryStructureListData {
  state: QueryState<SalaryStructureListWire>;
  refetch: () => void;
}

export function useSalaryStructureList(params: SalaryStructureListParams): SalaryStructureListData {
  const { state, refetch } = useQuery<SalaryStructureListWire>({
    queryKey: salaryStructureKeys.list(params),
    queryFn: (context) => salaryStructureApi.list(context, params),
    staleTime: 15_000,
  });
  return { state, refetch };
}

function isSalaryStructureKey(key: readonly unknown[]): boolean {
  return key[0] === 'salary-structures';
}

export function useCreateSalaryStructure() {
  const client = useQueryClient();
  return useMutation<SalaryStructureInput, SalaryStructureWire>({
    mutationFn: (input, { signal }) => salaryStructureApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isSalaryStructureKey });
    },
  });
}

export interface UpdateSalaryStructureInput extends SalaryStructureUpdateInput {
  id: number;
}

export function useUpdateSalaryStructure() {
  const client = useQueryClient();
  return useMutation<UpdateSalaryStructureInput, SalaryStructureWire>({
    mutationFn: ({ id, ...input }, { signal }) => salaryStructureApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isSalaryStructureKey });
    },
  });
}

/**
 * Optimistic delete for SalaryStructure. On success also invalidates
 * salary-components since deleting a structure orphans its components in the mock.
 */
export function useDeleteSalaryStructure(params: SalaryStructureListParams) {
  const client = useQueryClient();
  const key = salaryStructureKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => salaryStructureApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<SalaryStructureListWire>(key, (current) =>
        current
          ? {
              ...current,
              data: current.data.filter((s) => s.id !== id),
              meta: { ...current.meta, total: Math.max(0, current.meta.total - 1) },
            }
          : current,
      );
      return () => {
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate({ predicate: isSalaryStructureKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isSalaryStructureKey });
      // Cascade: components referencing the deleted structure are now gone
      void client.invalidate({ predicate: isSalaryComponentKey });
    },
  });
}

// ─── SalaryComponent hooks ────────────────────────────────────────────────────

export interface SalaryComponentListData {
  state: QueryState<SalaryComponentListWire>;
  refetch: () => void;
}

export function useSalaryComponentList(params: SalaryComponentListParams): SalaryComponentListData {
  const { state, refetch } = useQuery<SalaryComponentListWire>({
    queryKey: salaryComponentKeys.list(params),
    queryFn: (context) => salaryComponentApi.list(context, params),
    staleTime: 15_000,
  });
  return { state, refetch };
}

function isSalaryComponentKey(key: readonly unknown[]): boolean {
  return key[0] === 'salary-components';
}

export function useCreateSalaryComponent() {
  const client = useQueryClient();
  return useMutation<SalaryComponentInput, SalaryComponentWire>({
    mutationFn: (input, { signal }) => salaryComponentApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isSalaryComponentKey });
    },
  });
}

export interface UpdateSalaryComponentInput extends SalaryComponentUpdateInput {
  id: number;
}

export function useUpdateSalaryComponent() {
  const client = useQueryClient();
  return useMutation<UpdateSalaryComponentInput, SalaryComponentWire>({
    mutationFn: ({ id, ...input }, { signal }) => salaryComponentApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isSalaryComponentKey });
    },
  });
}

export function useDeleteSalaryComponent(params: SalaryComponentListParams) {
  const client = useQueryClient();
  const key = salaryComponentKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => salaryComponentApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<SalaryComponentListWire>(key, (current) =>
        current
          ? {
              ...current,
              data: current.data.filter((c) => c.id !== id),
              meta: { ...current.meta, total: Math.max(0, current.meta.total - 1) },
            }
          : current,
      );
      return () => {
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate({ predicate: isSalaryComponentKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isSalaryComponentKey });
    },
  });
}
