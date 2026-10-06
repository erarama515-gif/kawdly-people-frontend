import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { env } from '@/config/env';
import { useRoleOverride, useSession } from '@/auth/session';
import { dashboardApi } from './client';
import { dashboardKeys } from './resource';
import type { DashboardScope } from './resource';
import type {
  AlertItemId,
  AlertWire,
  DashboardDatasetWire,
  DismissAlertWire,
  QueueItemId,
  ResolveQueueItemWire,
} from './schema';

/**
 * The dashboard's data hooks — the only place components talk to the API.
 *
 * Each hook owns its cache key, its polling cadence and its mutation strategy,
 * so `DashboardPage` stays a layout and every data concern stays testable in
 * isolation. The setters returned here already reconcile the cache, so
 * components never write to the query store by hand.
 */

export interface DashboardData {
  scope: DashboardScope;
  /** Landing payload (queues, KPIs, attendance, upcoming, org breakdown). */
  dataset: QueryState<DashboardDatasetWire>;
  /** Alert band; a separate read so it can load and fail on its own. */
  alerts: QueryState<AlertWire[]>;
  /** Forces a fresh read of both resources. */
  refresh: () => void;
}

export function useDashboardData(): DashboardData {
  const { role } = useSession();
  const { isOverridden } = useRoleOverride();

  const scope = useMemo<DashboardScope>(
    () => ({ role, previewRole: isOverridden }),
    [role, isOverridden],
  );

  const dataset = useQuery<DashboardDatasetWire>({
    queryKey: dashboardKeys.dataset(role),
    queryFn: (context) => dashboardApi.fetchDataset(context, scope),
    staleTime: 30_000,
    refetchInterval: env.dashboardPollMs,
  });

  const alerts = useQuery<AlertWire[]>({
    queryKey: dashboardKeys.alerts(role),
    queryFn: (context) => dashboardApi.fetchAlerts(context, scope),
    staleTime: 30_000,
    refetchInterval: env.dashboardPollMs,
  });

  const refresh = useCallback(() => {
    void dataset.refetch();
    void alerts.refetch();
  }, [dataset, alerts]);

  return { scope, dataset: dataset.state, alerts: alerts.state, refresh };
}

/**
 * Resolves one pending item.
 *
 * Optimistic: the count drops immediately so the queue and the decisions
 * sentence feel instant. The server's authoritative row replaces it on success;
 * a failure restores the previous snapshot and refetches, so the ledger can
 * never drift from the server.
 */
export function useResolveQueueItem(scope: DashboardScope) {
  const client = useQueryClient();

  return useMutation<QueueItemId, ResolveQueueItemWire>({
    mutationFn: (id, { signal }) => dashboardApi.resolveQueueItem({ signal }, scope, id),

    onMutate: (id) => {
      const key = dashboardKeys.dataset(scope.role);
      const previous = client.setData<DashboardDatasetWire>(key, (current) =>
        current
          ? {
              ...current,
              queues: current.queues.map((queue) =>
                queue.id === id ? { ...queue, count: Math.max(0, queue.count - 1) } : queue,
              ),
            }
          : current,
      );
      return () => {
        // Roll back to the exact pre-mutation snapshot, then resync: the server
        // may have moved on (someone else resolved it, or a poll landed).
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate(key);
      };
    },

    onSuccess: (result, id) => {
      client.setData<DashboardDatasetWire>(dashboardKeys.dataset(scope.role), (current) =>
        current
          ? {
              ...current,
              queues: current.queues.map((queue) => (queue.id === id ? result.queue : queue)),
              updatedAt: result.updatedAt,
            }
          : current,
      );
    },
  });
}

/**
 * Dismisses one alert. Optimistic like the queue resolve; if the server refuses,
 * the alert returns — the correct outcome for a dismissal that did not persist.
 */
export function useDismissAlert(scope: DashboardScope) {
  const client = useQueryClient();

  return useMutation<AlertItemId, DismissAlertWire>({
    mutationFn: (id, { signal }) => dashboardApi.dismissAlert({ signal }, scope, id),

    onMutate: (id) => {
      const key = dashboardKeys.alerts(scope.role);
      const previous = client.setData<AlertWire[]>(key, (current) =>
        current?.filter((alert) => alert.id !== id),
      );
      return () => {
        if (previous) client.setData(key, () => previous.data);
      };
    },

    onSuccess: (result) => {
      client.setData<AlertWire[]>(dashboardKeys.alerts(scope.role), (current) =>
        current?.filter((alert) => result.remaining.includes(alert.id)),
      );
    },
  });
}
