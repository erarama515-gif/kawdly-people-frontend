import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { performanceCycleApi, performanceReviewApi } from './client';
import { performanceCycleKeys, performanceReviewKeys } from './resource';
import type {
  PerformanceCycleInput,
  PerformanceCycleListParams,
  PerformanceCycleUpdateInput,
  PerformanceReviewInput,
  PerformanceReviewListParams,
  PerformanceReviewUpdateInput,
} from './resource';
import type {
  PerformanceCycleListWire,
  PerformanceCycleWire,
  PerformanceReviewListWire,
  PerformanceReviewWire,
} from './schema';

/**
 * The Performance module's data hooks — one set per resource.
 *
 * Mirrors `career/api/queries.ts`: each hook owns its cache key and
 * mutation strategy, and every mutation reconciles the cache itself so
 * PerformancePage never writes to the query store by hand.
 *
 * Optimistic delete + rollback is implemented for both resources.
 */

// ─── PerformanceCycle hooks ───────────────────────────────────────────────────

export interface PerformanceCycleListData {
  state: QueryState<PerformanceCycleListWire>;
  refetch: () => void;
}

export function usePerformanceCycleList(params: PerformanceCycleListParams): PerformanceCycleListData {
  const { state, refetch } = useQuery<PerformanceCycleListWire>({
    queryKey: performanceCycleKeys.list(params),
    queryFn: (context) => performanceCycleApi.list(context, params),
    staleTime: 15_000,
  });
  return { state, refetch };
}

function isPerformanceCycleKey(key: readonly unknown[]): boolean {
  return key[0] === 'performance-cycles';
}

export function useCreatePerformanceCycle() {
  const client = useQueryClient();
  return useMutation<PerformanceCycleInput, PerformanceCycleWire>({
    mutationFn: (input, { signal }) => performanceCycleApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isPerformanceCycleKey });
    },
  });
}

export interface UpdatePerformanceCycleInput extends PerformanceCycleUpdateInput {
  id: number;
}

export function useUpdatePerformanceCycle() {
  const client = useQueryClient();
  return useMutation<UpdatePerformanceCycleInput, PerformanceCycleWire>({
    mutationFn: ({ id, ...input }, { signal }) =>
      performanceCycleApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isPerformanceCycleKey });
    },
  });
}

/**
 * Deletes one performance cycle. Optimistic: the row disappears immediately;
 * a failure restores the previous snapshot.
 */
export function useDeletePerformanceCycle(params: PerformanceCycleListParams) {
  const client = useQueryClient();
  const key = performanceCycleKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => performanceCycleApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<PerformanceCycleListWire>(key, (current) =>
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
        void client.invalidate({ predicate: isPerformanceCycleKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isPerformanceCycleKey });
    },
  });
}

// ─── PerformanceReview hooks ──────────────────────────────────────────────────

export interface PerformanceReviewListData {
  state: QueryState<PerformanceReviewListWire>;
  refetch: () => void;
}

export function usePerformanceReviewList(params: PerformanceReviewListParams): PerformanceReviewListData {
  const { state, refetch } = useQuery<PerformanceReviewListWire>({
    queryKey: performanceReviewKeys.list(params),
    queryFn: (context) => performanceReviewApi.list(context, params),
    staleTime: 15_000,
  });
  return { state, refetch };
}

function isPerformanceReviewKey(key: readonly unknown[]): boolean {
  return key[0] === 'performance-reviews';
}

export function useCreatePerformanceReview() {
  const client = useQueryClient();
  return useMutation<PerformanceReviewInput, PerformanceReviewWire>({
    mutationFn: (input, { signal }) => performanceReviewApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isPerformanceReviewKey });
    },
  });
}

export interface UpdatePerformanceReviewInput extends PerformanceReviewUpdateInput {
  id: number;
}

export function useUpdatePerformanceReview() {
  const client = useQueryClient();
  return useMutation<UpdatePerformanceReviewInput, PerformanceReviewWire>({
    mutationFn: ({ id, ...input }, { signal }) =>
      performanceReviewApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isPerformanceReviewKey });
    },
  });
}

/**
 * Deletes one performance review. Optimistic: the row disappears immediately;
 * a failure restores the previous snapshot.
 */
export function useDeletePerformanceReview(params: PerformanceReviewListParams) {
  const client = useQueryClient();
  const key = performanceReviewKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => performanceReviewApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<PerformanceReviewListWire>(key, (current) =>
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
        void client.invalidate({ predicate: isPerformanceReviewKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isPerformanceReviewKey });
    },
  });
}
