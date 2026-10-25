import { env } from '@/config/env';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import {
  mockCareerPathApi,
  mockCareerPathLevelApi,
  mockSuccessionPlanApi,
  resetMockCareerPathLevels,
  resetMockCareerPaths,
  resetMockSuccessionPlans,
  setMockFailureRate,
} from './mockApi';
import {
  careerPathEnvelopeDecoder,
  careerPathListDecoder,
  careerPathLevelEnvelopeDecoder,
  careerPathLevelListDecoder,
  successionPlanEnvelopeDecoder,
  successionPlanListDecoder,
} from './schema';
import type {
  CareerPathApi,
  CareerPathInput,
  CareerPathListParams,
  CareerPathUpdateInput,
  CareerPathLevelApi,
  CareerPathLevelInput,
  CareerPathLevelListParams,
  CareerPathLevelUpdateInput,
  SuccessionPlanApi,
  SuccessionPlanInput,
  SuccessionPlanListParams,
  SuccessionPlanUpdateInput,
} from './resource';

/**
 * Real HTTP implementations for the Career module's three resources,
 * pointed at `/api/v1/career-paths`, `/api/v1/career-path-levels`, and
 * `/api/v1/succession-plans`.
 *
 * Every response is decoded before it is returned, so a contract drift becomes
 * a typed `decode` error at the boundary — never a silent `undefined`.
 *
 * Mock is the active default (see bottom of file) until `VITE_API_BASE_URL` is set.
 */

function requireData<T>(data: T | undefined, endpoint: string): T {
  if (data === undefined) throw new Error(`${endpoint} returned an empty body`);
  return data;
}

// ─── CareerPath HTTP ──────────────────────────────────────────────────────────

const CAREER_PATH_BASE = '/career-paths';

export const httpCareerPathApi: CareerPathApi = {
  async list({ signal }, params) {
    const { data } = await http(CAREER_PATH_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        search: params.search || undefined,
      },
      signal,
      schema: careerPathListDecoder,
    });
    return requireData(data, 'GET /career-paths');
  },

  async create({ signal }, input: CareerPathInput) {
    const { data } = await http(CAREER_PATH_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: careerPathEnvelopeDecoder,
    });
    return requireData(data, 'POST /career-paths').data;
  },

  async update({ signal }, id, input: CareerPathUpdateInput) {
    const { data } = await http(`${CAREER_PATH_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: careerPathEnvelopeDecoder,
    });
    return requireData(data, `PATCH /career-paths/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${CAREER_PATH_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

// ─── CareerPathLevel HTTP ─────────────────────────────────────────────────────

const CAREER_PATH_LEVEL_BASE = '/career-path-levels';

export const httpCareerPathLevelApi: CareerPathLevelApi = {
  async list({ signal }, params) {
    const { data } = await http(CAREER_PATH_LEVEL_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        search: params.search || undefined,
        career_path_id: params.career_path_id,
        include: 'careerPath,jobPosition',
      },
      signal,
      schema: careerPathLevelListDecoder,
    });
    return requireData(data, 'GET /career-path-levels');
  },

  async create({ signal }, input: CareerPathLevelInput) {
    const { data } = await http(CAREER_PATH_LEVEL_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: careerPathLevelEnvelopeDecoder,
    });
    return requireData(data, 'POST /career-path-levels').data;
  },

  async update({ signal }, id, input: CareerPathLevelUpdateInput) {
    const { data } = await http(`${CAREER_PATH_LEVEL_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: careerPathLevelEnvelopeDecoder,
    });
    return requireData(data, `PATCH /career-path-levels/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${CAREER_PATH_LEVEL_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

// ─── SuccessionPlan HTTP ──────────────────────────────────────────────────────

const SUCCESSION_PLAN_BASE = '/succession-plans';

export const httpSuccessionPlanApi: SuccessionPlanApi = {
  async list({ signal }, params) {
    const { data } = await http(SUCCESSION_PLAN_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        search: params.search || undefined,
        readiness: params.readiness,
        include: 'jobPosition,currentHolder,successor',
      },
      signal,
      schema: successionPlanListDecoder,
    });
    return requireData(data, 'GET /succession-plans');
  },

  async create({ signal }, input: SuccessionPlanInput) {
    const { data } = await http(SUCCESSION_PLAN_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: successionPlanEnvelopeDecoder,
    });
    return requireData(data, 'POST /succession-plans').data;
  },

  async update({ signal }, id, input: SuccessionPlanUpdateInput) {
    const { data } = await http(`${SUCCESSION_PLAN_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: successionPlanEnvelopeDecoder,
    });
    return requireData(data, `PATCH /succession-plans/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${SUCCESSION_PLAN_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

// ─── Active transports (mock is default) ─────────────────────────────────────

export const careerPathApi: CareerPathApi = env.useMockApi ? mockCareerPathApi : httpCareerPathApi;
export const careerPathLevelApi: CareerPathLevelApi = env.useMockApi
  ? mockCareerPathLevelApi
  : httpCareerPathLevelApi;
export const successionPlanApi: SuccessionPlanApi = env.useMockApi ? mockSuccessionPlanApi : httpSuccessionPlanApi;

if (env.isDev && env.useMockApi) {
  // Review affordance for loading/error/rollback states:
  //   __careerMock.setFailureRate(1)      // force every request to fail
  //   __careerMock.resetPaths()           // restore career-path seed data
  //   __careerMock.resetLevels()          // restore career-path-level seed data
  //   __careerMock.resetPlans()           // restore succession-plan seed data
  Object.defineProperty(window, '__careerMock', {
    value: {
      setFailureRate: setMockFailureRate,
      resetPaths: resetMockCareerPaths,
      resetLevels: resetMockCareerPathLevels,
      resetPlans: resetMockSuccessionPlans,
    },
    configurable: true,
  });
}

export type {
  CareerPathInput,
  CareerPathUpdateInput,
  CareerPathListParams,
  CareerPathLevelInput,
  CareerPathLevelUpdateInput,
  CareerPathLevelListParams,
  SuccessionPlanInput,
  SuccessionPlanUpdateInput,
  SuccessionPlanListParams,
};
