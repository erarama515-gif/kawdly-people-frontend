import { env } from '@/config/env';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import { mockAttendanceApi, resetMockAttendances, setMockFailureRate } from './mockApi';
import { attendanceEnvelopeDecoder, attendanceListDecoder } from './schema';
import type { AttendanceApi, AttendanceInput, AttendanceListParams, AttendanceUpdateInput } from './resource';

/**
 * Real HTTP implementation of `AttendanceApi`, pointed at
 * `/api/v1/attendances` exactly as documented in the Laravel route list:
 *  - `index` returns the app's custom `{ data, meta }` pager
 *  - `show`/`store`/`update` return `{ data: <attendance> }`
 *  - `destroy` returns 204 with an empty body
 *
 * Every response is decoded before it is returned, so a contract drift
 * becomes a typed `decode` error at the boundary instead of a silent
 * `undefined` three components deep.
 */

const BASE = '/attendances';
/** Relations needed to render the list table without a second round-trip. */
const LIST_INCLUDE = 'employee';

export const httpAttendanceApi: AttendanceApi = {
  async list({ signal }, params) {
    const { data } = await http(BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        search: params.search || undefined,
        status: params.status,
        employee_id: params.employeeId,
        date_from: params.dateFrom,
        date_to: params.dateTo,
        include: LIST_INCLUDE,
      },
      signal,
      schema: attendanceListDecoder,
    });
    return requireData(data, 'GET /attendances');
  },

  async create({ signal }, input) {
    const { data } = await http(BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: attendanceEnvelopeDecoder,
    });
    return requireData(data, 'POST /attendances').data;
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: attendanceEnvelopeDecoder,
    });
    return requireData(data, `PATCH /attendances/${id}`).data;
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
 * Chooses the transport once per app, exactly like the Employees feature:
 * mock is the default whenever no API base URL is configured, so the
 * Attendance page is fully interactive before the Laravel backend is wired
 * up, and a build pointed at a real backend switches with no code change.
 */
export const attendanceApi: AttendanceApi = env.useMockApi ? mockAttendanceApi : httpAttendanceApi;

if (env.isDev && env.useMockApi) {
  // Review affordance for loading/error/rollback states:
  //   __attendanceMock.setFailureRate(1)  // force every request to fail
  //   __attendanceMock.reset()            // restore seed data
  Object.defineProperty(window, '__attendanceMock', {
    value: { setFailureRate: setMockFailureRate, reset: resetMockAttendances },
    configurable: true,
  });
}

export type { AttendanceInput, AttendanceUpdateInput, AttendanceListParams };
