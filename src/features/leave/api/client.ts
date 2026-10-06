import { env } from '@/config/env';
import { createHttpClient } from '@/lib/api/http';
import type { HttpClient } from '@/lib/api/http';
import { mockLeaveRequestApi, resetMockLeaveRequests, setMockLeaveFailureRate } from './mockApi';
import {
  leaveRequestEnvelopeDecoder,
  leaveRequestListDecoder,
  leaveTypeListDecoder,
} from './schema';
import type {
  LeaveRequestApi,
  LeaveRequestInput,
  LeaveRequestListParams,
  LeaveRequestUpdateInput,
} from './resource';

/**
 * Real HTTP implementation of `LeaveRequestApi`, pointed at
 * `/api/v1/leave-requests` exactly as documented in the Laravel route list:
 *  - `index` returns the app's custom `{ data, meta }` pager
 *  - `show`/`store`/`update`/`approve`/`reject` return `{ data: <leaveRequest> }`
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

const BASE = '/leave-requests';
const LEAVE_TYPES_BASE = '/leave-types';
/** Relations needed to render the list table without a second round-trip. */
const LIST_INCLUDE = 'employee,leaveType';

export const httpLeaveRequestApi: LeaveRequestApi = {
  async list({ signal }, params) {
    const { data } = await http(BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        status: params.status,
        employee_id: params.employeeId,
        leave_type_id: params.leaveTypeId,
        include: LIST_INCLUDE,
      },
      signal,
      schema: leaveRequestListDecoder,
    });
    return requireData(data, 'GET /leave-requests');
  },

  async create({ signal }, input) {
    const { data } = await http(BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: leaveRequestEnvelopeDecoder,
    });
    return requireData(data, 'POST /leave-requests').data;
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: leaveRequestEnvelopeDecoder,
    });
    return requireData(data, `PATCH /leave-requests/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },

  async approve({ signal }, id) {
    const { data } = await http(`${BASE}/${id}/approve`, {
      method: 'POST',
      signal,
      schema: leaveRequestEnvelopeDecoder,
    });
    return requireData(data, `POST /leave-requests/${id}/approve`).data;
  },

  async reject({ signal }, id, rejectionReason) {
    const { data } = await http(`${BASE}/${id}/reject`, {
      method: 'POST',
      body: rejectionReason ? { rejection_reason: rejectionReason } : {},
      signal,
      schema: leaveRequestEnvelopeDecoder,
    });
    return requireData(data, `POST /leave-requests/${id}/reject`).data;
  },

  async listLeaveTypes({ signal }) {
    const { data } = await http(LEAVE_TYPES_BASE, {
      query: { per_page: 100 },
      signal,
      schema: leaveTypeListDecoder,
    });
    return requireData(data, 'GET /leave-types').data;
  },
};

function requireData<T>(data: T | undefined, endpoint: string): T {
  if (data === undefined) throw new Error(`${endpoint} returned an empty body`);
  return data;
}

/**
 * Chooses the transport once per app, exactly like the Employees feature:
 * mock is the default whenever no API base URL is configured, so the
 * Leave page is fully interactive before the Laravel backend is wired
 * up, and a build pointed at a real backend switches with no code change.
 */
export const leaveRequestApi: LeaveRequestApi = env.useMockApi ? mockLeaveRequestApi : httpLeaveRequestApi;

if (env.isDev && env.useMockApi) {
  // Review affordance for loading/error/rollback states:
  //   __leaveRequestsMock.setFailureRate(1)  // force every request to fail
  //   __leaveRequestsMock.reset()            // restore seed data
  Object.defineProperty(window, '__leaveRequestsMock', {
    value: { setFailureRate: setMockLeaveFailureRate, reset: resetMockLeaveRequests },
    configurable: true,
  });
}

export type { LeaveRequestInput, LeaveRequestUpdateInput, LeaveRequestListParams };
