import { env } from '@/config/env';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import { mockLoanApi, resetMockLoans, setMockLoanFailureRate } from './mockApi';
import { loanEnvelopeDecoder, loanListDecoder } from './schema';
import type { LoanApi, LoanInput, LoanListParams, LoanUpdateInput } from './resource';

/**
 * Real HTTP implementation of `LoanApi`, pointed at `/api/v1/loans` exactly
 * as documented in the Laravel route list:
 *  - `index` returns the app's custom `{ data, meta }` pager
 *  - `show`/`store`/`update` return `{ data: <loan> }`
 *  - `destroy` returns 204 with an empty body
 *  - `approve` (`POST /loans/{id}/approve`) returns `{ data: <loan> }` with
 *    status flipped to `active` and `approved_by`/`approved_at` stamped
 *    server-side from the authenticated user.
 */

const BASE = '/loans';
/** Relations needed to render the list table without a second round-trip. */
const LIST_INCLUDE = 'employee';

export const httpLoanApi: LoanApi = {
  async list({ signal }, params) {
    const { data } = await http(BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        search: params.search || undefined,
        status: params.status,
        employee_id: params.employeeId,
        include: LIST_INCLUDE,
      },
      signal,
      schema: loanListDecoder,
    });
    return requireData(data, 'GET /loans');
  },

  async create({ signal }, input) {
    const { data } = await http(BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: loanEnvelopeDecoder,
    });
    return requireData(data, 'POST /loans').data;
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: loanEnvelopeDecoder,
    });
    return requireData(data, `PATCH /loans/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },

  async approve({ signal }, id) {
    const { data } = await http(`${BASE}/${id}/approve`, {
      method: 'POST',
      body: {},
      signal,
      schema: loanEnvelopeDecoder,
    });
    return requireData(data, `POST /loans/${id}/approve`).data;
  },
};

function requireData<T>(data: T | undefined, endpoint: string): T {
  if (data === undefined) throw new Error(`${endpoint} returned an empty body`);
  return data;
}

/**
 * Chooses the transport once per app, exactly like the Employees feature:
 * mock is the default whenever no API base URL is configured, so the Loans
 * page is fully interactive before the Laravel backend is wired up, and a
 * build pointed at a real backend switches with no code change.
 */
export const loanApi: LoanApi = env.useMockApi ? mockLoanApi : httpLoanApi;

if (env.isDev && env.useMockApi) {
  // Review affordance for loading/error/rollback states:
  //   __loansMock.setFailureRate(1)  // force every request to fail
  //   __loansMock.reset()            // restore seed data
  Object.defineProperty(window, '__loansMock', {
    value: { setFailureRate: setMockLoanFailureRate, reset: resetMockLoans },
    configurable: true,
  });
}

export type { LoanInput, LoanUpdateInput, LoanListParams };
