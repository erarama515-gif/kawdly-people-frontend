import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { contractApi } from './client';
import { contractKeys } from './resource';
import type { ContractInput, ContractListParams, ContractUpdateInput } from './resource';
import type { ContractListWire, ContractWire } from './schema';

/**
 * The Contracts module's data hooks — the only place components talk to the
 * API. Mirrors `employees/api/queries.ts`: each hook owns its cache key and
 * mutation strategy, and every mutation reconciles the cache itself so
 * `ContractsPage` never writes to the query store by hand.
 */

export interface ContractListData {
  state: QueryState<ContractListWire>;
  refetch: () => void;
}

export function useContractList(params: ContractListParams): ContractListData {
  const { state, refetch } = useQuery<ContractListWire>({
    queryKey: contractKeys.list(params),
    queryFn: (context) => contractApi.list(context, params),
    staleTime: 15_000,
  });

  return { state, refetch };
}

/** True for any cached key under this module, list or single-item alike. */
function isContractKey(key: readonly unknown[]): boolean {
  return key[0] === 'contracts';
}

/** Creates a contract, then invalidates every cached list so the new row shows up wherever it belongs. */
export function useCreateContract() {
  const client = useQueryClient();

  return useMutation<ContractInput, ContractWire>({
    mutationFn: (input, { signal }) => contractApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isContractKey });
    },
  });
}

export interface UpdateContractInput extends ContractUpdateInput {
  id: number;
}

/** Updates a contract, then invalidates every cached list so edited fields show up immediately. */
export function useUpdateContract() {
  const client = useQueryClient();

  return useMutation<UpdateContractInput, ContractWire>({
    mutationFn: ({ id, ...input }, { signal }) => contractApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isContractKey });
    },
  });
}

/**
 * Deletes one contract. Optimistic: the row disappears from the current list
 * immediately so the table feels instant; a failure restores the previous
 * snapshot and refetches, so the ledger can never drift from the server.
 */
export function useDeleteContract(params: ContractListParams) {
  const client = useQueryClient();
  const key = contractKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => contractApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<ContractListWire>(key, (current) =>
        current
          ? {
              ...current,
              data: current.data.filter((contract) => contract.id !== id),
              meta: { ...current.meta, total: Math.max(0, current.meta.total - 1) },
            }
          : current,
      );
      return () => {
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate({ predicate: isContractKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isContractKey });
    },
  });
}
