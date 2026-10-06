import type { FetchContext, QueryKey } from '@/lib/query';
import type {
  PerformanceCycleListWire,
  PerformanceCycleWire,
  PerformanceReviewListWire,
  PerformanceReviewWire,
} from './schema';

/**
 * The Performance module's remote resource contract for TWO resources:
 *   1. PerformanceCycle  — /api/v1/performance-cycles
 *   2. PerformanceReview — /api/v1/performance-reviews
 *
 * Components never call these directly — they go through the query hooks in
 * `queries.ts`. Each resource has an HTTP implementation and a mock, with mock
 * as the active default.
 *
 * Fields verified against:
 *   - StorePerformanceCycleRequest:
 *       company_id (req int), name (req str max:255),
 *       type (req enum: quarterly|semi_annual|annual),
 *       start_date (req date), end_date (req date),
 *       self_review_deadline (req date), manager_review_deadline (req date),
 *       status (nullable enum: draft|active|in_review|completed)
 *
 *   - StorePerformanceReviewRequest:
 *       cycle_id (req int), employee_id (req int), reviewer_id (req int),
 *       review_type (req enum: self|manager|peer|direct_report),
 *       overall_rating (nullable numeric min:0 max:999.9),
 *       strengths (nullable str), improvements (nullable str),
 *       comments (nullable str),
 *       status (nullable enum: pending|in_progress|submitted|acknowledged),
 *       submitted_at (nullable date)
 *
 * Known mock mismatches fixed:
 *   - Old ReviewCycle.period/deadline → format client-side from real date fields.
 *   - Old completionPercent is NOT a real column — computed from meta.total queries.
 *   - Old status 'closed' does not exist; real enum: draft|active|in_review|completed.
 *   - Old department column doesn't exist; resolved via employee relation.
 *   - Old selfRating/managerRating pivot row → one row per PerformanceReview record.
 *   - Old EmployeeReview.status 'completed' is not a real value.
 */

// ─── PerformanceCycle ─────────────────────────────────────────────────────────

export type PerformanceCycleType = 'quarterly' | 'semi_annual' | 'annual';
export type PerformanceCycleStatus = 'draft' | 'active' | 'in_review' | 'completed';

export interface PerformanceCycleListParams {
  page?: number;
  perPage?: number;
  status?: PerformanceCycleStatus | undefined;
}

/** Shape of `StorePerformanceCycleRequest`'s validated fields. */
export interface PerformanceCycleInput {
  /** Hardcoded to 1 as placeholder until auth context is wired. */
  company_id: number;
  name: string;
  type: PerformanceCycleType;
  start_date: string;
  end_date: string;
  self_review_deadline: string;
  manager_review_deadline: string;
  status?: PerformanceCycleStatus | null;
}

/** `UpdatePerformanceCycleRequest` wraps fields in `sometimes` — any subset is valid. */
export type PerformanceCycleUpdateInput = Partial<PerformanceCycleInput>;

export interface PerformanceCycleApi {
  list(context: FetchContext, params: PerformanceCycleListParams): Promise<PerformanceCycleListWire>;
  create(context: FetchContext, input: PerformanceCycleInput): Promise<PerformanceCycleWire>;
  update(context: FetchContext, id: number, input: PerformanceCycleUpdateInput): Promise<PerformanceCycleWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

export const performanceCycleKeys = {
  all: ['performance-cycles'] as const satisfies QueryKey,
  list: (params: PerformanceCycleListParams) =>
    ['performance-cycles', 'list', params] as const satisfies QueryKey,
};

// ─── PerformanceReview ────────────────────────────────────────────────────────

export type PerformanceReviewType = 'self' | 'manager' | 'peer' | 'direct_report';
export type PerformanceReviewStatus = 'pending' | 'in_progress' | 'submitted' | 'acknowledged';

/**
 * Filtering: the PerformanceReviewController exposes `cycle_id`, `employee_id`,
 * `reviewer_id`, `review_type`, and `status` as filterable params
 * (verified from `protected array $filterable`).
 * `cycle_id` is used to scope the table to the selected cycle.
 */
export interface PerformanceReviewListParams {
  page?: number;
  perPage?: number;
  cycle_id?: number | undefined;
  review_type?: PerformanceReviewType | undefined;
  status?: PerformanceReviewStatus | undefined;
}

/** Shape of `StorePerformanceReviewRequest`'s validated fields. */
export interface PerformanceReviewInput {
  cycle_id: number;
  employee_id: number;
  reviewer_id: number;
  review_type: PerformanceReviewType;
  overall_rating?: number | null;
  strengths?: string | null;
  improvements?: string | null;
  comments?: string | null;
  status?: PerformanceReviewStatus | null;
  submitted_at?: string | null;
}

/** `UpdatePerformanceReviewRequest` wraps fields in `sometimes` — any subset is valid. */
export type PerformanceReviewUpdateInput = Partial<PerformanceReviewInput>;

export interface PerformanceReviewApi {
  list(context: FetchContext, params: PerformanceReviewListParams): Promise<PerformanceReviewListWire>;
  create(context: FetchContext, input: PerformanceReviewInput): Promise<PerformanceReviewWire>;
  update(context: FetchContext, id: number, input: PerformanceReviewUpdateInput): Promise<PerformanceReviewWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

export const performanceReviewKeys = {
  all: ['performance-reviews'] as const satisfies QueryKey,
  list: (params: PerformanceReviewListParams) =>
    ['performance-reviews', 'list', params] as const satisfies QueryKey,
};
