import { env } from '@/config/env';
import { createHttpClient } from '@/lib/api/http';
import type { HttpClient } from '@/lib/api/http';
import {
  mockPayrollRunApi,
  mockPayslipApi,
  resetMockPayrollRuns,
  resetMockPayslips,
  setMockPayrollFailureRate,
} from './mockApi';
import {
  payrollRunEnvelopeDecoder,
  payrollRunListDecoder,
  payslipEnvelopeDecoder,
  payslipListDecoder,
} from './schema';
import type {
  PayrollRunApi,
  PayrollRunInput,
  PayrollRunListParams,
  PayrollRunUpdateInput,
  PayslipApi,
  PayslipInput,
  PayslipListParams,
  PayslipUpdateInput,
} from './resource';

/**
 * Real HTTP implementations for the Payroll module's two resources,
 * pointed at `/api/v1/payroll-runs` and `/api/v1/payslips`.
 *
 * Every response is decoded before it is returned, so a contract drift becomes
 * a typed `decode` error at the boundary — never a silent `undefined`.
 *
 * Mock is the active default (see bottom of file) until `VITE_API_BASE_URL` is set.
 *
 * NOTE: `POST /api/v1/payroll-runs/{id}/calculate` and `/approve` exist on the
 * backend but are not wired here — they require auth/session context that is
 * not available yet. Wire them up as a follow-up once authentication lands
 * (same approach as Loans skipping `/approve`).
 */

const http: HttpClient = createHttpClient({
  baseUrl: env.apiBaseUrl || '/api/v1',
  timeoutMs: env.requestTimeoutMs,
  retries: env.requestRetries,
  backoffMs: env.requestBackoffMs,
});

function requireData<T>(data: T | undefined, endpoint: string): T {
  if (data === undefined) throw new Error(`${endpoint} returned an empty body`);
  return data;
}

// ─── PayrollRun HTTP ──────────────────────────────────────────────────────────

const PAYROLL_RUN_BASE = '/payroll-runs';

export const httpPayrollRunApi: PayrollRunApi = {
  async list({ signal }, params) {
    const { data } = await http(PAYROLL_RUN_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        status: params.status,
      },
      signal,
      schema: payrollRunListDecoder,
    });
    return requireData(data, 'GET /payroll-runs');
  },

  async create({ signal }, input: PayrollRunInput) {
    const { data } = await http(PAYROLL_RUN_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: payrollRunEnvelopeDecoder,
    });
    return requireData(data, 'POST /payroll-runs').data;
  },

  async update({ signal }, id, input: PayrollRunUpdateInput) {
    const { data } = await http(`${PAYROLL_RUN_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: payrollRunEnvelopeDecoder,
    });
    return requireData(data, `PATCH /payroll-runs/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${PAYROLL_RUN_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

// ─── Payslip HTTP ─────────────────────────────────────────────────────────────

const PAYSLIP_BASE = '/payslips';
/** Relations needed to render the list table without a second round-trip. */
const PAYSLIP_LIST_INCLUDE = 'employee';

export const httpPayslipApi: PayslipApi = {
  async list({ signal }, params) {
    const { data } = await http(PAYSLIP_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        payroll_run_id: params.payroll_run_id,
        status: params.status,
        include: PAYSLIP_LIST_INCLUDE,
      },
      signal,
      schema: payslipListDecoder,
    });
    return requireData(data, 'GET /payslips');
  },

  async create({ signal }, input: PayslipInput) {
    const { data } = await http(PAYSLIP_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: payslipEnvelopeDecoder,
    });
    return requireData(data, 'POST /payslips').data;
  },

  async update({ signal }, id, input: PayslipUpdateInput) {
    const { data } = await http(`${PAYSLIP_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: payslipEnvelopeDecoder,
    });
    return requireData(data, `PATCH /payslips/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${PAYSLIP_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

// ─── Active transports (mock is default) ─────────────────────────────────────

export const payrollRunApi: PayrollRunApi = env.useMockApi ? mockPayrollRunApi : httpPayrollRunApi;
export const payslipApi: PayslipApi = env.useMockApi ? mockPayslipApi : httpPayslipApi;

if (env.isDev && env.useMockApi) {
  // Review affordance for loading/error/rollback states:
  //   __payrollMock.setFailureRate(1)   // force every request to fail
  //   __payrollMock.resetRuns()         // restore payroll-run seed data
  //   __payrollMock.resetPayslips()     // restore payslip seed data
  Object.defineProperty(window, '__payrollMock', {
    value: {
      setFailureRate: setMockPayrollFailureRate,
      resetRuns: resetMockPayrollRuns,
      resetPayslips: resetMockPayslips,
    },
    configurable: true,
  });
}

export type {
  PayrollRunInput,
  PayrollRunUpdateInput,
  PayrollRunListParams,
  PayslipInput,
  PayslipUpdateInput,
  PayslipListParams,
};
