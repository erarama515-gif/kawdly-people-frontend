import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import {
  array,
  isoDate,
  literalUnion,
  num,
  object,
  optional,
  passthrough,
  str,
} from '@/lib/api/decode';

/**
 * Wire shapes + hooks for the recruitment interview endpoints (A6.1).
 *
 * The backend keeps the score sheet on the interview row itself
 * (`overall_score`, `recommendation`, `notes`, `feedback`) — the separate
 * `interview-scorecards` resource requires a permission the HR admin role does
 * not hold, so the UI writes the score with `PATCH /interviews/{id}` and then
 * calls `POST /interviews/{id}/complete`. Keeping both calls in one mutation
 * means a failed completion cannot silently drop the score.
 */

export const interviewTypeDecoder = literalUnion([
  'screening',
  'technical',
  'hr',
  'cultural',
  'final',
] as const);

export type InterviewType = ReturnType<typeof interviewTypeDecoder.decode>;

export const interviewStatusDecoder = literalUnion([
  'scheduled',
  'completed',
  'cancelled',
  'no_show',
] as const);

export type InterviewStatus = ReturnType<typeof interviewStatusDecoder.decode>;

export const interviewRecommendationDecoder = literalUnion([
  'hire',
  'reject',
  'hold',
  'next_round',
] as const);

export type InterviewRecommendation = ReturnType<typeof interviewRecommendationDecoder.decode>;

const interviewerDecoder = object({
  id: num(),
  first_name: str(),
  last_name: str(),
  first_name_ar: optional(str()),
  last_name_ar: optional(str()),
});

const interviewDecoder = object({
  id: num(),
  candidate_id: num(),
  interviewer_id: num(),
  type: interviewTypeDecoder,
  scheduled_at: isoDate(),
  duration_minutes: optional(num()),
  location: optional(str()),
  meeting_link: optional(str()),
  // `POST /interviews` returns the freshly inserted row without Laravel
  // refreshing DB defaults, so `status` is absent on that response even though
  // the column defaults to `scheduled`.
  status: optional(interviewStatusDecoder),
  // `decimal:1` casts serialise as strings on the wire.
  overall_score: optional(str()),
  recommendation: optional(interviewRecommendationDecoder),
  notes: optional(str()),
  feedback: optional(passthrough<Record<string, unknown>>()),
  interviewer: optional(interviewerDecoder),
});

export type InterviewWire = ReturnType<typeof interviewDecoder.decode>;

const interviewListDecoder = object({
  data: array(interviewDecoder),
  meta: object({
    current_page: num(),
    per_page: num(),
    total: num(),
    last_page: num(),
  }),
});

export type InterviewListWire = ReturnType<typeof interviewListDecoder.decode>;

const interviewEnvelopeDecoder = object({ data: interviewDecoder });

const INTERVIEW_ROOT = ['recruitment', 'interviews'] as const;

function isInterviewKey(key: readonly unknown[]): boolean {
  return key[0] === 'recruitment' && key[1] === 'interviews';
}

export interface UseInterviewListResult {
  state: QueryState<InterviewListWire>;
  refetch: () => void;
}

/** All interviews for one candidate, newest scheduled first, with the interviewer attached. */
export function useInterviewList(candidateId: number): UseInterviewListResult {
  const { state, refetch } = useQuery<InterviewListWire>({
    queryKey: [...INTERVIEW_ROOT, 'list', candidateId] as const,
    queryFn: async (context) => {
      const { data } = await http('/interviews', {
        query: {
          candidate_id: candidateId,
          per_page: 100,
          sort: 'scheduled_at',
          direction: 'desc',
          include: 'interviewer',
        },
        signal: context.signal,
        schema: interviewListDecoder,
      });
      if (data === undefined) {
        throw new Error('GET /interviews returned an empty body');
      }
      return data;
    },
    staleTime: 15_000,
    enabled: candidateId > 0,
  });

  return { state, refetch };
}

export interface InterviewInput {
  candidate_id: number;
  interviewer_id: number;
  type: InterviewType;
  scheduled_at: string;
  duration_minutes?: number | null;
  location?: string | null;
  meeting_link?: string | null;
}

export interface UpdateInterviewInput extends Partial<Omit<InterviewInput, 'candidate_id'>> {
  id: number;
}

export function useCreateInterview() {
  const client = useQueryClient();

  return useMutation<InterviewInput, InterviewWire>({
    mutationFn: async (input, { signal }) => {
      const { data } = await http('/interviews', {
        method: 'POST',
        body: input,
        signal,
        schema: interviewEnvelopeDecoder,
      });
      if (data === undefined) {
        throw new Error('POST /interviews returned an empty body');
      }
      return data.data;
    },
    onSuccess: () => {
      void client.invalidate({ predicate: isInterviewKey });
    },
  });
}

export function useUpdateInterview() {
  const client = useQueryClient();

  return useMutation<UpdateInterviewInput, InterviewWire>({
    mutationFn: async ({ id, ...input }, { signal }) => {
      const { data } = await http(`/interviews/${id}`, {
        method: 'PATCH',
        body: input,
        signal,
        schema: interviewEnvelopeDecoder,
      });
      if (data === undefined) {
        throw new Error(`PATCH /interviews/${id} returned an empty body`);
      }
      return data.data;
    },
    onSuccess: () => {
      void client.invalidate({ predicate: isInterviewKey });
    },
  });
}

export interface CompleteInterviewInput {
  id: number;
  overallScore: number;
  technicalScore?: number | null;
  communicationScore?: number | null;
  recommendation: InterviewRecommendation;
  notes?: string | null;
}

/**
 * Saves the score sheet and marks the interview completed in one mutation.
 * `POST /interviews/{id}/complete` deliberately takes no body on the backend.
 */
export function useCompleteInterview() {
  const client = useQueryClient();

  return useMutation<CompleteInterviewInput, void>({
    mutationFn: async (
      { id, overallScore, technicalScore, communicationScore, recommendation, notes },
      { signal },
    ) => {
      const feedback: Record<string, number> = {};
      if (typeof technicalScore === 'number') feedback.technical_score = technicalScore;
      if (typeof communicationScore === 'number') feedback.communication_score = communicationScore;

      await http(`/interviews/${id}`, {
        method: 'PATCH',
        body: {
          overall_score: overallScore,
          recommendation,
          notes: notes || null,
          feedback,
        },
        signal,
        schema: passthrough(),
      });

      await http(`/interviews/${id}/complete`, {
        method: 'POST',
        signal,
        schema: passthrough(),
      });
    },
    onSuccess: () => {
      void client.invalidate({ predicate: isInterviewKey });
    },
  });
}

export function useCancelInterview() {
  const client = useQueryClient();

  return useMutation<number, void>({
    mutationFn: async (id, { signal }) => {
      await http(`/interviews/${id}/cancel`, {
        method: 'POST',
        signal,
        schema: passthrough(),
      });
    },
    onSuccess: () => {
      void client.invalidate({ predicate: isInterviewKey });
    },
  });
}
