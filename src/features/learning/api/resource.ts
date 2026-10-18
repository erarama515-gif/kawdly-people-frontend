import type { FetchContext, QueryKey } from '@/lib/query';
import type {
  TrainingProgramListWire,
  TrainingProgramWire,
  TrainingEnrollmentListWire,
  TrainingEnrollmentWire,
  LearningPathListWire,
  LearningPathWire,
  LearningPathStepListWire,
  LearningPathStepWire,
} from './schema';

/**
 * The Learning module's remote resource contract — TrainingProgram,
 * TrainingEnrollment, LearningPath, and LearningPathStep.
 *
 * Components never call this directly — they go through the query hooks in
 * `queries.ts`. Two implementations satisfy each: `http*Api` (real Laravel
 * endpoints under `/api/v1/...`) and `mock*Api` (in-process, the default
 * until a backend is configured). Mirrors the Attendance/Contracts feature's
 * exact `api/` pattern.
 */

/**
 * Real backend values from `StoreTrainingProgramRequest`.
 * The old UI mock used `active|scheduled|draft` — those are gone.
 */
export type TrainingProgramStatus = 'planned' | 'ongoing' | 'completed' | 'cancelled';

export type TrainingProgramType = 'internal' | 'external' | 'online';

export interface TrainingProgramListParams {
  page?: number;
  perPage?: number;
  search?: string | undefined;
  status?: TrainingProgramStatus | undefined;
  type?: TrainingProgramType | undefined;
}

/**
 * Shape of `StoreTrainingProgramRequest`'s validated fields.
 * Field names match Laravel column names verbatim (snake_case).
 */
export interface TrainingProgramInput {
  /** Injected by the backend's auth middleware; omit from form payloads. */
  company_id?: number;
  title: string;
  description?: string | null;
  category?: string | null;
  type: TrainingProgramType;
  /** Plain trainer name string — NOT an employee FK. No initials/photo columns exist. */
  trainer_name?: string | null;
  duration_hours?: number | null;
  cost?: number | null;
  max_participants?: number | null;
  start_date: string;
  end_date: string;
  location?: string | null;
  status?: TrainingProgramStatus | null;
}

/** `UpdateTrainingProgramRequest` wraps fields in `sometimes` — any subset is valid. */
export type TrainingProgramUpdateInput = Partial<TrainingProgramInput>;

export interface TrainingProgramApi {
  list(context: FetchContext, params: TrainingProgramListParams): Promise<TrainingProgramListWire>;
  create(context: FetchContext, input: TrainingProgramInput): Promise<TrainingProgramWire>;
  update(context: FetchContext, id: number, input: TrainingProgramUpdateInput): Promise<TrainingProgramWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

/** Cache keys. Every training-program read hangs off `all` so invalidation after a write is total. */
export const trainingProgramKeys = {
  all: ['trainingPrograms'] as const satisfies QueryKey,
  list: (params: TrainingProgramListParams) =>
    ['trainingPrograms', 'list', params] as const satisfies QueryKey,
};

// ─── TrainingEnrollment ───────────────────────────────────────────────────────

/** Real backend values from `StoreTrainingEnrollmentRequest`'s `status` rule. */
export type TrainingEnrollmentStatus = 'enrolled' | 'attended' | 'completed' | 'no_show' | 'cancelled';

export interface TrainingEnrollmentListParams {
  page?: number;
  perPage?: number;
  training_program_id?: number | undefined;
  employee_id?: number | undefined;
  status?: TrainingEnrollmentStatus | undefined;
}

/** Shape of `StoreTrainingEnrollmentRequest`'s validated fields. */
export interface TrainingEnrollmentInput {
  training_program_id: number;
  employee_id: number;
  status?: TrainingEnrollmentStatus | null;
  score?: number | null;
  certificate_path?: string | null;
  feedback?: string | null;
  feedback_rating?: number | null;
}

/** `UpdateTrainingEnrollmentRequest` wraps FK fields in `sometimes`; any subset is valid. */
export type TrainingEnrollmentUpdateInput = Partial<TrainingEnrollmentInput>;

export interface TrainingEnrollmentApi {
  list(context: FetchContext, params: TrainingEnrollmentListParams): Promise<TrainingEnrollmentListWire>;
  create(context: FetchContext, input: TrainingEnrollmentInput): Promise<TrainingEnrollmentWire>;
  update(
    context: FetchContext,
    id: number,
    input: TrainingEnrollmentUpdateInput,
  ): Promise<TrainingEnrollmentWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

export const trainingEnrollmentKeys = {
  all: ['trainingEnrollments'] as const satisfies QueryKey,
  list: (params: TrainingEnrollmentListParams) =>
    ['trainingEnrollments', 'list', params] as const satisfies QueryKey,
};

// ─── LearningPath ─────────────────────────────────────────────────────────────

export interface LearningPathListParams {
  page?: number;
  perPage?: number;
  from_position_id?: number | undefined;
  to_position_id?: number | undefined;
}

/** Shape of `StoreLearningPathRequest`'s validated fields. */
export interface LearningPathInput {
  /** Injected by the backend's `InjectCompanyId` middleware; omit from form payloads. */
  company_id?: number;
  name: string;
  description?: string | null;
  from_position_id?: number | null;
  to_position_id?: number | null;
}

export type LearningPathUpdateInput = Partial<LearningPathInput>;

export interface LearningPathApi {
  list(context: FetchContext, params: LearningPathListParams): Promise<LearningPathListWire>;
  create(context: FetchContext, input: LearningPathInput): Promise<LearningPathWire>;
  update(context: FetchContext, id: number, input: LearningPathUpdateInput): Promise<LearningPathWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

export const learningPathKeys = {
  all: ['learningPaths'] as const satisfies QueryKey,
  list: (params: LearningPathListParams) =>
    ['learningPaths', 'list', params] as const satisfies QueryKey,
};

// ─── LearningPathStep ─────────────────────────────────────────────────────────

/** Real backend values from `StoreLearningPathStepRequest`'s `type` rule. */
export type LearningPathStepType = 'training' | 'certification' | 'experience' | 'competency';

export interface LearningPathStepListParams {
  page?: number;
  perPage?: number;
  learning_path_id?: number | undefined;
  type?: LearningPathStepType | undefined;
  is_required?: boolean | undefined;
}

/**
 * Shape of `StoreLearningPathStepRequest`'s validated fields.
 * `reference_id` has no DB-level FK — per `LearningCareerPlatformSeeder`, it
 * loosely references a `training_program` id when `type === 'training'` and
 * is left null for every other step type.
 */
export interface LearningPathStepInput {
  learning_path_id: number;
  title: string;
  description?: string | null;
  type: LearningPathStepType;
  reference_id?: number | null;
  sort_order?: number | null;
  is_required?: boolean | null;
}

export type LearningPathStepUpdateInput = Partial<LearningPathStepInput>;

export interface LearningPathStepApi {
  list(context: FetchContext, params: LearningPathStepListParams): Promise<LearningPathStepListWire>;
  create(context: FetchContext, input: LearningPathStepInput): Promise<LearningPathStepWire>;
  update(
    context: FetchContext,
    id: number,
    input: LearningPathStepUpdateInput,
  ): Promise<LearningPathStepWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

export const learningPathStepKeys = {
  all: ['learningPathSteps'] as const satisfies QueryKey,
  list: (params: LearningPathStepListParams) =>
    ['learningPathSteps', 'list', params] as const satisfies QueryKey,
};
