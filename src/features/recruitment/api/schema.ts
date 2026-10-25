import {
  array,
  bool,
  literalUnion,
  num,
  object,
  optional,
  str,
} from '@/lib/api/decode';

/**
 * Wire schemas for the Recruitment module's job-postings resource, matching
 * the real Laravel contract exactly: `BaseResource::toArray()` returns the raw
 * Eloquent model so field names are DB columns verbatim (snake_case). The
 * `index` envelope is the app's custom `{ data, meta }` pager.
 *
 * `skills` is stored as a JSON column on the backend and cast to `array` by
 * Eloquent, so it arrives as a JSON array of strings on the wire.
 *
 * `status` is a synthetic client-side field (not a DB column): it is computed
 * from `is_published` and `expires_at` in `mockApi.ts` / `client.ts` so that
 * the rest of the UI can use a simple `'open' | 'closed' | 'draft'` value
 * everywhere instead of re-deriving booleans in every component.
 */

export const jobPostingEmploymentTypeDecoder = literalUnion([
  'full_time',
  'part_time',
  'contract',
  'intern',
] as const);

export const jobPostingStatusDecoder = literalUnion(['open', 'closed', 'draft'] as const);

export const jobPostingDecoder = object({
  id: num(),
  uuid: str(),
  job_requisition_id: optional(num()),
  title: str(),
  description: str(),
  requirements: optional(str()),
  skills: array(str()),
  experience_min: optional(num()),
  experience_max: optional(num()),
  education_level: optional(str()),
  salary_min: optional(num()),
  salary_max: optional(num()),
  location: optional(str()),
  employment_type: jobPostingEmploymentTypeDecoder,
  is_internal: bool(),
  is_published: bool(),
  published_at: optional(str()),
  expires_at: optional(str()),
  /** Synthetic — computed before decode, not a DB column. */
  status: jobPostingStatusDecoder,
  created_at: optional(str()),
  updated_at: optional(str()),
});

export type JobPostingWire = ReturnType<typeof jobPostingDecoder.decode>;

export const pageMetaDecoder = object({
  current_page: num(),
  per_page: num(),
  total: num(),
  last_page: num(),
});

export type PageMetaWire = ReturnType<typeof pageMetaDecoder.decode>;

export const jobPostingListDecoder = object({
  data: array(jobPostingDecoder),
  meta: pageMetaDecoder,
});

export type JobPostingListWire = ReturnType<typeof jobPostingListDecoder.decode>;

export const jobPostingEnvelopeDecoder = object({ data: jobPostingDecoder });
export type JobPostingEnvelopeWire = ReturnType<typeof jobPostingEnvelopeDecoder.decode>;
