import type { FetchContext, QueryKey } from '@/lib/query';
import type { TrainingProgramListWire, TrainingProgramWire } from './schema';

/**
 * The Learning module's remote resource contract — TrainingProgram only.
 *
 * Components never call this directly — they go through the query hooks in
 * `queries.ts`. Two implementations satisfy it: `httpTrainingProgramApi` (real
 * Laravel endpoints under `/api/v1/training-programs`) and
 * `mockTrainingProgramApi` (in-process, the default until a backend is
 * configured). Mirrors the Attendance/Contracts feature's exact `api/` pattern.
 *
 * Out of scope: TrainingEnrollment, LearningPath, LearningPathStep —
 * see follow-up tasks.
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
 * `company_id` is hardcoded to `1` as a placeholder until auth is wired —
 * same approach as `EmployeeInput`/`ContractInput`.
 */
export interface TrainingProgramInput {
  company_id: number;
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
