import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { onboardingInstanceApi, onboardingTaskApi, onboardingTemplateApi, onboardingTemplateTaskApi } from './client';
import { onboardingInstanceKeys, onboardingTaskKeys, onboardingTemplateKeys, onboardingTemplateTaskKeys } from './resource';
import type {
  OnboardingInstanceInput,
  OnboardingInstanceListParams,
  OnboardingInstanceUpdateInput,
  OnboardingTaskListParams,
  OnboardingTaskUpdateInput,
  OnboardingTemplateListParams,
  OnboardingTemplateTaskInput,
  OnboardingTemplateTaskListParams,
  OnboardingTemplateTaskUpdateInput,
} from './resource';
import type {
  OnboardingInstanceListWire,
  OnboardingInstanceWire,
  OnboardingTaskListWire,
  OnboardingTaskWire,
  OnboardingTemplateListWire,
  OnboardingTemplateTaskListWire,
  OnboardingTemplateTaskWire,
} from './schema';

/**
 * The Onboarding module's data hooks — the only place components talk to the
 * API. Mirrors the Attendance feature's `queries.ts`: each hook owns its cache
 * key and mutation strategy, and every mutation reconciles the cache itself
 * so `OnboardingPage` never writes to the query store by hand.
 *
 * NOTE on /complete action: We intentionally do NOT wire
 * `POST /onboarding-tasks/{id}/complete` because the controller calls
 * `$request->user()->id` (requires a real authenticated user unavailable in
 * the mock-first phase). Task status toggling uses the standard PATCH update
 * endpoint (`{ status: 'completed' }`) instead — same precedent as Loans
 * skipping /approve.
 *
 * NOTE on overdueTasks stat: Computing this honestly requires fetching all
 * task pages (potentially many), and the backend has no server-side "overdue"
 * filter. We omit the overdueTasks stat card rather than fabricate the number.
 * The per-instance overdue badge is still shown (computed from the task list
 * already fetched for an expanded instance).
 *
 * NOTE on completedThisMonth stat: The instance list endpoint does not
 * currently expose a `completed_at_from`/`completed_at_to` filter, so we
 * cannot issue a cheap `perPage:1` filtered query. We compute it client-side
 * from the first page of instances (up to `perPage:200`) when all instances
 * fit, with a note that this may undercount on large datasets. If the backend
 * later exposes date-range filters, replace with a `perPage:1` query.
 */

export interface OnboardingInstanceListData {
  state: QueryState<OnboardingInstanceListWire>;
  refetch: () => void;
}

export function useOnboardingInstanceList(params: OnboardingInstanceListParams): OnboardingInstanceListData {
  const { state, refetch } = useQuery<OnboardingInstanceListWire>({
    queryKey: onboardingInstanceKeys.list(params),
    queryFn: (context) => onboardingInstanceApi.list(context, params),
    staleTime: 15_000,
  });
  return { state, refetch };
}

function isInstanceKey(key: readonly unknown[]): boolean {
  return key[0] === 'onboardingInstances';
}

export function useCreateOnboardingInstance() {
  const client = useQueryClient();

  return useMutation<OnboardingInstanceInput, OnboardingInstanceWire>({
    mutationFn: (input, { signal }) => onboardingInstanceApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isInstanceKey });
    },
  });
}

export interface UpdateOnboardingInstanceInput extends OnboardingInstanceUpdateInput {
  id: number;
}

export function useUpdateOnboardingInstance() {
  const client = useQueryClient();

  return useMutation<UpdateOnboardingInstanceInput, OnboardingInstanceWire>({
    mutationFn: ({ id, ...input }, { signal }) => onboardingInstanceApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isInstanceKey });
    },
  });
}

export function useDeleteOnboardingInstance(params: OnboardingInstanceListParams) {
  const client = useQueryClient();
  const key = onboardingInstanceKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => onboardingInstanceApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<OnboardingInstanceListWire>(key, (current) =>
        current
          ? {
              ...current,
              data: current.data.filter((instance) => instance.id !== id),
              meta: { ...current.meta, total: Math.max(0, current.meta.total - 1) },
            }
          : current,
      );
      return () => {
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate({ predicate: isInstanceKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isInstanceKey });
    },
  });
}

// ─── OnboardingTask hooks ─────────────────────────────────────────────────────

export interface OnboardingTaskListData {
  state: QueryState<OnboardingTaskListWire>;
  refetch: () => void;
}

export function useOnboardingTaskList(params: OnboardingTaskListParams): OnboardingTaskListData {
  const { state, refetch } = useQuery<OnboardingTaskListWire>({
    queryKey: onboardingTaskKeys.list(params),
    queryFn: (context) => onboardingTaskApi.list(context, params),
    staleTime: 15_000,
  });
  return { state, refetch };
}

function isTaskKey(key: readonly unknown[]): boolean {
  return key[0] === 'onboardingTasks';
}

export interface UpdateOnboardingTaskInput extends OnboardingTaskUpdateInput {
  id: number;
}

/**
 * Updates a task's status (or notes/completed_at) via standard PATCH.
 * Does NOT call the /complete action because it requires an authenticated user.
 */
export function useUpdateOnboardingTask() {
  const client = useQueryClient();

  return useMutation<UpdateOnboardingTaskInput, OnboardingTaskWire>({
    mutationFn: ({ id, ...input }, { signal }) => onboardingTaskApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isTaskKey });
      // Also invalidate instances since task status affects computed progress
      void client.invalidate({ predicate: isInstanceKey });
    },
  });
}

// ─── OnboardingTemplate hooks ─────────────────────────────────────────────────

export interface OnboardingTemplateListData {
  state: QueryState<OnboardingTemplateListWire>;
  refetch: () => void;
}

export function useOnboardingTemplateList(params: OnboardingTemplateListParams): OnboardingTemplateListData {
  const { state, refetch } = useQuery<OnboardingTemplateListWire>({
    queryKey: onboardingTemplateKeys.list(params),
    queryFn: (context) => onboardingTemplateApi.list(context, params),
    staleTime: 60_000,
  });
  return { state, refetch };
}

// ─── OnboardingTemplateTask hooks ─────────────────────────────────────────────

export interface OnboardingTemplateTaskListData {
  state: QueryState<OnboardingTemplateTaskListWire>;
  refetch: () => void;
}

export function useOnboardingTemplateTaskList(params: OnboardingTemplateTaskListParams): OnboardingTemplateTaskListData {
  const { state, refetch } = useQuery<OnboardingTemplateTaskListWire>({
    queryKey: onboardingTemplateTaskKeys.list(params),
    queryFn: (context) => onboardingTemplateTaskApi.list(context, params),
    staleTime: 15_000,
  });
  return { state, refetch };
}

function isTemplateTaskKey(key: readonly unknown[]): boolean {
  return key[0] === 'onboardingTemplateTasks';
}

export function useCreateOnboardingTemplateTask() {
  const client = useQueryClient();

  return useMutation<OnboardingTemplateTaskInput, OnboardingTemplateTaskWire>({
    mutationFn: (input, { signal }) => onboardingTemplateTaskApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isTemplateTaskKey });
    },
  });
}

export interface UpdateOnboardingTemplateTaskInput extends OnboardingTemplateTaskUpdateInput {
  id: number;
}

export function useUpdateOnboardingTemplateTask() {
  const client = useQueryClient();

  return useMutation<UpdateOnboardingTemplateTaskInput, OnboardingTemplateTaskWire>({
    mutationFn: ({ id, ...input }, { signal }) => onboardingTemplateTaskApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isTemplateTaskKey });
    },
  });
}

export function useDeleteOnboardingTemplateTask(params: OnboardingTemplateTaskListParams) {
  const client = useQueryClient();
  const key = onboardingTemplateTaskKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => onboardingTemplateTaskApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<OnboardingTemplateTaskListWire>(key, (current) =>
        current
          ? {
              ...current,
              data: current.data.filter((task) => task.id !== id),
              meta: { ...current.meta, total: Math.max(0, current.meta.total - 1) },
            }
          : current,
      );
      return () => {
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate({ predicate: isTemplateTaskKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isTemplateTaskKey });
    },
  });
}
