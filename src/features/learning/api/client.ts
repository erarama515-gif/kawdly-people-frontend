import { env } from '@/config/env';
import { createHttpClient } from '@/lib/api/http';
import type { HttpClient } from '@/lib/api/http';
import { mockTrainingProgramApi, resetMockTrainingPrograms, setMockFailureRate } from './mockApi';
import { trainingProgramEnvelopeDecoder, trainingProgramListDecoder } from './schema';
import type {
  TrainingProgramApi,
  TrainingProgramInput,
  TrainingProgramListParams,
  TrainingProgramUpdateInput,
} from './resource';

/**
 * Real HTTP implementation of `TrainingProgramApi`, pointed at
 * `/api/v1/training-programs` exactly as documented in the Laravel route list:
 *  - `index` returns the app's custom `{ data, meta }` pager
 *  - `show`/`store`/`update` return `{ data: <trainingProgram> }`
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

const BASE = '/training-programs';

export const httpTrainingProgramApi: TrainingProgramApi = {
  async list({ signal }, params) {
    const { data } = await http(BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        search: params.search || undefined,
        status: params.status,
        type: params.type,
      },
      signal,
      schema: trainingProgramListDecoder,
    });
    return requireData(data, 'GET /training-programs');
  },

  async create({ signal }, input) {
    const { data } = await http(BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: trainingProgramEnvelopeDecoder,
    });
    return requireData(data, 'POST /training-programs').data;
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: trainingProgramEnvelopeDecoder,
    });
    return requireData(data, `PATCH /training-programs/${id}`).data;
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
 * Chooses the transport once per app, exactly like the Employees/Attendance/
 * Contracts features: mock is the default whenever no API base URL is
 * configured, so the Learning page is fully interactive before the Laravel
 * backend is wired up, and a build pointed at a real backend switches with
 * no code change.
 */
export const trainingProgramApi: TrainingProgramApi =
  env.useMockApi ? mockTrainingProgramApi : httpTrainingProgramApi;

if (env.isDev && env.useMockApi) {
  // Review affordance for loading/error/rollback states:
  //   __trainingProgramMock.setFailureRate(1)  // force every request to fail
  //   __trainingProgramMock.reset()            // restore seed data
  Object.defineProperty(window, '__trainingProgramMock', {
    value: {
      setFailureRate: setMockFailureRate,
      reset: resetMockTrainingPrograms,
    },
    configurable: true,
  });
}

export type { TrainingProgramInput, TrainingProgramUpdateInput, TrainingProgramListParams };
