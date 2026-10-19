import { env } from '@/config/env';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import { mockJobPostingApi, resetMockJobPostings, setMockJobPostingFailureRate } from './mockApi';
import { jobPostingEnvelopeDecoder, jobPostingListDecoder } from './schema';
import type { JobPostingApi, JobPostingInput, JobPostingListParams, JobPostingUpdateInput } from './resource';

/**
 * Real HTTP implementation of `JobPostingApi`, pointed at
 * `/api/v1/job-postings` exactly as documented in the Laravel route list.
 *
 * The backend does not have a synthetic `status` column. Before decoding,
 * each raw record is annotated with a client-computed status so the schema
 * decoder can validate it. See `computeStatus()` for the derivation logic.
 */

const BASE = '/job-postings';

/**
 * Computes the synthetic `status` from the real backend columns.
 *  - draft  : is_published = false
 *  - closed : is_published = true, expires_at is in the past
 *  - open   : is_published = true, expires_at is null or in the future
 */
function computeStatus(raw: { is_published: boolean; expires_at?: string | null }): 'open' | 'closed' | 'draft' {
  if (!raw.is_published) return 'draft';
  if (raw.expires_at && new Date(raw.expires_at) < new Date()) return 'closed';
  return 'open';
}

function annotate(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    ...raw,
    status: computeStatus(raw as { is_published: boolean; expires_at?: string | null }),
  };
}

function annotateList(body: { data: Record<string, unknown>[]; meta: unknown }): unknown {
  return { ...body, data: body.data.map(annotate) };
}

export const httpJobPostingApi: JobPostingApi = {
  async list({ signal }, params) {
    const { data } = await http(BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        search: params.search || undefined,
        ...(params.status === 'draft' ? { is_published: false } :
            params.status === 'open'  ? { is_published: true }  :
            params.status === 'closed'? { is_published: true }  : {}),
      },
      signal,
      schema: {
        expected: jobPostingListDecoder.expected,
        decode: (input) => jobPostingListDecoder.decode(annotateList(input as { data: Record<string, unknown>[]; meta: unknown })),
      },
    });
    return requireData(data, 'GET /job-postings');
  },

  async create({ signal }, input) {
    const { data } = await http(BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: {
        expected: jobPostingEnvelopeDecoder.expected,
        decode: (input) => {
          const env = input as { data: Record<string, unknown> };
          return jobPostingEnvelopeDecoder.decode({ data: annotate(env.data) });
        },
      },
    });
    return requireData(data, 'POST /job-postings').data;
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: {
        expected: jobPostingEnvelopeDecoder.expected,
        decode: (input) => {
          const env = input as { data: Record<string, unknown> };
          return jobPostingEnvelopeDecoder.decode({ data: annotate(env.data) });
        },
      },
    });
    return requireData(data, `PATCH /job-postings/${id}`).data;
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
 * RecruitmentPage is fully interactive before the Laravel backend is wired up,
 * and a build pointed at a real backend switches with no code change.
 */
export const jobPostingApi: JobPostingApi = env.useMockApi ? mockJobPostingApi : httpJobPostingApi;

if (env.isDev && env.useMockApi) {
  // Review affordance for loading/error/rollback states:
  //   __jobPostingsMock.setFailureRate(1)  // force every request to fail
  //   __jobPostingsMock.reset()            // restore seed data
  Object.defineProperty(window, '__jobPostingsMock', {
    value: { setFailureRate: setMockJobPostingFailureRate, reset: resetMockJobPostings },
    configurable: true,
  });
}

export type { JobPostingInput, JobPostingUpdateInput, JobPostingListParams };
