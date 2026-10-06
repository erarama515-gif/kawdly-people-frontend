import { env } from '@/config/env';
import { createHttpClient } from '@/lib/api/http';
import type { HttpClient } from '@/lib/api/http';
import {
  mockSalaryStructureApi,
  mockSalaryComponentApi,
  resetMockSalary,
  setMockSalaryFailureRate,
} from './mockApi';
import {
  salaryStructureEnvelopeDecoder,
  salaryStructureListDecoder,
  salaryComponentEnvelopeDecoder,
  salaryComponentListDecoder,
} from './schema';
import type {
  SalaryStructureApi,
  SalaryStructureInput,
  SalaryStructureListParams,
  SalaryStructureUpdateInput,
  SalaryComponentApi,
  SalaryComponentInput,
  SalaryComponentListParams,
  SalaryComponentUpdateInput,
} from './resource';

/**
 * Real HTTP implementations of `SalaryStructureApi` and `SalaryComponentApi`,
 * pointed at `/api/v1/salary-structures` and `/api/v1/salary-components`.
 * Mock is the active default (see `env.useMockApi`).
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

// ─── HTTP SalaryStructure ─────────────────────────────────────────────────────

const STRUCTURES_BASE = '/salary-structures';

export const httpSalaryStructureApi: SalaryStructureApi = {
  async list({ signal }, params) {
    const { data } = await http(STRUCTURES_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        search: params.search || undefined,
        is_active: params.isActive,
      },
      signal,
      schema: salaryStructureListDecoder,
    });
    return requireData(data, 'GET /salary-structures');
  },

  async create({ signal }, input) {
    const { data } = await http(STRUCTURES_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: salaryStructureEnvelopeDecoder,
    });
    return requireData(data, 'POST /salary-structures').data;
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${STRUCTURES_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: salaryStructureEnvelopeDecoder,
    });
    return requireData(data, `PATCH /salary-structures/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${STRUCTURES_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

// ─── HTTP SalaryComponent ─────────────────────────────────────────────────────

const COMPONENTS_BASE = '/salary-components';

export const httpSalaryComponentApi: SalaryComponentApi = {
  async list({ signal }, params) {
    const { data } = await http(COMPONENTS_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        search: params.search || undefined,
        salary_structure_id: params.salary_structure_id,
        type: params.type,
      },
      signal,
      schema: salaryComponentListDecoder,
    });
    return requireData(data, 'GET /salary-components');
  },

  async create({ signal }, input) {
    const { data } = await http(COMPONENTS_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: salaryComponentEnvelopeDecoder,
    });
    return requireData(data, 'POST /salary-components').data;
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${COMPONENTS_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: salaryComponentEnvelopeDecoder,
    });
    return requireData(data, `PATCH /salary-components/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${COMPONENTS_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

// ─── Active transports (mock by default) ─────────────────────────────────────

export const salaryStructureApi: SalaryStructureApi = env.useMockApi
  ? mockSalaryStructureApi
  : httpSalaryStructureApi;

export const salaryComponentApi: SalaryComponentApi = env.useMockApi
  ? mockSalaryComponentApi
  : httpSalaryComponentApi;

if (env.isDev && env.useMockApi) {
  Object.defineProperty(window, '__salaryMock', {
    value: { setFailureRate: setMockSalaryFailureRate, reset: resetMockSalary },
    configurable: true,
  });
}

export type {
  SalaryStructureInput,
  SalaryStructureUpdateInput,
  SalaryStructureListParams,
  SalaryComponentInput,
  SalaryComponentUpdateInput,
  SalaryComponentListParams,
};
