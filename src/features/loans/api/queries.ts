import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { loanApi } from './client';
import { loanKeys } from './resource';
import type { LoanInput, LoanListParams, LoanUpdateInput } from './resource';
import type { LoanListWire, LoanWire } from './schema';

/**
 * The Loans module's data hooks — the only place components talk to the API.
 * Mirrors the Attendance / Contracts features' `queries.ts`: each hook owns
 * its cache key and mutation strategy, and every mutation reconciles the cache
 * itself so `LoansPage` never writes to the query store by hand.
 */

export interface LoanListData {
  state: QueryState<LoanListWire>;
  refetch: () => void;
}

export function useLoanList(params: LoanListParams): LoanListData {
  const { state, refetch } = useQuery<LoanListWire>({
    queryKey: loanKeys.list(params),
    queryFn: (context) => loanApi.list(context, params),
    staleTime: 15_000,
  });

  return { state, refetch };
}

/** True for any cached key under this module, list or single-item alike. */
function isLoanKey(key: readonly unknown[]): boolean {
  return key[0] === 'loans';
}

/** Creates a loan, then invalidates every cached list so the new row shows up wherever it belongs. */
export function useCreateLoan() {
  const client = useQueryClient();

  return useMutation<LoanInput, LoanWire>({
    mutationFn: (input, { signal }) => loanApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isLoanKey });
    },
  });
}

export interface UpdateLoanInput extends LoanUpdateInput {
  id: number;
}

/** Updates a loan, then invalidates every cached list so edited fields show up immediately. */
export function useUpdateLoan() {
  const client = useQueryClient();

  return useMutation<UpdateLoanInput, LoanWire>({
    mutationFn: ({ id, ...input }, { signal }) => loanApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isLoanKey });
    },
  });
}

/**
 * Deletes one loan. Optimistic: the row disappears from the current list
 * immediately so the table feels instant; a failure restores the previous
 * snapshot and refetches, so the ledger can never drift from the server.
 */
export function useDeleteLoan(params: LoanListParams) {
  const client = useQueryClient();
  const key = loanKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => loanApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<LoanListWire>(key, (current) =>
        current
          ? {
              ...current,
              data: current.data.filter((loan) => loan.id !== id),
              meta: { ...current.meta, total: Math.max(0, current.meta.total - 1) },
            }
          : current,
      );
      return () => {
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate({ predicate: isLoanKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isLoanKey });
    },
  });
}
