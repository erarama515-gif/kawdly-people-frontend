import { env } from '@/config/env';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import {
  mockPayrollRunApi,
  mockPayslipApi,
  mockEmployeeSalaryApi,
  mockPayslipItemApi,
  resetMockPayrollRuns,
  resetMockPayslips,
  resetMockEmployeeSalaries,
  resetMockPayslipItems,
  setMockPayrollFailureRate,
} from './mockApi';
import {
  payrollRunEnvelopeDecoder,
  payrollRunListDecoder,
  payslipEnvelopeDecoder,
  payslipListDecoder,
  employeeSalaryEnvelopeDecoder,
  employeeSalaryListDecoder,
  payslipItemEnvelopeDecoder,
  payslipItemListDecoder,
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
  EmployeeSalaryApi,
  EmployeeSalaryInput,
  EmployeeSalaryListParams,
  EmployeeSalaryUpdateInput,
  PayslipItemApi,
  PayslipItemInput,
  PayslipItemListParams,
  PayslipItemUpdateInput,
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
 * `calculate`/`approve` both return `{ data: <payrollRun> }` with the run's
 * status/totals updated server-side from the authenticated user.
 */

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
        period_from: params.periodFrom,
        period_to: params.periodTo,
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

  async calculate({ signal }, id) {
    const { data } = await http(`${PAYROLL_RUN_BASE}/${id}/calculate`, {
      method: 'POST',
      body: {},
      signal,
      schema: payrollRunEnvelopeDecoder,
    });
    return requireData(data, `POST /payroll-runs/${id}/calculate`).data;
  },

  async approve({ signal }, id) {
    const { data } = await http(`${PAYROLL_RUN_BASE}/${id}/approve`, {
      method: 'POST',
      body: {},
      signal,
      schema: payrollRunEnvelopeDecoder,
    });
    return requireData(data, `POST /payroll-runs/${id}/approve`).data;
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

// ─── EmployeeSalary HTTP ──────────────────────────────────────────────────────

const EMPLOYEE_SALARY_BASE = '/employee-salaries';
/** Relations needed to render the list table without a second round-trip. */
const EMPLOYEE_SALARY_LIST_INCLUDE = 'employee,salaryStructure';

export const httpEmployeeSalaryApi: EmployeeSalaryApi = {
  async list({ signal }, params) {
    const { data } = await http(EMPLOYEE_SALARY_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        employee_id: params.employee_id,
        salary_structure_id: params.salary_structure_id,
        is_current: params.is_current,
        include: EMPLOYEE_SALARY_LIST_INCLUDE,
      },
      signal,
      schema: employeeSalaryListDecoder,
    });
    return requireData(data, 'GET /employee-salaries');
  },

  async create({ signal }, input: EmployeeSalaryInput) {
    const { data } = await http(EMPLOYEE_SALARY_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: employeeSalaryEnvelopeDecoder,
    });
    return requireData(data, 'POST /employee-salaries').data;
  },

  async update({ signal }, id, input: EmployeeSalaryUpdateInput) {
    const { data } = await http(`${EMPLOYEE_SALARY_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: employeeSalaryEnvelopeDecoder,
    });
    return requireData(data, `PATCH /employee-salaries/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${EMPLOYEE_SALARY_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

// ─── PayslipItem HTTP ─────────────────────────────────────────────────────────

const PAYSLIP_ITEM_BASE = '/payslip-items';

export const httpPayslipItemApi: PayslipItemApi = {
  async list({ signal }, params) {
    const { data } = await http(PAYSLIP_ITEM_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        payslip_id: params.payslip_id,
        salary_component_id: params.salary_component_id,
        type: params.type,
        is_taxable: params.is_taxable,
      },
      signal,
      schema: payslipItemListDecoder,
    });
    return requireData(data, 'GET /payslip-items');
  },

  async create({ signal }, input: PayslipItemInput) {
    const { data } = await http(PAYSLIP_ITEM_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: payslipItemEnvelopeDecoder,
    });
    return requireData(data, 'POST /payslip-items').data;
  },

  async update({ signal }, id, input: PayslipItemUpdateInput) {
    const { data } = await http(`${PAYSLIP_ITEM_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: payslipItemEnvelopeDecoder,
    });
    return requireData(data, `PATCH /payslip-items/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${PAYSLIP_ITEM_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

// ─── Active transports (mock is default) ─────────────────────────────────────

export const payrollRunApi: PayrollRunApi = env.useMockApi ? mockPayrollRunApi : httpPayrollRunApi;
export const payslipApi: PayslipApi = env.useMockApi ? mockPayslipApi : httpPayslipApi;
export const employeeSalaryApi: EmployeeSalaryApi = env.useMockApi
  ? mockEmployeeSalaryApi
  : httpEmployeeSalaryApi;
export const payslipItemApi: PayslipItemApi = env.useMockApi ? mockPayslipItemApi : httpPayslipItemApi;

if (env.isDev && env.useMockApi) {
  // Review affordance for loading/error/rollback states:
  //   __payrollMock.setFailureRate(1)       // force every request to fail
  //   __payrollMock.resetRuns()             // restore payroll-run seed data
  //   __payrollMock.resetPayslips()         // restore payslip seed data
  //   __payrollMock.resetEmployeeSalaries() // restore employee-salary seed data
  //   __payrollMock.resetPayslipItems()     // restore payslip-item seed data
  Object.defineProperty(window, '__payrollMock', {
    value: {
      setFailureRate: setMockPayrollFailureRate,
      resetRuns: resetMockPayrollRuns,
      resetPayslips: resetMockPayslips,
      resetEmployeeSalaries: resetMockEmployeeSalaries,
      resetPayslipItems: resetMockPayslipItems,
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
  EmployeeSalaryInput,
  EmployeeSalaryUpdateInput,
  EmployeeSalaryListParams,
  PayslipItemInput,
  PayslipItemUpdateInput,
  PayslipItemListParams,
};
