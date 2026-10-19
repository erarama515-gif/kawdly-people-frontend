import { env } from '@/config/env';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import {
  mockDepartmentApi,
  mockCompanyApi,
  mockBranchApi,
  mockJobPositionApi,
  mockJobGradeApi,
  mockJobLevelApi,
  mockCostCenterApi,
  resetMockDepartments,
  resetMockCompanies,
  resetMockBranches,
  resetMockJobPositions,
  resetMockJobGrades,
  resetMockJobLevels,
  resetMockCostCenters,
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
  jobGradeEnvelopeDecoder,
  jobGradeListDecoder,
  jobLevelEnvelopeDecoder,
  jobLevelListDecoder,
  costCenterEnvelopeDecoder,
  costCenterListDecoder,
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
  JobGradeApi,
  JobGradeInput,
  JobGradeListParams,
  JobGradeUpdateInput,
  JobLevelApi,
  JobLevelInput,
  JobLevelListParams,
  JobLevelUpdateInput,
  CostCenterApi,
  CostCenterInput,
  CostCenterListParams,
  CostCenterUpdateInput,
} from './resource';

/**
 * Real HTTP implementations of DepartmentApi, CompanyApi, BranchApi,
 * JobPositionApi, JobGradeApi, JobLevelApi, and CostCenterApi.
 *
 * Note on search params for Company/Branch/JobPosition/JobGrade/JobLevel/
 * CostCenter: the real backend controllers do NOT list a free-text `search`
 * field in their $filterable arrays. The mock implementations support
 * client-side search for UX, but the HTTP implementations do NOT send a
 * `search` query param to avoid fabricating a backend contract that doesn't
 * exist. This is documented in the report.
 */

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
        include: 'head,costCenter',
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
        job_grade_id: params.jobGradeId,
        job_level_id: params.jobLevelId,
        is_active: params.isActive,
        include: 'company,department,jobGrade,jobLevel',
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

// ─── JobGrade ─────────────────────────────────────────────────────────────────

const JOB_GRADE_BASE = '/job-grades';

export const httpJobGradeApi: JobGradeApi = {
  async list({ signal }, params) {
    const { data } = await http(JOB_GRADE_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        company_id: params.companyId,
      },
      signal,
      schema: jobGradeListDecoder,
    });
    return requireData(data, 'GET /job-grades');
  },

  async create({ signal }, input) {
    const { data } = await http(JOB_GRADE_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: jobGradeEnvelopeDecoder,
    });
    return requireData(data, 'POST /job-grades').data;
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${JOB_GRADE_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: jobGradeEnvelopeDecoder,
    });
    return requireData(data, `PATCH /job-grades/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${JOB_GRADE_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

// ─── JobLevel ─────────────────────────────────────────────────────────────────

const JOB_LEVEL_BASE = '/job-levels';

export const httpJobLevelApi: JobLevelApi = {
  async list({ signal }, params) {
    const { data } = await http(JOB_LEVEL_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        company_id: params.companyId,
      },
      signal,
      schema: jobLevelListDecoder,
    });
    return requireData(data, 'GET /job-levels');
  },

  async create({ signal }, input) {
    const { data } = await http(JOB_LEVEL_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: jobLevelEnvelopeDecoder,
    });
    return requireData(data, 'POST /job-levels').data;
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${JOB_LEVEL_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: jobLevelEnvelopeDecoder,
    });
    return requireData(data, `PATCH /job-levels/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${JOB_LEVEL_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

// ─── CostCenter ───────────────────────────────────────────────────────────────

const COST_CENTER_BASE = '/cost-centers';

export const httpCostCenterApi: CostCenterApi = {
  async list({ signal }, params) {
    const { data } = await http(COST_CENTER_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        company_id: params.companyId,
        is_active: params.isActive,
      },
      signal,
      schema: costCenterListDecoder,
    });
    return requireData(data, 'GET /cost-centers');
  },

  async create({ signal }, input) {
    const { data } = await http(COST_CENTER_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: costCenterEnvelopeDecoder,
    });
    return requireData(data, 'POST /cost-centers').data;
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${COST_CENTER_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: costCenterEnvelopeDecoder,
    });
    return requireData(data, `PATCH /cost-centers/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${COST_CENTER_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
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
export const jobGradeApi: JobGradeApi = env.useMockApi ? mockJobGradeApi : httpJobGradeApi;
export const jobLevelApi: JobLevelApi = env.useMockApi ? mockJobLevelApi : httpJobLevelApi;
export const costCenterApi: CostCenterApi = env.useMockApi ? mockCostCenterApi : httpCostCenterApi;

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
  Object.defineProperty(window, '__jobGradesMock', {
    value: { reset: resetMockJobGrades },
    configurable: true,
  });
  Object.defineProperty(window, '__jobLevelsMock', {
    value: { reset: resetMockJobLevels },
    configurable: true,
  });
  Object.defineProperty(window, '__costCentersMock', {
    value: { reset: resetMockCostCenters },
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
  JobGradeInput,
  JobGradeUpdateInput,
  JobGradeListParams,
  JobLevelInput,
  JobLevelUpdateInput,
  JobLevelListParams,
  CostCenterInput,
  CostCenterUpdateInput,
  CostCenterListParams,
};
