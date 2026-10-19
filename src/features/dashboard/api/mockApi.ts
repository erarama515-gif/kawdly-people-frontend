import { ApiError } from '@/lib/api/errors';
import type { FetchContext } from '@/lib/query';
import type { Role } from '@/auth/session';
import { createDataset, type DashboardDataset } from '../model';
import { dashboardDatasetDecoder } from './schema';
import type { AlertWire, DashboardDatasetWire, DismissAlertWire, ResolveQueueItemWire } from './schema';
import type { AlertItemId, DashboardApi } from './resource';

/**
 * In-process implementation of `DashboardApi`, used until the Laravel backend
 * exists (or in any build without `VITE_API_BASE_URL`).
 *
 * It behaves like a real service rather than a static fixture:
 *  - it owns mutable state, so resolving a queue item is a genuine write that
 *    later reads observe — the old "decrement a local counter" behaviour could
 *    not survive a refresh
 *  - it adds realistic latency and honours `AbortSignal`, so the client's
 *    cancellation, retry and skeleton paths are actually exercised
 *  - it can be told to fail, which is the only way to review the error states
 *
 * State lives in module scope, mirroring a single server process; a real
 * reload starts a fresh "process".
 */

interface MockStore {
  datasets: Map<Role, DashboardDataset>;
  dismissedAlerts: Map<Role, Set<AlertItemId>>;
}

const store: MockStore = {
  datasets: new Map([
    ['hr_admin', createDataset('hr_admin')],
    ['department_manager', createDataset('department_manager')],
  ]),
  dismissedAlerts: new Map(),
};

/**
 * Failure injection for reviewing error/rollback UI. 0 in normal operation; set
 * it from devtools (`__dashboardMock.setFailureRate(1)`) to force the transport
 * down. Persisted in `sessionStorage` so it survives a reload — otherwise the
 * page would recover by simply reloading, which defeats the review.
 */
const FAILURE_RATE_KEY = 'kawdly.mockFailureRate';

function readFailureRate(): number {
  const raw = sessionStorage.getItem(FAILURE_RATE_KEY);
  const parsed = Number(raw);
  return raw !== null && Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0;
}

let failureRate = readFailureRate();

export function setMockFailureRate(rate: number): void {
  failureRate = Math.min(Math.max(rate, 0), 1);
  sessionStorage.setItem(FAILURE_RATE_KEY, String(failureRate));
}

export function resetMockServer(): void {
  store.datasets = new Map([
    ['hr_admin', createDataset('hr_admin')],
    ['department_manager', createDataset('department_manager')],
  ]);
  store.dismissedAlerts = new Map();
}

/** Latency window for reads; writes are slower, as real mutations are. */
const READ_LATENCY_MS = 220;
const WRITE_LATENCY_MS = 420;

export const mockDashboardApi: DashboardApi = {
  async fetchDataset(context, { role }) {
    await simulate(context, READ_LATENCY_MS);
    // Re-decoded on every read so a malformed payload fails here, exactly as a
    // bad HTTP response would — the client cannot tell the two apart.
    return decode(datasetOf(role));
  },

  async fetchAlerts(context, { role }) {
    await simulate(context, READ_LATENCY_MS);
    return alertsFor(role);
  },

  async resolveQueueItem(context, { role }, id) {
    await simulate(context, WRITE_LATENCY_MS);
    const dataset = datasetOf(role);
    const row = dataset.queues.find((queue) => queue.id === id);
    if (!row) throw new ApiError('http', `Unknown queue item: ${id}`, { status: 404 });
    if (row.count <= 0) throw new ApiError('http', `${id} has nothing left to resolve`, { status: 409 });

    row.count -= 1;
    const updatedAt = stamp();
    dataset.updatedAt = updatedAt;

    const result: ResolveQueueItemWire = { queue: row, total: totalOf(dataset), updatedAt };
    return result;
  },

  async dismissAlert(context, { role }, id) {
    await simulate(context, WRITE_LATENCY_MS);
    const dismissed = store.dismissedAlerts.get(role) ?? new Set<AlertItemId>();
    dismissed.add(id);
    store.dismissedAlerts.set(role, dismissed);

    // `remaining` is the server's authoritative list of alerts still active, so
    // the client reconciles against the truth instead of its own guess.
    const result: DismissAlertWire = {
      id,
      remaining: alertsFor(role).map((alert) => alert.id),
      updatedAt: stamp(),
    };
    return result;
  },
};

/**
 * Only `hr_admin` and `department_manager` have a bespoke dataset; the other
 * 8 real roles (Permission Matrix) have no dashboard UI of their own yet, so
 * they lazily get — and keep — the admin dataset rather than a hard 404.
 * `createDataset()` itself already falls back to the admin shape for any
 * role it doesn't special-case, so this mirrors that behaviour instead of
 * fighting it.
 */
function datasetOf(role: Role): DashboardDataset {
  let dataset = store.datasets.get(role);
  if (!dataset) {
    dataset = createDataset(role);
    store.datasets.set(role, dataset);
  }
  return dataset;
}

function decode(dataset: DashboardDataset): DashboardDatasetWire {
  return dashboardDatasetDecoder.decode(structuredClone(dataset));
}

function totalOf(dataset: DashboardDataset): number {
  return dataset.queues.reduce((sum, queue) => sum + queue.count, 0);
}

function alertsFor(role: Role): AlertWire[] {
  const dismissed = store.dismissedAlerts.get(role) ?? new Set<AlertItemId>();
  const payrollRemaining = datasetOf(role).queues.find((queue) => queue.id === 'payroll')?.count ?? 0;

  const all: AlertWire[] = [
    {
      id: 'payroll',
      segments: [
        { kind: 'text', key: 'dashboard.alerts.payrollBefore' },
        { kind: 'value', name: 'remaining' },
        { kind: 'text', key: 'dashboard.alerts.payrollItem' },
      ],
      params: { remaining: payrollRemaining },
    },
    { id: 'reviewCycle', segments: [{ kind: 'text', key: 'dashboard.alerts.reviewCycle' }] },
  ];

  // The payroll alert stops being true once payroll is run, and stops being
  // shown once dismissed — two independent conditions, both server-side.
  return all
    .filter((alert) => !dismissed.has(alert.id))
    .filter((alert) => (alert.id === 'payroll' ? payrollRemaining > 0 : true));
}

/** Simulated network delay that rejects promptly when the caller aborts. */
async function simulate(context: FetchContext, baseMs: number): Promise<void> {
  if (context.signal.aborted) throw new ApiError('aborted', 'Request aborted');
  if (failureRate > 0 && Math.random() < failureRate) {
    throw new ApiError('network', 'Simulated transport failure');
  }

  const jittered = baseMs + Math.random() * baseMs * 0.4;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      context.signal.removeEventListener('abort', onAbort);
      resolve();
    }, jittered);
    function onAbort() {
      clearTimeout(timer);
      reject(new ApiError('aborted', 'Request aborted'));
    }
    context.signal.addEventListener('abort', onAbort, { once: true });
  });
}

function stamp(): string {
  return new Date().toISOString();
}
