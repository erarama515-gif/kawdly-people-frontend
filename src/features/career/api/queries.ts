import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { careerPathApi, careerPathLevelApi, successionPlanApi } from './client';
import { careerPathKeys, careerPathLevelKeys, successionPlanKeys } from './resource';
import type {
  CareerPathInput,
  CareerPathListParams,
  CareerPathUpdateInput,
  CareerPathLevelInput,
  CareerPathLevelListParams,
  CareerPathLevelUpdateInput,
  SuccessionPlanInput,
  SuccessionPlanListParams,
  SuccessionPlanUpdateInput,
} from './resource';
import type {
  CareerPathListWire,
  CareerPathWire,
  CareerPathLevelListWire,
  CareerPathLevelWire,
  SuccessionPlanListWire,
  SuccessionPlanWire,
} from './schema';

/**
 * The Career module's data hooks — one set per resource.
 *
 * Mirrors `attendance/api/queries.ts`: each hook owns its cache key and
 * mutation strategy, and every mutation reconciles the cache itself so
 * CareerPage never writes to the query store by hand.
 *
 * Optimistic delete + rollback is implemented for all three resources.
 */

// ─── CareerPath hooks ─────────────────────────────────────────────────────────

export interface CareerPathListData {
  state: QueryState<CareerPathListWire>;
  refetch: () => void;
}

export function useCareerPathList(params: CareerPathListParams): CareerPathListData {
  const { state, refetch } = useQuery<CareerPathListWire>({
    queryKey: careerPathKeys.list(params),
    queryFn: (context) => careerPathApi.list(context, params),
    staleTime: 15_000,
  });
  return { state, refetch };
}

function isCareerPathKey(key: readonly unknown[]): boolean {
  return key[0] === 'career-paths';
}

export function useCreateCareerPath() {
  const client = useQueryClient();
  return useMutation<CareerPathInput, CareerPathWire>({
    mutationFn: (input, { signal }) => careerPathApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isCareerPathKey });
    },
  });
}

export interface UpdateCareerPathInput extends CareerPathUpdateInput {
  id: number;
}

export function useUpdateCareerPath() {
  const client = useQueryClient();
  return useMutation<UpdateCareerPathInput, CareerPathWire>({
    mutationFn: ({ id, ...input }, { signal }) => careerPathApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isCareerPathKey });
    },
  });
}

/**
 * Deletes one career path. Optimistic: the card disappears immediately from
 * the current list; a failure restores the previous snapshot and refetches.
 */
export function useDeleteCareerPath(params: CareerPathListParams) {
  const client = useQueryClient();
  const key = careerPathKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => careerPathApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<CareerPathListWire>(key, (current) =>
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
        void client.invalidate({ predicate: isCareerPathKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isCareerPathKey });
    },
  });
}

// ─── CareerPathLevel hooks ────────────────────────────────────────────────────

export interface CareerPathLevelListData {
  state: QueryState<CareerPathLevelListWire>;
  refetch: () => void;
}

export function useCareerPathLevelList(params: CareerPathLevelListParams): CareerPathLevelListData {
  const { state, refetch } = useQuery<CareerPathLevelListWire>({
    queryKey: careerPathLevelKeys.list(params),
    queryFn: (context) => careerPathLevelApi.list(context, params),
    staleTime: 15_000,
  });
  return { state, refetch };
}

function isCareerPathLevelKey(key: readonly unknown[]): boolean {
  return key[0] === 'career-path-levels';
}

export function useCreateCareerPathLevel() {
  const client = useQueryClient();
  return useMutation<CareerPathLevelInput, CareerPathLevelWire>({
    mutationFn: (input, { signal }) => careerPathLevelApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isCareerPathLevelKey });
    },
  });
}

export interface UpdateCareerPathLevelInput extends CareerPathLevelUpdateInput {
  id: number;
}

export function useUpdateCareerPathLevel() {
  const client = useQueryClient();
  return useMutation<UpdateCareerPathLevelInput, CareerPathLevelWire>({
    mutationFn: ({ id, ...input }, { signal }) =>
      careerPathLevelApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isCareerPathLevelKey });
    },
  });
}

/**
 * Deletes one career-path level. Optimistic: the row disappears immediately;
 * a failure restores the previous snapshot.
 */
export function useDeleteCareerPathLevel(params: CareerPathLevelListParams) {
  const client = useQueryClient();
  const key = careerPathLevelKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => careerPathLevelApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<CareerPathLevelListWire>(key, (current) =>
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
        void client.invalidate({ predicate: isCareerPathLevelKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isCareerPathLevelKey });
    },
  });
}

// ─── SuccessionPlan hooks ─────────────────────────────────────────────────────

export interface SuccessionPlanListData {
  state: QueryState<SuccessionPlanListWire>;
  refetch: () => void;
}

export function useSuccessionPlanList(params: SuccessionPlanListParams): SuccessionPlanListData {
  const { state, refetch } = useQuery<SuccessionPlanListWire>({
    queryKey: successionPlanKeys.list(params),
    queryFn: (context) => successionPlanApi.list(context, params),
    staleTime: 15_000,
  });
  return { state, refetch };
}

function isSuccessionPlanKey(key: readonly unknown[]): boolean {
  return key[0] === 'succession-plans';
}

export function useCreateSuccessionPlan() {
  const client = useQueryClient();
  return useMutation<SuccessionPlanInput, SuccessionPlanWire>({
    mutationFn: (input, { signal }) => successionPlanApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isSuccessionPlanKey });
    },
  });
}

export interface UpdateSuccessionPlanInput extends SuccessionPlanUpdateInput {
  id: number;
}

export function useUpdateSuccessionPlan() {
  const client = useQueryClient();
  return useMutation<UpdateSuccessionPlanInput, SuccessionPlanWire>({
    mutationFn: ({ id, ...input }, { signal }) => successionPlanApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isSuccessionPlanKey });
    },
  });
}

/**
 * Deletes one succession plan. Optimistic: the row disappears immediately;
 * a failure restores the previous snapshot.
 */
export function useDeleteSuccessionPlan(params: SuccessionPlanListParams) {
  const client = useQueryClient();
  const key = successionPlanKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => successionPlanApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<SuccessionPlanListWire>(key, (current) =>
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
        void client.invalidate({ predicate: isSuccessionPlanKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isSuccessionPlanKey });
    },
  });
}
