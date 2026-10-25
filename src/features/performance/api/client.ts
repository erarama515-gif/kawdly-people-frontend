import { env } from '@/config/env';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import {
  mockPerformanceCycleApi,
  mockPerformanceReviewApi,
  resetMockPerformanceCycles,
  resetMockPerformanceReviews,
  setMockFailureRate,
} from './mockApi';
import {
  performanceCycleEnvelopeDecoder,
  performanceCycleListDecoder,
  performanceReviewEnvelopeDecoder,
  performanceReviewListDecoder,
} from './schema';
import type {
  PerformanceCycleApi,
  PerformanceCycleInput,
  PerformanceCycleListParams,
  PerformanceCycleUpdateInput,
  PerformanceReviewApi,
  PerformanceReviewInput,
  PerformanceReviewListParams,
  PerformanceReviewUpdateInput,
} from './resource';

/**
 * Real HTTP implementations for the Performance module's two resources,
 * pointed at `/api/v1/performance-cycles` and `/api/v1/performance-reviews`.
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

// ─── PerformanceCycle HTTP ─────────────────────────────────────────────────────

const CYCLE_BASE = '/performance-cycles';

export const httpPerformanceCycleApi: PerformanceCycleApi = {
  async list({ signal }, params) {
    const { data } = await http(CYCLE_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        status: params.status,
      },
      signal,
      schema: performanceCycleListDecoder,
    });
    return requireData(data, 'GET /performance-cycles');
  },

  async create({ signal }, input: PerformanceCycleInput) {
    const { data } = await http(CYCLE_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: performanceCycleEnvelopeDecoder,
    });
    return requireData(data, 'POST /performance-cycles').data;
  },

  async update({ signal }, id, input: PerformanceCycleUpdateInput) {
    const { data } = await http(`${CYCLE_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: performanceCycleEnvelopeDecoder,
    });
    return requireData(data, `PATCH /performance-cycles/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${CYCLE_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

// ─── PerformanceReview HTTP ───────────────────────────────────────────────────

const REVIEW_BASE = '/performance-reviews';
/** Relations needed to render the table without a second round-trip. */
const REVIEW_LIST_INCLUDE = 'employee,reviewer';

export const httpPerformanceReviewApi: PerformanceReviewApi = {
  async list({ signal }, params) {
    const { data } = await http(REVIEW_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        search: params.search || undefined,
        cycle_id: params.cycle_id,
        review_type: params.review_type,
        status: params.status,
        include: REVIEW_LIST_INCLUDE,
      },
      signal,
      schema: performanceReviewListDecoder,
    });
    return requireData(data, 'GET /performance-reviews');
  },

  async create({ signal }, input: PerformanceReviewInput) {
    const { data } = await http(REVIEW_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: performanceReviewEnvelopeDecoder,
    });
    return requireData(data, 'POST /performance-reviews').data;
  },

  async update({ signal }, id, input: PerformanceReviewUpdateInput) {
    const { data } = await http(`${REVIEW_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: performanceReviewEnvelopeDecoder,
    });
    return requireData(data, `PATCH /performance-reviews/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${REVIEW_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

// ─── Active transports (mock is default) ─────────────────────────────────────

export const performanceCycleApi: PerformanceCycleApi = env.useMockApi
  ? mockPerformanceCycleApi
  : httpPerformanceCycleApi;

export const performanceReviewApi: PerformanceReviewApi = env.useMockApi
  ? mockPerformanceReviewApi
  : httpPerformanceReviewApi;

if (env.isDev && env.useMockApi) {
  // Review affordance for loading/error/rollback states:
  //   __performanceMock.setFailureRate(1)   // force every request to fail
  //   __performanceMock.resetCycles()       // restore cycle seed data
  //   __performanceMock.resetReviews()      // restore review seed data
  Object.defineProperty(window, '__performanceMock', {
    value: {
      setFailureRate: setMockFailureRate,
      resetCycles: resetMockPerformanceCycles,
      resetReviews: resetMockPerformanceReviews,
    },
    configurable: true,
  });
}

export type {
  PerformanceCycleInput,
  PerformanceCycleUpdateInput,
  PerformanceCycleListParams,
  PerformanceReviewInput,
  PerformanceReviewUpdateInput,
  PerformanceReviewListParams,
};
