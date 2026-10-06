import { env } from '@/config/env';
import { createHttpClient } from '@/lib/api/http';
import type { HttpClient } from '@/lib/api/http';
import { mockEmployeeApi, resetMockEmployees, setMockFailureRate } from './mockApi';
import { employeeEnvelopeDecoder, employeeListDecoder } from './schema';
import type { EmployeeApi, EmployeeInput, EmployeeListParams, EmployeeUpdateInput } from './resource';

/**
 * Real HTTP implementation of `EmployeeApi`, pointed at
 * `/api/v1/employees` exactly as documented in the Laravel route list:
 *  - `index` returns the app's custom `{ data, meta }` pager (not Laravel's
 *    default paginator shape)
 *  - `show`/`store`/`update` return `{ data: <employee> }`
 *  - `destroy` returns 204 with an empty body
 *
 * Every response is decoded before it is returned, so a contract drift
 * becomes a typed `decode` error at the boundary instead of a silent
 * `undefined` three components deep.
 */

const http: HttpClient = createHttpClient({
  baseUrl: env.apiBaseUrl || '/api/v1',
  timeoutMs: env.requestTimeoutMs,
  retries: env.requestRetries,
  backoffMs: env.requestBackoffMs,
});

const BASE = '/employees';
/** Relations needed to render the list table without a second round-trip. */
const LIST_INCLUDE = 'department,jobPosition,branch';

export const httpEmployeeApi: EmployeeApi = {
  async list({ signal }, params) {
    const { data } = await http(BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        search: params.search || undefined,
        status: params.status,
        department_id: params.departmentId,
        include: LIST_INCLUDE,
      },
      signal,
      schema: employeeListDecoder,
    });
    return requireData(data, 'GET /employees');
  },

  async create({ signal }, input) {
    const { data } = await http(BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: employeeEnvelopeDecoder,
    });
    return requireData(data, 'POST /employees').data;
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: employeeEnvelopeDecoder,
    });
    return requireData(data, `PATCH /employees/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

function requireData<T>(data: T | undefined, endpoint: string): T {
  if (data === undefined) throw new Error(`${endpoint} returned an empty body`);
  return data;
}

/**
 * Chooses the transport once per app, exactly like the Dashboard feature:
 * mock is the default whenever no API base URL is configured, so the
 * Employees page is fully interactive before the Laravel backend is wired
 * up, and a build pointed at a real backend switches with no code change.
 */
export const employeeApi: EmployeeApi = env.useMockApi ? mockEmployeeApi : httpEmployeeApi;

if (env.isDev && env.useMockApi) {
  // Review affordance for loading/error/rollback states:
  //   __employeesMock.setFailureRate(1)  // force every request to fail
  //   __employeesMock.reset()            // restore seed data
  Object.defineProperty(window, '__employeesMock', {
    value: { setFailureRate: setMockFailureRate, reset: resetMockEmployees },
    configurable: true,
  });
}

export type { EmployeeInput, EmployeeUpdateInput, EmployeeListParams };
