import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import { num, object, optional, str, literalUnion, array, passthrough } from '@/lib/api/decode';

// ─── Pipeline Stats ───────────────────────────────────────────────────────────

/**
 * Wire shape returned by GET /api/v1/pipeline-stats.
 *
 * The `object()` decoder ignores unknown keys so additive backend changes
 * won't break the client.
 */
const pipelineStagesDecoder = object({
  applied:   num(),
  screening: num(),
  interview: num(),
  offer:     num(),
  hired:     num(),
  rejected:  num(),
});

const pipelineStatsDecoder = object({
  data: object({
    stages:           pipelineStagesDecoder,
    open_positions:   num(),
    total_applicants: num(),
  }),
});

export type PipelineStatsWire = ReturnType<typeof pipelineStatsDecoder.decode>['data'];

const PIPELINE_STATS_KEY = ['recruitment', 'pipeline-stats'] as const;

export interface UsePipelineStatsResult {
  state: QueryState<PipelineStatsWire>;
  refetch: () => void;
}

/**
 * Fetches live pipeline statistics from GET /api/v1/pipeline-stats.
 *
 * Falls back gracefully when the request fails — the `state.error` field is set
 * and the caller can render the fallback values from `data.ts` instead.
 * Cache is kept fresh for 30 seconds.
 */
export function usePipelineStats(): UsePipelineStatsResult {
  const { state, refetch } = useQuery<PipelineStatsWire>({
    queryKey: PIPELINE_STATS_KEY,
    queryFn: async (context) => {
      const { data } = await http('/pipeline-stats', {
        signal: context.signal,
        schema: pipelineStatsDecoder,
      });
      if (data === undefined) {
        throw new Error('GET /pipeline-stats returned an empty body');
      }
      return data.data;
    },
    staleTime: 30_000,
  });

  return { state, refetch };
}

// ─── Offer/Hired Candidates ───────────────────────────────────────────────────

const candidateStageDecoder = literalUnion([
  'applied', 'screening', 'interview', 'technical', 'hr',
  'offer', 'hired', 'rejected', 'withdrawn',
] as const);

export type CandidateStage = ReturnType<typeof candidateStageDecoder.decode>;

const candidateJobPostingDecoder = object({
  id: num(),
  title: str(),
});

const candidateDecoder = object({
  id:                    num(),
  first_name:            str(),
  last_name:             str(),
  email:                 str(),
  phone:                 optional(str()),
  stage:                 candidateStageDecoder,
  job_posting_id:        optional(num()),
  job_posting:           optional(candidateJobPostingDecoder),
  source:                optional(str()),
  match_score:           optional(passthrough()),
  notes:                 optional(str()),
  applied_at:            optional(str()),
  converted_employee_id: optional(num()),
});

export type CandidateWire = ReturnType<typeof candidateDecoder.decode>;

const candidateListDecoder = object({
  data: array(candidateDecoder),
  meta: object({
    current_page: num(),
    per_page:     num(),
    total:        num(),
    last_page:    num(),
  }),
});

export interface CandidateListParams {
  page: number;
  perPage: number;
  search?: string | undefined;
  stage?: CandidateStage | 'all' | undefined;
  job_posting_id?: number | undefined;
}

export type CandidateListWire = ReturnType<typeof candidateListDecoder.decode>;

export interface UseCandidateListResult {
  state: QueryState<CandidateListWire>;
  refetch: () => void;
}

/**
 * Fetches paginated candidate list from GET /api/v1/candidates with optional
 * stage and job_posting_id filters, debounced search, and includes jobPosting.
 */
export function useCandidateList(params: CandidateListParams): UseCandidateListResult {
  const { state, refetch } = useQuery<CandidateListWire>({
    queryKey: ['recruitment', 'candidates', 'list', params] as const,
    queryFn: async (context) => {
      const { data } = await http('/candidates', {
        query: {
          page: params.page,
          per_page: params.perPage,
          search: params.search || undefined,
          stage: params.stage && params.stage !== 'all' ? params.stage : undefined,
          job_posting_id: params.job_posting_id || undefined,
          include: 'jobPosting',
        },
        signal: context.signal,
        schema: candidateListDecoder,
      });
      if (data === undefined) {
        throw new Error('GET /candidates returned an empty body');
      }
      return data;
    },
    staleTime: 15_000,
  });

  return { state, refetch };
}

/**
 * Updates a candidate's pipeline stage (e.g. applied -> screening -> interview -> offer).
 */
export function useUpdateCandidateStage() {
  const client = useQueryClient();

  return useMutation<{ candidateId: number; stage: CandidateStage }, void>({
    mutationFn: async ({ candidateId, stage }, { signal }) => {
      await http(`/candidates/${candidateId}`, {
        method: 'PATCH',
        body: { stage },
        signal,
        schema: passthrough(),
      });
    },
    onSuccess: () => {
      void client.invalidate({ predicate: isPipelineKey });
    },
  });
}

/**
 * Removes a candidate from the recruitment pipeline.
 */
export function useDeleteCandidate() {
  const client = useQueryClient();

  return useMutation<number, void>({
    mutationFn: async (candidateId, { signal }) => {
      await http(`/candidates/${candidateId}`, {
        method: 'DELETE',
        signal,
        ignoreBody: true,
      });
    },
    onSuccess: () => {
      void client.invalidate({ predicate: isPipelineKey });
    },
  });
}

const OFFER_CANDIDATES_KEY = ['recruitment', 'candidates', 'offer-hired'] as const;

export interface UseOfferCandidatesResult {
  state: QueryState<CandidateWire[]>;
  refetch: () => void;
}

/**
 * Fetches all candidates in the 'offer' and 'hired' stages so the
 * "Convert to Employee" panel can list them. We make two requests
 * (one per stage) and merge, since the backend filters by single stage.
 */
export function useOfferCandidates(): UseOfferCandidatesResult {
  const { state, refetch } = useQuery<CandidateWire[]>({
    queryKey: OFFER_CANDIDATES_KEY,
    queryFn: async (context) => {
      const [offerRes, hiredRes] = await Promise.all([
        http('/candidates', {
          query: { stage: 'offer', per_page: 100 },
          signal: context.signal,
          schema: candidateListDecoder,
        }),
        http('/candidates', {
          query: { stage: 'hired', per_page: 100 },
          signal: context.signal,
          schema: candidateListDecoder,
        }),
      ]);

      const offer = offerRes.data?.data ?? [];
      const hired = hiredRes.data?.data ?? [];
      // Only include hired candidates that are not yet converted.
      const unconvertedHired = hired.filter((c) => c.converted_employee_id === undefined);
      return [...offer, ...unconvertedHired];
    },
    staleTime: 30_000,
  });

  return { state, refetch };
}

// ─── Convert to Employee ──────────────────────────────────────────────────────

export interface ConvertToEmployeeInput {
  candidateId: number;
  branch_id: number;
  department_id: number;
  job_position_id: number;
  joining_date: string;
  employment_type: 'full_time' | 'part_time' | 'contract' | 'intern';
  work_location: 'office' | 'remote' | 'hybrid';
}

function isPipelineKey(key: readonly unknown[]): boolean {
  return key[0] === 'recruitment';
}

/**
 * Mutation to POST /api/v1/recruitment/candidates/{id}/convert-to-employee.
 * On success, invalidates both the pipeline-stats and offer-candidates caches
 * so counts and the candidate list refresh automatically.
 */
export function useConvertToEmployee() {
  const client = useQueryClient();

  return useMutation<ConvertToEmployeeInput, void>({
    mutationFn: async ({ candidateId, ...body }, { signal }) => {
      // We only need success/failure — the employee payload is not used here.
      await http(`/candidates/${candidateId}/convert-to-employee`, {
        method: 'POST',
        body,
        signal,
        schema: passthrough(),
      });
    },
    onSuccess: () => {
      void client.invalidate({ predicate: isPipelineKey });
    },
  });
}
