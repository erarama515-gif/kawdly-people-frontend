import type { FetchContext, QueryKey } from '@/lib/query';
import type {
  CareerPathListWire,
  CareerPathWire,
  CareerPathLevelListWire,
  CareerPathLevelWire,
  SuccessionPlanListWire,
  SuccessionPlanWire,
} from './schema';

/**
 * The Career module's remote resource contract for THREE resources:
 *   1. CareerPath       — /api/v1/career-paths
 *   2. CareerPathLevel  — /api/v1/career-path-levels
 *   3. SuccessionPlan   — /api/v1/succession-plans
 *
 * Components never call these directly — they go through the query hooks in
 * `queries.ts`. Each resource has an HTTP implementation and a mock, with mock
 * as the active default.
 *
 * Fields verified against:
 *   - StoreCareerPathRequest:   company_id (req int), name (req str max:255), job_family (nullable str max:100)
 *   - StoreCareerPathLevelRequest: career_path_id (req int), job_position_id (req int),
 *       level_order (nullable int ≥0), min_experience_years (nullable int ≥0),
 *       required_competencies (req array), required_certifications (nullable array)
 *   - StoreSuccessionPlanRequest: job_position_id (req int), current_holder_id (nullable int),
 *       successor_id (req int), readiness (req enum), readiness_score (nullable numeric 0-100),
 *       development_plan (nullable str), notes (nullable str),
 *       updated_by (req int — authenticated user id; overwritten server-side)
 *
 * No `description` field exists on CareerPath — the old mock fabricated it; it is dropped.
 */

// ─── CareerPath ───────────────────────────────────────────────────────────────

export interface CareerPathListParams {
  page?: number;
  perPage?: number;
  search?: string | undefined;
}

/** Shape of `StoreCareerPathRequest`'s validated fields. */
export interface CareerPathInput {
  /** Injected by the backend's auth middleware; omit from form payloads. */
  company_id?: number;
  name: string;
  job_family?: string | null;
}

/** `UpdateCareerPathRequest` wraps the same fields in `sometimes` — any subset is valid. */
export type CareerPathUpdateInput = Partial<CareerPathInput>;

export interface CareerPathApi {
  list(context: FetchContext, params: CareerPathListParams): Promise<CareerPathListWire>;
  create(context: FetchContext, input: CareerPathInput): Promise<CareerPathWire>;
  update(context: FetchContext, id: number, input: CareerPathUpdateInput): Promise<CareerPathWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

export const careerPathKeys = {
  all: ['career-paths'] as const satisfies QueryKey,
  list: (params: CareerPathListParams) => ['career-paths', 'list', params] as const satisfies QueryKey,
};

// ─── SuccessionPlan ───────────────────────────────────────────────────────────

/**
 * Real backend enum values from StoreSuccessionPlanRequest:
 *   ready_now | ready_1_year | ready_2_years | development_needed
 *
 * The old mock used 'Ready Now' | '1-2 Years' | '3+ Years' — those are gone.
 */
export type SuccessionReadiness = 'ready_now' | 'ready_1_year' | 'ready_2_years' | 'development_needed';

export interface SuccessionPlanListParams {
  page?: number;
  perPage?: number;
  search?: string | undefined;
  readiness?: SuccessionReadiness | undefined;
}

/** Shape of `StoreSuccessionPlanRequest`'s validated fields. */
export interface SuccessionPlanInput {
  job_position_id: number;
  current_holder_id?: number | null;
  successor_id: number;
  readiness: SuccessionReadiness;
  readiness_score?: number | null;
  development_plan?: string | null;
  notes?: string | null;
  /** Required by the backend; hardcoded to 1 as placeholder until auth context is wired. */
  updated_by: number;
}

/** `UpdateSuccessionPlanRequest` wraps fields in `sometimes` — any subset is valid. */
export type SuccessionPlanUpdateInput = Partial<SuccessionPlanInput>;

export interface SuccessionPlanApi {
  list(context: FetchContext, params: SuccessionPlanListParams): Promise<SuccessionPlanListWire>;
  create(context: FetchContext, input: SuccessionPlanInput): Promise<SuccessionPlanWire>;
  update(context: FetchContext, id: number, input: SuccessionPlanUpdateInput): Promise<SuccessionPlanWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

export const successionPlanKeys = {
  all: ['succession-plans'] as const satisfies QueryKey,
  list: (params: SuccessionPlanListParams) => ['succession-plans', 'list', params] as const satisfies QueryKey,
};

// ─── CareerPathLevel ──────────────────────────────────────────────────────────

/**
 * Filtering: the CareerPathLevelController exposes `career_path_id` as a
 * filterable param (verified from `protected array $filterable`), so the
 * backend accepts `?career_path_id=<n>` on the index endpoint.
 *
 * `required_competencies` and `required_certifications` are stored as JSON
 * arrays in the DB.  The form collects them as comma-separated strings and
 * the `toCareerPathLevelInput()` converter splits them into arrays before
 * sending to the API.
 */
export interface CareerPathLevelListParams {
  page?: number;
  perPage?: number;
  search?: string | undefined;
  career_path_id?: number | undefined;
}

/** Shape of `StoreCareerPathLevelRequest`'s validated fields. */
export interface CareerPathLevelInput {
  career_path_id: number;
  job_position_id: number;
  level_order?: number | null;
  min_experience_years?: number | null;
  required_competencies: string[];
  required_certifications?: string[] | null;
}

/** `UpdateCareerPathLevelRequest` wraps fields in `sometimes` — any subset is valid. */
export type CareerPathLevelUpdateInput = Partial<CareerPathLevelInput>;

export interface CareerPathLevelApi {
  list(context: FetchContext, params: CareerPathLevelListParams): Promise<CareerPathLevelListWire>;
  create(context: FetchContext, input: CareerPathLevelInput): Promise<CareerPathLevelWire>;
  update(context: FetchContext, id: number, input: CareerPathLevelUpdateInput): Promise<CareerPathLevelWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

export const careerPathLevelKeys = {
  all: ['career-path-levels'] as const satisfies QueryKey,
  list: (params: CareerPathLevelListParams) =>
    ['career-path-levels', 'list', params] as const satisfies QueryKey,
};
