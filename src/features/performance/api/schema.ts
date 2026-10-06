import { array, literalUnion, num, object, optional, str } from '@/lib/api/decode';

/**
 * Wire schemas for the Performance module — two resources:
 *   1. PerformanceCycle  (/api/v1/performance-cycles)
 *   2. PerformanceReview (/api/v1/performance-reviews)
 *
 * Field names match Laravel DB columns verbatim (snake_case). The `index`
 * envelope uses the app's custom `{ data, meta }` pager — same shape as
 * every other module in this project.
 *
 * NOTE: PerformanceReview embeds `employee` and `reviewer` optional refs
 *       (available when `include=employee,reviewer` is requested), used to
 *       show avatar + name in the table without a second round-trip.
 *
 * NOTE: There is NO `department` column on PerformanceReview. The old mock
 *       fabricated it. Department must be resolved via the employee relation.
 *
 * NOTE: There is NO `selfRating`/`managerRating` pivot. The real backend stores
 *       ONE row per (cycle_id, employee_id, reviewer_id, review_type).
 */

// ─── Shared page meta ─────────────────────────────────────────────────────────

export const pageMetaDecoder = object({
  current_page: num(),
  per_page: num(),
  total: num(),
  last_page: num(),
});

export type PageMetaWire = ReturnType<typeof pageMetaDecoder.decode>;

// ─── PerformanceCycle ─────────────────────────────────────────────────────────

export const performanceCycleTypeDecoder = literalUnion([
  'quarterly',
  'semi_annual',
  'annual',
] as const);

export const performanceCycleStatusDecoder = literalUnion([
  'draft',
  'active',
  'in_review',
  'completed',
] as const);

export const performanceCycleDecoder = object({
  id: num(),
  company_id: num(),
  name: str(),
  type: performanceCycleTypeDecoder,
  start_date: str(),
  end_date: str(),
  self_review_deadline: str(),
  manager_review_deadline: str(),
  status: optional(performanceCycleStatusDecoder),
  created_at: optional(str()),
  updated_at: optional(str()),
});

export type PerformanceCycleWire = ReturnType<typeof performanceCycleDecoder.decode>;

export const performanceCycleListDecoder = object({
  data: array(performanceCycleDecoder),
  meta: pageMetaDecoder,
});

export type PerformanceCycleListWire = ReturnType<typeof performanceCycleListDecoder.decode>;

export const performanceCycleEnvelopeDecoder = object({ data: performanceCycleDecoder });
export type PerformanceCycleEnvelopeWire = ReturnType<typeof performanceCycleEnvelopeDecoder.decode>;

// ─── PerformanceReview ────────────────────────────────────────────────────────

export const performanceReviewTypeDecoder = literalUnion([
  'self',
  'manager',
  'peer',
  'direct_report',
] as const);

export const performanceReviewStatusDecoder = literalUnion([
  'pending',
  'in_progress',
  'submitted',
  'acknowledged',
] as const);

/**
 * Minimal employee ref embedded when `include=employee,reviewer` is passed.
 * Same shape as the ref in attendance/leave/career schema files.
 */
const employeeRefDecoder = object({
  id: num(),
  employee_number: str(),
  first_name: str(),
  last_name: str(),
  photo: optional(str()),
});

export type PerformanceReviewEmployeeRef = ReturnType<typeof employeeRefDecoder.decode>;

export const performanceReviewDecoder = object({
  id: num(),
  cycle_id: num(),
  employee_id: num(),
  reviewer_id: num(),
  review_type: performanceReviewTypeDecoder,
  overall_rating: optional(num()),
  strengths: optional(str()),
  improvements: optional(str()),
  comments: optional(str()),
  status: optional(performanceReviewStatusDecoder),
  submitted_at: optional(str()),
  created_at: optional(str()),
  updated_at: optional(str()),
  /** Eager-loaded via `include=employee`. */
  employee: optional(employeeRefDecoder),
  /** Eager-loaded via `include=reviewer`. */
  reviewer: optional(employeeRefDecoder),
});

export type PerformanceReviewWire = ReturnType<typeof performanceReviewDecoder.decode>;

export const performanceReviewListDecoder = object({
  data: array(performanceReviewDecoder),
  meta: pageMetaDecoder,
});

export type PerformanceReviewListWire = ReturnType<typeof performanceReviewListDecoder.decode>;

export const performanceReviewEnvelopeDecoder = object({ data: performanceReviewDecoder });
export type PerformanceReviewEnvelopeWire = ReturnType<typeof performanceReviewEnvelopeDecoder.decode>;
