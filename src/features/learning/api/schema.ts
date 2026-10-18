import { array, bool, isoDate, literalUnion, num, object, optional, str } from '@/lib/api/decode';

/**
 * Wire schemas for the Learning / TrainingProgram module, matching the real
 * Laravel contract exactly: field names are the DB columns verbatim
 * (snake_case), and the `index` envelope is the app's custom `{ data, meta }`
 * pager.
 *
 * `duration_hours` is cast to `decimal:1` by the model — the API returns it
 * as a string ("4.0") so we decode it as `str()` (same pattern as
 * `regular_hours` in the Attendance module).
 *
 * Status enum: `planned | ongoing | completed | cancelled` — the old mock's
 * `active | scheduled | draft` are not real backend values and are dropped here.
 */

export const trainingProgramStatusDecoder = literalUnion([
  'planned',
  'ongoing',
  'completed',
  'cancelled',
] as const);

export const trainingProgramTypeDecoder = literalUnion([
  'internal',
  'external',
  'online',
] as const);

export const trainingProgramDecoder = object({
  id: num(),
  company_id: num(),
  title: str(),
  description: optional(str()),
  category: optional(str()),
  type: trainingProgramTypeDecoder,
  /** Plain name string — no employee FK, no initials/photo columns. */
  trainer_name: optional(str()),
  /** decimal:1 cast → returned as a string by the API, e.g. "4.0". */
  duration_hours: optional(str()),
  cost: optional(num()),
  max_participants: optional(num()),
  start_date: isoDate(),
  end_date: isoDate(),
  location: optional(str()),
  status: optional(trainingProgramStatusDecoder),
  created_at: optional(str()),
  updated_at: optional(str()),
});

export type TrainingProgramWire = ReturnType<typeof trainingProgramDecoder.decode>;

export const pageMetaDecoder = object({
  current_page: num(),
  per_page: num(),
  total: num(),
  last_page: num(),
});

export type PageMetaWire = ReturnType<typeof pageMetaDecoder.decode>;

export const trainingProgramListDecoder = object({
  data: array(trainingProgramDecoder),
  meta: pageMetaDecoder,
});

export type TrainingProgramListWire = ReturnType<typeof trainingProgramListDecoder.decode>;

export const trainingProgramEnvelopeDecoder = object({ data: trainingProgramDecoder });
export type TrainingProgramEnvelopeWire = ReturnType<typeof trainingProgramEnvelopeDecoder.decode>;

// ─── TrainingEnrollment ───────────────────────────────────────────────────────

export const trainingEnrollmentStatusDecoder = literalUnion([
  'enrolled',
  'attended',
  'completed',
  'no_show',
  'cancelled',
] as const);

/** Minimal employee ref embedded when `include=employee` is passed. */
const enrollmentEmployeeRefDecoder = object({
  id: num(),
  employee_number: str(),
  first_name: str(),
  last_name: str(),
  photo: optional(str()),
});

/** Minimal training-program ref embedded when `include=trainingProgram` is passed. */
const trainingProgramRefDecoder = object({
  id: num(),
  title: str(),
});

export const trainingEnrollmentDecoder = object({
  id: num(),
  training_program_id: num(),
  employee_id: num(),
  status: optional(trainingEnrollmentStatusDecoder),
  /** decimal:2 cast → returned as a string by the API, e.g. "87.50". */
  score: optional(str()),
  certificate_path: optional(str()),
  feedback: optional(str()),
  feedback_rating: optional(num()),
  created_at: optional(str()),
  updated_at: optional(str()),
  /** Eager-loaded via `include=trainingProgram`. */
  trainingProgram: optional(trainingProgramRefDecoder),
  /** Eager-loaded via `include=employee`. */
  employee: optional(enrollmentEmployeeRefDecoder),
});

export type TrainingEnrollmentWire = ReturnType<typeof trainingEnrollmentDecoder.decode>;

export const trainingEnrollmentListDecoder = object({
  data: array(trainingEnrollmentDecoder),
  meta: pageMetaDecoder,
});

export type TrainingEnrollmentListWire = ReturnType<typeof trainingEnrollmentListDecoder.decode>;

export const trainingEnrollmentEnvelopeDecoder = object({ data: trainingEnrollmentDecoder });
export type TrainingEnrollmentEnvelopeWire = ReturnType<typeof trainingEnrollmentEnvelopeDecoder.decode>;

// ─── LearningPath ─────────────────────────────────────────────────────────────

/** Minimal job-position ref embedded when `include=fromPosition|toPosition` is passed. */
const positionRefDecoder = object({
  id: num(),
  title: str(),
});

export const learningPathDecoder = object({
  id: num(),
  company_id: num(),
  name: str(),
  description: optional(str()),
  from_position_id: optional(num()),
  to_position_id: optional(num()),
  created_at: optional(str()),
  updated_at: optional(str()),
  /** Eager-loaded via `include=fromPosition`. */
  fromPosition: optional(positionRefDecoder),
  /** Eager-loaded via `include=toPosition`. */
  toPosition: optional(positionRefDecoder),
});

export type LearningPathWire = ReturnType<typeof learningPathDecoder.decode>;

export const learningPathListDecoder = object({
  data: array(learningPathDecoder),
  meta: pageMetaDecoder,
});

export type LearningPathListWire = ReturnType<typeof learningPathListDecoder.decode>;

export const learningPathEnvelopeDecoder = object({ data: learningPathDecoder });
export type LearningPathEnvelopeWire = ReturnType<typeof learningPathEnvelopeDecoder.decode>;

// ─── LearningPathStep ─────────────────────────────────────────────────────────

export const learningPathStepTypeDecoder = literalUnion([
  'training',
  'certification',
  'experience',
  'competency',
] as const);

export const learningPathStepDecoder = object({
  id: num(),
  learning_path_id: num(),
  title: str(),
  description: optional(str()),
  type: learningPathStepTypeDecoder,
  /** No DB-level FK; loosely a training_program id when type === 'training'. */
  reference_id: optional(num()),
  sort_order: optional(num()),
  is_required: optional(bool()),
  created_at: optional(str()),
  updated_at: optional(str()),
});

export type LearningPathStepWire = ReturnType<typeof learningPathStepDecoder.decode>;

export const learningPathStepListDecoder = object({
  data: array(learningPathStepDecoder),
  meta: pageMetaDecoder,
});

export type LearningPathStepListWire = ReturnType<typeof learningPathStepListDecoder.decode>;

export const learningPathStepEnvelopeDecoder = object({ data: learningPathStepDecoder });
export type LearningPathStepEnvelopeWire = ReturnType<typeof learningPathStepEnvelopeDecoder.decode>;
