import { env } from '@/config/env';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import { mockDashboardApi, resetMockServer, setMockFailureRate } from './mockApi';
import {
  alertListDecoder,
  dashboardDatasetDecoder,
  dismissAlertDecoder,
  resolveQueueItemDecoder,
} from './schema';
import type { DashboardApi, DashboardScope } from './resource';

/**
 * Real HTTP implementation of `DashboardApi`, pointed at the Laravel endpoints
 * described in `02-System-Architecture.md`. Every response is decoded before it
 * is returned, so a schema mismatch becomes a typed `decode` error at the
 * boundary rather than `undefined` inside a component.
 *
 * The role is never sent as an identity claim — the backend scopes data from the
 * authenticated user. `as_role` is only the dev design-review override and is
 * omitted for a real session.
 */

const BASE = '/dashboard';

export const httpDashboardApi: DashboardApi = {
  async fetchDataset({ signal }, scope) {
    const { data } = await http('/dashboard', {
      query: scopeFor(scope),
      signal,
      schema: dashboardDatasetDecoder,
    });
    return requireData(data, 'GET /dashboard');
  },

  async fetchAlerts({ signal }, scope) {
    const { data } = await http(`${BASE}/alerts`, {
      query: scopeFor(scope),
      signal,
      schema: alertListDecoder,
    });
    return requireData(data, 'GET /dashboard/alerts');
  },

  async resolveQueueItem({ signal }, scope, id) {
    const { data } = await http(`${BASE}/queue/${id}/resolve`, {
      method: 'POST',
      query: scopeFor(scope),
      body: {},
      signal,
      schema: resolveQueueItemDecoder,
    });
    return requireData(data, 'POST /dashboard/queue/:id/resolve');
  },

  async dismissAlert({ signal }, scope, id) {
    const { data } = await http(`${BASE}/alerts/${id}/dismiss`, {
      method: 'POST',
      query: scopeFor(scope),
      body: {},
      signal,
      schema: dismissAlertDecoder,
    });
    return requireData(data, 'POST /dashboard/alerts/:id/dismiss');
  },
};

function scopeFor(scope: DashboardScope): { as_role: string | undefined } {
  return { as_role: scope.previewRole ? scope.role : undefined };
}

function requireData<T>(data: T | undefined, endpoint: string): T {
  if (data === undefined) throw new Error(`${endpoint} returned an empty body`);
  return data;
}

/**
 * Chooses the transport once per app. The mock is the default whenever no API
 * base URL is configured, so `npm run dev` yields a fully working dashboard and
 * a build pointed at a backend yields real data with no code change.
 */
export const dashboardApi: DashboardApi = env.useMockApi ? mockDashboardApi : httpDashboardApi;

if (env.isDev && env.useMockApi) {
  // Review affordance for the loading/error/rollback states, which are otherwise
  // unreachable in normal operation:
  //   __dashboardMock.setFailureRate(1)  // force every request to fail
  //   __dashboardMock.reset()           // restore seed data
  Object.defineProperty(window, '__dashboardMock', {
    value: { setFailureRate: setMockFailureRate, reset: resetMockServer },
    configurable: true,
  });
}
