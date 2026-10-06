import type { Role } from '@/auth/session';
import type { FetchContext, QueryKey } from '@/lib/query';
import type { AlertWire, DashboardDatasetWire, DismissAlertWire, ResolveQueueItemWire } from './schema';

/**
 * Who the data is being read for. `role` is the session's role; `previewRole`
 * is set only by the dev design-review switcher so a reviewer can inspect a
 * role they do not hold. The backend ignores it for real sessions.
 */
export interface DashboardScope {
  role: Role;
  previewRole: boolean;
}

/**
 * The dashboard's remote resource contract.
 *
 * Components never call this directly — they go through the query hooks in
 * `queries.ts`. Two implementations satisfy it: `httpDashboardApi` (real
 * Laravel endpoints) and `mockDashboardApi` (in-process, for pre-backend work).
 * Swapping between them is a build-config decision, not a code change.
 *
 * Every method takes a `FetchContext` and must honour `context.signal`, so a
 * navigation away actually cancels the request instead of racing a stale
 * response into a new page's state.
 */
export interface DashboardApi {
  /** Landing payload: queues, KPIs, attendance, upcoming and the org breakdown. */
  fetchDataset(context: FetchContext, scope: DashboardScope): Promise<DashboardDatasetWire>;
  /** Alert band contents; independent of the dataset so it can fail on its own. */
  fetchAlerts(context: FetchContext, scope: DashboardScope): Promise<AlertWire[]>;
  /** Resolves one pending item and returns the authoritative row. */
  resolveQueueItem(context: FetchContext, scope: DashboardScope, id: QueueItemId): Promise<ResolveQueueItemWire>;
  /** Dismisses one alert for the current session. */
  dismissAlert(context: FetchContext, scope: DashboardScope, id: AlertItemId): Promise<DismissAlertWire>;
}

export type QueueItemId = DashboardDatasetWire['queues'][number]['id'];
export type AlertItemId = 'payroll' | 'reviewCycle';

/** Cache keys. Every dashboard read hangs off `all` so invalidation is total. */
export const dashboardKeys = {
  all: ['dashboard'] as const satisfies QueryKey,
  dataset: (role: Role) => ['dashboard', 'dataset', role] as const satisfies QueryKey,
  alerts: (role: Role) => ['dashboard', 'alerts', role] as const satisfies QueryKey,
};
