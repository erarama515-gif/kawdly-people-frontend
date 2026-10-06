import { array, literalUnion, num, object, optional, str } from '@/lib/api/decode';

/**
 * Wire schemas for the Career module — three resources:
 *   1. CareerPath       (/api/v1/career-paths)
 *   2. CareerPathLevel  (/api/v1/career-path-levels)
 *   3. SuccessionPlan   (/api/v1/succession-plans)
 *
 * Field names match Laravel DB columns verbatim (snake_case). The `index`
 * envelope is the app's custom `{ data, meta }` pager.
 *
 * NOTE: CareerPath has no `description` field on the real backend.
 * NOTE: SuccessionPlan is ONE row per successor (one-to-one with successor_id),
 *       NOT the mock's nested successors array.
 * NOTE: CareerPathLevel `required_competencies` and `required_certifications`
 *       are cast as `array` on the backend (JSON columns); the wire type is
 *       `string[] | undefined`.
 */

// ─── CareerPath ───────────────────────────────────────────────────────────────

export const careerPathDecoder = object({
  id: num(),
  company_id: num(),
  name: str(),
  job_family: optional(str()),
  created_at: optional(str()),
  updated_at: optional(str()),
});

export type CareerPathWire = ReturnType<typeof careerPathDecoder.decode>;

export const pageMetaDecoder = object({
  current_page: num(),
  per_page: num(),
  total: num(),
  last_page: num(),
});

export type PageMetaWire = ReturnType<typeof pageMetaDecoder.decode>;

export const careerPathListDecoder = object({
  data: array(careerPathDecoder),
  meta: pageMetaDecoder,
});

export type CareerPathListWire = ReturnType<typeof careerPathListDecoder.decode>;

export const careerPathEnvelopeDecoder = object({ data: careerPathDecoder });
export type CareerPathEnvelopeWire = ReturnType<typeof careerPathEnvelopeDecoder.decode>;

// ─── CareerPathLevel ──────────────────────────────────────────────────────────

/** Minimal career-path ref embedded when `include=careerPath` is passed. */
const careerPathRefDecoder = object({
  id: num(),
  name: str(),
  job_family: optional(str()),
});

/** Minimal job-position ref embedded when `include=jobPosition` is passed. */
const levelJobPositionRefDecoder = object({
  id: num(),
  title: str(),
});

export const careerPathLevelDecoder = object({
  id: num(),
  career_path_id: num(),
  job_position_id: num(),
  level_order: optional(num()),
  min_experience_years: optional(num()),
  required_competencies: optional(array(str())),
  required_certifications: optional(array(str())),
  created_at: optional(str()),
  updated_at: optional(str()),
  /** Eager-loaded via `include=careerPath`. */
  career_path: optional(careerPathRefDecoder),
  /** Eager-loaded via `include=jobPosition`. */
  job_position: optional(levelJobPositionRefDecoder),
});

export type CareerPathLevelWire = ReturnType<typeof careerPathLevelDecoder.decode>;

export const careerPathLevelListDecoder = object({
  data: array(careerPathLevelDecoder),
  meta: pageMetaDecoder,
});

export type CareerPathLevelListWire = ReturnType<typeof careerPathLevelListDecoder.decode>;

export const careerPathLevelEnvelopeDecoder = object({ data: careerPathLevelDecoder });
export type CareerPathLevelEnvelopeWire = ReturnType<typeof careerPathLevelEnvelopeDecoder.decode>;

// ─── SuccessionPlan ───────────────────────────────────────────────────────────

export const successionReadinessDecoder = literalUnion([
  'ready_now',
  'ready_1_year',
  'ready_2_years',
  'development_needed',
] as const);

/** Minimal employee ref embedded when `include=successor,currentHolder` is passed. */
const employeeRefDecoder = object({
  id: num(),
  employee_number: str(),
  first_name: str(),
  last_name: str(),
  photo: optional(str()),
});

/** Minimal job position ref embedded when `include=jobPosition` is passed. */
const jobPositionRefDecoder = object({
  id: num(),
  title: str(),
});

export const successionPlanDecoder = object({
  id: num(),
  job_position_id: num(),
  current_holder_id: optional(num()),
  successor_id: num(),
  readiness: successionReadinessDecoder,
  readiness_score: optional(num()),
  development_plan: optional(str()),
  notes: optional(str()),
  updated_by: num(),
  created_at: optional(str()),
  updated_at: optional(str()),
  /** Eager-loaded via `include=jobPosition`. */
  job_position: optional(jobPositionRefDecoder),
  /** Eager-loaded via `include=currentHolder`. */
  current_holder: optional(employeeRefDecoder),
  /** Eager-loaded via `include=successor`. */
  successor: optional(employeeRefDecoder),
});

export type SuccessionPlanWire = ReturnType<typeof successionPlanDecoder.decode>;

export const successionPlanListDecoder = object({
  data: array(successionPlanDecoder),
  meta: pageMetaDecoder,
});

export type SuccessionPlanListWire = ReturnType<typeof successionPlanListDecoder.decode>;

export const successionPlanEnvelopeDecoder = object({ data: successionPlanDecoder });
export type SuccessionPlanEnvelopeWire = ReturnType<typeof successionPlanEnvelopeDecoder.decode>;
