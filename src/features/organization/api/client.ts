import { env } from '@/config/env';
import { createHttpClient } from '@/lib/api/http';
import type { HttpClient } from '@/lib/api/http';
import {
  mockDepartmentApi,
  mockCompanyApi,
  mockBranchApi,
  mockJobPositionApi,
  resetMockDepartments,
  resetMockCompanies,
  resetMockBranches,
  resetMockJobPositions,
  setMockFailureRate,
} from './mockApi';
import {
  departmentEnvelopeDecoder,
  departmentListDecoder,
  companyEnvelopeDecoder,
  companyListDecoder,
  branchEnvelopeDecoder,
  branchListDecoder,
  jobPositionEnvelopeDecoder,
  jobPositionListDecoder,
} from './schema';
import type {
  DepartmentApi,
  DepartmentInput,
  DepartmentListParams,
  DepartmentUpdateInput,
  CompanyApi,
  CompanyInput,
  CompanyListParams,
  CompanyUpdateInput,
  BranchApi,
  BranchInput,
  BranchListParams,
  BranchUpdateInput,
  JobPositionApi,
  JobPositionInput,
  JobPositionListParams,
  JobPositionUpdateInput,
} from './resource';

/**
 * Real HTTP implementations of DepartmentApi, CompanyApi, BranchApi, and
 * JobPositionApi.
 *
 * Note on search params for Company/Branch/JobPosition: the real backend
 * controllers do NOT list a free-text `search` field in their $filterable
 * arrays. The mock implementations support client-side search for UX, but the
 * HTTP implementations do NOT send a `search` query param to avoid fabricating
 * a backend contract that doesn't exist. This is documented in the report.
 */

const http: HttpClient = createHttpClient({
  baseUrl: env.apiBaseUrl || '/api/v1',
  timeoutMs: env.requestTimeoutMs,
  retries: env.requestRetries,
  backoffMs: env.requestBackoffMs,
});

// ─── Department ───────────────────────────────────────────────────────────────

const DEPT_BASE = '/departments';

export const httpDepartmentApi: DepartmentApi = {
  async list({ signal }, params) {
    const { data } = await http(DEPT_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        search: params.search || undefined,
        is_active: params.isActive,
        include: 'head',
      },
      signal,
      schema: departmentListDecoder,
    });
    return requireData(data, 'GET /departments');
  },

  async create({ signal }, input) {
    const { data } = await http(DEPT_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: departmentEnvelopeDecoder,
    });
    return requireData(data, 'POST /departments').data;
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${DEPT_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: departmentEnvelopeDecoder,
    });
    return requireData(data, `PATCH /departments/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${DEPT_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

// ─── Company ─────────────────────────────────────────────────────────────────

const COMPANY_BASE = '/companies';

export const httpCompanyApi: CompanyApi = {
  async list({ signal }, params) {
    const { data } = await http(COMPANY_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        // NOTE: no `search` param — backend $filterable does not include free-text search
        is_active: params.isActive,
      },
      signal,
      schema: companyListDecoder,
    });
    return requireData(data, 'GET /companies');
  },

  async create({ signal }, input) {
    const { data } = await http(COMPANY_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: companyEnvelopeDecoder,
    });
    return requireData(data, 'POST /companies').data;
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${COMPANY_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: companyEnvelopeDecoder,
    });
    return requireData(data, `PATCH /companies/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${COMPANY_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

// ─── Branch ──────────────────────────────────────────────────────────────────

const BRANCH_BASE = '/branches';

export const httpBranchApi: BranchApi = {
  async list({ signal }, params) {
    const { data } = await http(BRANCH_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        // NOTE: no `search` param — backend $filterable does not include free-text search
        company_id: params.companyId,
        is_active: params.isActive,
        include: 'company',
      },
      signal,
      schema: branchListDecoder,
    });
    return requireData(data, 'GET /branches');
  },

  async create({ signal }, input) {
    const { data } = await http(BRANCH_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: branchEnvelopeDecoder,
    });
    return requireData(data, 'POST /branches').data;
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${BRANCH_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: branchEnvelopeDecoder,
    });
    return requireData(data, `PATCH /branches/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${BRANCH_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

// ─── JobPosition ──────────────────────────────────────────────────────────────

const JOB_POSITION_BASE = '/job-positions';

export const httpJobPositionApi: JobPositionApi = {
  async list({ signal }, params) {
    const { data } = await http(JOB_POSITION_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        // NOTE: no `search` param — backend $filterable does not include free-text search
        company_id: params.companyId,
        department_id: params.departmentId,
        is_active: params.isActive,
        include: 'company,department',
      },
      signal,
      schema: jobPositionListDecoder,
    });
    return requireData(data, 'GET /job-positions');
  },

  async create({ signal }, input) {
    const { data } = await http(JOB_POSITION_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: jobPositionEnvelopeDecoder,
    });
    return requireData(data, 'POST /job-positions').data;
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${JOB_POSITION_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: jobPositionEnvelopeDecoder,
    });
    return requireData(data, `PATCH /job-positions/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${JOB_POSITION_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireData<T>(data: T | undefined, endpoint: string): T {
  if (data === undefined) throw new Error(`${endpoint} returned an empty body`);
  return data;
}

// ─── Selectors ────────────────────────────────────────────────────────────────

/**
 * Chooses the transport once per app, exactly like the Employees feature:
 * mock is the default whenever no API base URL is configured.
 */
export const departmentApi: DepartmentApi = env.useMockApi ? mockDepartmentApi : httpDepartmentApi;
export const companyApi: CompanyApi = env.useMockApi ? mockCompanyApi : httpCompanyApi;
export const branchApi: BranchApi = env.useMockApi ? mockBranchApi : httpBranchApi;
export const jobPositionApi: JobPositionApi = env.useMockApi ? mockJobPositionApi : httpJobPositionApi;

if (env.isDev && env.useMockApi) {
  Object.defineProperty(window, '__departmentsMock', {
    value: { setFailureRate: setMockFailureRate, reset: resetMockDepartments },
    configurable: true,
  });
  Object.defineProperty(window, '__companiesMock', {
    value: { reset: resetMockCompanies },
    configurable: true,
  });
  Object.defineProperty(window, '__branchesMock', {
    value: { reset: resetMockBranches },
    configurable: true,
  });
  Object.defineProperty(window, '__jobPositionsMock', {
    value: { reset: resetMockJobPositions },
    configurable: true,
  });
}

export type {
  DepartmentInput,
  DepartmentUpdateInput,
  DepartmentListParams,
  CompanyInput,
  CompanyUpdateInput,
  CompanyListParams,
  BranchInput,
  BranchUpdateInput,
  BranchListParams,
  JobPositionInput,
  JobPositionUpdateInput,
  JobPositionListParams,
};
