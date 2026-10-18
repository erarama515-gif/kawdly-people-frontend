import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { trainingProgramApi, trainingEnrollmentApi, learningPathApi, learningPathStepApi } from './client';
import {
  trainingProgramKeys,
  trainingEnrollmentKeys,
  learningPathKeys,
  learningPathStepKeys,
} from './resource';
import type {
  TrainingProgramInput,
  TrainingProgramListParams,
  TrainingProgramUpdateInput,
  TrainingEnrollmentInput,
  TrainingEnrollmentListParams,
  TrainingEnrollmentUpdateInput,
  LearningPathInput,
  LearningPathListParams,
  LearningPathUpdateInput,
  LearningPathStepInput,
  LearningPathStepListParams,
  LearningPathStepUpdateInput,
} from './resource';
import type {
  TrainingProgramListWire,
  TrainingProgramWire,
  TrainingEnrollmentListWire,
  TrainingEnrollmentWire,
  LearningPathListWire,
  LearningPathWire,
  LearningPathStepListWire,
  LearningPathStepWire,
} from './schema';

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

// ─── TrainingEnrollment ───────────────────────────────────────────────────────

export interface TrainingEnrollmentListData {
  state: QueryState<TrainingEnrollmentListWire>;
  refetch: () => void;
}

export function useTrainingEnrollmentList(
  params: TrainingEnrollmentListParams,
  enabled = true,
): TrainingEnrollmentListData {
  const { state, refetch } = useQuery<TrainingEnrollmentListWire>({
    queryKey: trainingEnrollmentKeys.list(params),
    queryFn: (context) => trainingEnrollmentApi.list(context, params),
    staleTime: 15_000,
    enabled,
  });

  return { state, refetch };
}

function isTrainingEnrollmentKey(key: readonly unknown[]): boolean {
  return key[0] === 'trainingEnrollments';
}

export function useCreateTrainingEnrollment() {
  const client = useQueryClient();

  return useMutation<TrainingEnrollmentInput, TrainingEnrollmentWire>({
    mutationFn: (input, { signal }) => trainingEnrollmentApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isTrainingEnrollmentKey });
    },
  });
}

export interface UpdateTrainingEnrollmentInput extends TrainingEnrollmentUpdateInput {
  id: number;
}

export function useUpdateTrainingEnrollment() {
  const client = useQueryClient();

  return useMutation<UpdateTrainingEnrollmentInput, TrainingEnrollmentWire>({
    mutationFn: ({ id, ...input }, { signal }) => trainingEnrollmentApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isTrainingEnrollmentKey });
    },
  });
}

/**
 * Deletes one enrollment. Optimistic: the row disappears from the current
 * breakdown list immediately; a failure restores the previous snapshot.
 */
export function useDeleteTrainingEnrollment(params: TrainingEnrollmentListParams) {
  const client = useQueryClient();
  const key = trainingEnrollmentKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => trainingEnrollmentApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<TrainingEnrollmentListWire>(key, (current) =>
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
        void client.invalidate({ predicate: isTrainingEnrollmentKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isTrainingEnrollmentKey });
    },
  });
}

// ─── LearningPath ─────────────────────────────────────────────────────────────

export interface LearningPathListData {
  state: QueryState<LearningPathListWire>;
  refetch: () => void;
}

export function useLearningPathList(params: LearningPathListParams): LearningPathListData {
  const { state, refetch } = useQuery<LearningPathListWire>({
    queryKey: learningPathKeys.list(params),
    queryFn: (context) => learningPathApi.list(context, params),
    staleTime: 15_000,
  });

  return { state, refetch };
}

function isLearningPathKey(key: readonly unknown[]): boolean {
  return key[0] === 'learningPaths';
}

export function useCreateLearningPath() {
  const client = useQueryClient();

  return useMutation<LearningPathInput, LearningPathWire>({
    mutationFn: (input, { signal }) => learningPathApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isLearningPathKey });
    },
  });
}

export interface UpdateLearningPathInput extends LearningPathUpdateInput {
  id: number;
}

export function useUpdateLearningPath() {
  const client = useQueryClient();

  return useMutation<UpdateLearningPathInput, LearningPathWire>({
    mutationFn: ({ id, ...input }, { signal }) => learningPathApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isLearningPathKey });
    },
  });
}

/**
 * Deletes one learning path. Optimistic: the row disappears from the current
 * list immediately; a failure restores the previous snapshot.
 */
export function useDeleteLearningPath(params: LearningPathListParams) {
  const client = useQueryClient();
  const key = learningPathKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => learningPathApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<LearningPathListWire>(key, (current) =>
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
        void client.invalidate({ predicate: isLearningPathKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isLearningPathKey });
    },
  });
}

// ─── LearningPathStep ─────────────────────────────────────────────────────────

export interface LearningPathStepListData {
  state: QueryState<LearningPathStepListWire>;
  refetch: () => void;
}

export function useLearningPathStepList(
  params: LearningPathStepListParams,
  enabled = true,
): LearningPathStepListData {
  const { state, refetch } = useQuery<LearningPathStepListWire>({
    queryKey: learningPathStepKeys.list(params),
    queryFn: (context) => learningPathStepApi.list(context, params),
    staleTime: 15_000,
    enabled,
  });

  return { state, refetch };
}

function isLearningPathStepKey(key: readonly unknown[]): boolean {
  return key[0] === 'learningPathSteps';
}

export function useCreateLearningPathStep() {
  const client = useQueryClient();

  return useMutation<LearningPathStepInput, LearningPathStepWire>({
    mutationFn: (input, { signal }) => learningPathStepApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isLearningPathStepKey });
    },
  });
}

export interface UpdateLearningPathStepInput extends LearningPathStepUpdateInput {
  id: number;
}

export function useUpdateLearningPathStep() {
  const client = useQueryClient();

  return useMutation<UpdateLearningPathStepInput, LearningPathStepWire>({
    mutationFn: ({ id, ...input }, { signal }) => learningPathStepApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isLearningPathStepKey });
    },
  });
}

/**
 * Deletes one learning-path step. Optimistic: the row disappears from the
 * current breakdown list immediately; a failure restores the previous
 * snapshot.
 */
export function useDeleteLearningPathStep(params: LearningPathStepListParams) {
  const client = useQueryClient();
  const key = learningPathStepKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => learningPathStepApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<LearningPathStepListWire>(key, (current) =>
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
        void client.invalidate({ predicate: isLearningPathStepKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isLearningPathStepKey });
    },
  });
}
