import type { FetchContext, QueryKey } from '@/lib/query';
import type { JobPostingListWire, JobPostingWire } from './schema';

/**
 * The Recruitment module's job-postings remote resource contract.
 *
 * Components never call this directly — they go through the query hooks in
 * `queries.ts`. Two implementations satisfy it: `httpJobPostingApi` (real
 * Laravel endpoints under `/api/v1/job-postings`) and `mockJobPostingApi`
 * (in-process, the default until a backend is configured). Mirrors the
 * Employees feature's exact `api/` pattern.
 */

export type JobPostingEmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern';

/**
 * Synthetic status derived client-side from `is_published` + `expires_at`.
 *  - draft   : is_published = false
 *  - open    : is_published = true, expires_at is null or in the future
 *  - closed  : is_published = true, expires_at is in the past
 */
export type JobPostingStatus = 'open' | 'closed' | 'draft';

export interface JobPostingListParams {
  page?: number;
  perPage?: number;
  search?: string | undefined;
  /** Filter by synthetic status (mapped to is_published / expires_at on the real API). */
  status?: JobPostingStatus | undefined;
}

/** Shape of `StoreJobPostingRequest`'s validated fields. */
export interface JobPostingInput {
  job_requisition_id?: number | null;
  title: string;
  description: string;
  requirements?: string | null;
  skills: string[];
  experience_min?: number | null;
  experience_max?: number | null;
  education_level?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  location?: string | null;
  employment_type: JobPostingEmploymentType;
  is_internal?: boolean | null;
  is_published?: boolean | null;
  published_at?: string | null;
  expires_at?: string | null;
}

/** `UpdateJobPostingRequest` wraps the same fields in `sometimes` — any subset is valid. */
export type JobPostingUpdateInput = Partial<JobPostingInput>;

export interface JobPostingApi {
  list(context: FetchContext, params: JobPostingListParams): Promise<JobPostingListWire>;
  create(context: FetchContext, input: JobPostingInput): Promise<JobPostingWire>;
  update(context: FetchContext, id: number, input: JobPostingUpdateInput): Promise<JobPostingWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

/** Cache keys. Every job-postings read hangs off `all` so invalidation after a write is total. */
export const jobPostingKeys = {
  all: ['job-postings'] as const satisfies QueryKey,
  list: (params: JobPostingListParams) => ['job-postings', 'list', params] as const satisfies QueryKey,
};
