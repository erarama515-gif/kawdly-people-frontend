import { env } from '@/config/env';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import { mockEmployeeApi, resetMockEmployees, setMockFailureRate } from './mockApi';
import { employeeEnvelopeDecoder, employeeListDecoder } from './schema';
import type {
  EmployeeApi,
  EmployeeInput,
  EmployeeListParams,
  EmployeePromoteInput,
  EmployeeReinstateInput,
  EmployeeSuspendInput,
  EmployeeTerminateInput,
  EmployeeTransferInput,
  EmployeeUpdateInput,
} from './resource';

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

const BASE = '/employees';
/** Relations needed to render the list table without a second round-trip. */
const LIST_INCLUDE = 'department,jobPosition,branch';
/** Relations loaded for the single-employee profile page. */
const DETAIL_INCLUDE = 'department,jobPosition,branch,jobGrade,directManager';

export const httpEmployeeApi: EmployeeApi = {
  async show({ signal }, id) {
    const { data } = await http(`${BASE}/${id}`, {
      query: { include: DETAIL_INCLUDE },
      signal,
      schema: employeeEnvelopeDecoder,
    });
    return requireData(data, `GET /employees/${id}`).data;
  },

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

  async promote({ signal }, id, input: EmployeePromoteInput) {
    const { data } = await http(`${BASE}/${id}/promote`, {
      method: 'POST',
      body: input,
      signal,
      schema: employeeEnvelopeDecoder,
    });
    return requireData(data, `POST /employees/${id}/promote`).data;
  },

  async transfer({ signal }, id, input: EmployeeTransferInput) {
    const { data } = await http(`${BASE}/${id}/transfer`, {
      method: 'POST',
      body: input,
      signal,
      schema: employeeEnvelopeDecoder,
    });
    return requireData(data, `POST /employees/${id}/transfer`).data;
  },

  async suspend({ signal }, id, input: EmployeeSuspendInput) {
    const { data } = await http(`${BASE}/${id}/suspend`, {
      method: 'POST',
      body: input,
      signal,
      schema: employeeEnvelopeDecoder,
    });
    return requireData(data, `POST /employees/${id}/suspend`).data;
  },

  async terminate({ signal }, id, input: EmployeeTerminateInput) {
    const { data } = await http(`${BASE}/${id}/terminate`, {
      method: 'POST',
      body: input,
      signal,
      schema: employeeEnvelopeDecoder,
    });
    return requireData(data, `POST /employees/${id}/terminate`).data;
  },

  async reinstate({ signal }, id, input: EmployeeReinstateInput) {
    const { data } = await http(`${BASE}/${id}/reinstate`, {
      method: 'POST',
      body: input,
      signal,
      schema: employeeEnvelopeDecoder,
    });
    return requireData(data, `POST /employees/${id}/reinstate`).data;
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

export type {
  EmployeeInput,
  EmployeeUpdateInput,
  EmployeeListParams,
  EmployeePromoteInput,
  EmployeeTransferInput,
  EmployeeSuspendInput,
  EmployeeTerminateInput,
  EmployeeReinstateInput,
};
