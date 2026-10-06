import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { trainingProgramApi } from './client';
import { trainingProgramKeys } from './resource';
import type {
  TrainingProgramInput,
  TrainingProgramListParams,
  TrainingProgramUpdateInput,
} from './resource';
import type { TrainingProgramListWire, TrainingProgramWire } from './schema';

/**
 * The Learning / TrainingProgram module's data hooks — the only place
 * components talk to the API. Mirrors `contracts/api/queries.ts`: each hook
 * owns its cache key and mutation strategy, and every mutation reconciles the
 * cache itself so `LearningPage` never writes to the query store by hand.
 */

export interface TrainingProgramListData {
  state: QueryState<TrainingProgramListWire>;
  refetch: () => void;
}

export function useTrainingProgramList(params: TrainingProgramListParams): TrainingProgramListData {
  const { state, refetch } = useQuery<TrainingProgramListWire>({
    queryKey: trainingProgramKeys.list(params),
    queryFn: (context) => trainingProgramApi.list(context, params),
    staleTime: 15_000,
  });

  return { state, refetch };
}

/** True for any cached key under this module, list or single-item alike. */
function isTrainingProgramKey(key: readonly unknown[]): boolean {
  return key[0] === 'trainingPrograms';
}

/** Creates a training program, then invalidates every cached list so the new row shows up. */
export function useCreateTrainingProgram() {
  const client = useQueryClient();

  return useMutation<TrainingProgramInput, TrainingProgramWire>({
    mutationFn: (input, { signal }) => trainingProgramApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isTrainingProgramKey });
    },
  });
}

export interface UpdateTrainingProgramInput extends TrainingProgramUpdateInput {
  id: number;
}

/** Updates a training program, then invalidates every cached list so edited fields show up. */
export function useUpdateTrainingProgram() {
  const client = useQueryClient();

  return useMutation<UpdateTrainingProgramInput, TrainingProgramWire>({
    mutationFn: ({ id, ...input }, { signal }) =>
      trainingProgramApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isTrainingProgramKey });
    },
  });
}

/**
 * Deletes one training program. Optimistic: the row disappears from the
 * current list immediately so the table feels instant; a failure restores the
 * previous snapshot and refetches, so the ledger can never drift from the
 * server.
 */
export function useDeleteTrainingProgram(params: TrainingProgramListParams) {
  const client = useQueryClient();
  const key = trainingProgramKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => trainingProgramApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<TrainingProgramListWire>(key, (current) =>
        current
          ? {
              ...current,
              data: current.data.filter((program) => program.id !== id),
              meta: { ...current.meta, total: Math.max(0, current.meta.total - 1) },
            }
          : current,
      );
      return () => {
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate({ predicate: isTrainingProgramKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isTrainingProgramKey });
    },
  });
}
