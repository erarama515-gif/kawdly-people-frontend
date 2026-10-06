import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { jobPostingApi } from './client';
import { jobPostingKeys } from './resource';
import type { JobPostingInput, JobPostingListParams, JobPostingUpdateInput } from './resource';
import type { JobPostingListWire, JobPostingWire } from './schema';

/**
 * The Recruitment module's job-postings data hooks — the only place components
 * talk to the API. Mirrors the Employees feature's `queries.ts`: each hook
 * owns its cache key and mutation strategy, and every mutation reconciles the
 * cache itself so `RecruitmentPage` never writes to the query store by hand.
 */

export interface JobPostingListData {
  state: QueryState<JobPostingListWire>;
  refetch: () => void;
}

export function useJobPostingList(params: JobPostingListParams): JobPostingListData {
  const { state, refetch } = useQuery<JobPostingListWire>({
    queryKey: jobPostingKeys.list(params),
    queryFn: (context) => jobPostingApi.list(context, params),
    staleTime: 15_000,
  });

  return { state, refetch };
}

/** True for any cached key under this module, list or single-item alike. */
function isJobPostingKey(key: readonly unknown[]): boolean {
  return key[0] === 'job-postings';
}

/** Creates a job posting, then invalidates every cached list so the new row shows up. */
export function useCreateJobPosting() {
  const client = useQueryClient();

  return useMutation<JobPostingInput, JobPostingWire>({
    mutationFn: (input, { signal }) => jobPostingApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isJobPostingKey });
    },
  });
}

export interface UpdateJobPostingInput extends JobPostingUpdateInput {
  id: number;
}

/** Updates a job posting, then invalidates every cached list so edited fields show up immediately. */
export function useUpdateJobPosting() {
  const client = useQueryClient();

  return useMutation<UpdateJobPostingInput, JobPostingWire>({
    mutationFn: ({ id, ...input }, { signal }) => jobPostingApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isJobPostingKey });
    },
  });
}

/**
 * Deletes one job posting. Optimistic: the row disappears from the current
 * list immediately so the table feels instant; a failure restores the previous
 * snapshot and refetches, so the ledger can never drift from the server.
 */
export function useDeleteJobPosting(params: JobPostingListParams) {
  const client = useQueryClient();
  const key = jobPostingKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => jobPostingApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<JobPostingListWire>(key, (current) =>
        current
          ? {
              ...current,
              data: current.data.filter((posting) => posting.id !== id),
              meta: { ...current.meta, total: Math.max(0, current.meta.total - 1) },
            }
          : current,
      );
      return () => {
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate({ predicate: isJobPostingKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isJobPostingKey });
    },
  });
}
