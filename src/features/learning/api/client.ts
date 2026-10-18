import { env } from '@/config/env';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import {
  mockTrainingProgramApi,
  resetMockTrainingPrograms,
  setMockFailureRate,
  mockTrainingEnrollmentApi,
  resetMockTrainingEnrollments,
  mockLearningPathApi,
  resetMockLearningPaths,
  mockLearningPathStepApi,
  resetMockLearningPathSteps,
} from './mockApi';
import {
  trainingProgramEnvelopeDecoder,
  trainingProgramListDecoder,
  trainingEnrollmentEnvelopeDecoder,
  trainingEnrollmentListDecoder,
  learningPathEnvelopeDecoder,
  learningPathListDecoder,
  learningPathStepEnvelopeDecoder,
  learningPathStepListDecoder,
} from './schema';
import type {
  TrainingProgramApi,
  TrainingProgramInput,
  TrainingProgramListParams,
  TrainingProgramUpdateInput,
  TrainingEnrollmentApi,
  TrainingEnrollmentInput,
  TrainingEnrollmentListParams,
  TrainingEnrollmentUpdateInput,
  LearningPathApi,
  LearningPathInput,
  LearningPathListParams,
  LearningPathUpdateInput,
  LearningPathStepApi,
  LearningPathStepInput,
  LearningPathStepListParams,
  LearningPathStepUpdateInput,
} from './resource';

/**
 * Real HTTP implementation of `TrainingProgramApi`, pointed at
 * `/api/v1/training-programs` exactly as documented in the Laravel route list:
 *  - `index` returns the app's custom `{ data, meta }` pager
 *  - `show`/`store`/`update` return `{ data: <trainingProgram> }`
 *  - `destroy` returns 204 with an empty body
 *
 * Every response is decoded before it is returned, so a contract drift
 * becomes a typed `decode` error at the boundary instead of a silent
 * `undefined` three components deep.
 */

const BASE = '/training-programs';

export const httpTrainingProgramApi: TrainingProgramApi = {
  async list({ signal }, params) {
    const { data } = await http(BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        search: params.search || undefined,
        status: params.status,
        type: params.type,
      },
      signal,
      schema: trainingProgramListDecoder,
    });
    return requireData(data, 'GET /training-programs');
  },

  async create({ signal }, input) {
    const { data } = await http(BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: trainingProgramEnvelopeDecoder,
    });
    return requireData(data, 'POST /training-programs').data;
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: trainingProgramEnvelopeDecoder,
    });
    return requireData(data, `PATCH /training-programs/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

// ─── TrainingEnrollment ───────────────────────────────────────────────────────

const TRAINING_ENROLLMENT_BASE = '/training-enrollments';

export const httpTrainingEnrollmentApi: TrainingEnrollmentApi = {
  async list({ signal }, params) {
    const { data } = await http(TRAINING_ENROLLMENT_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        training_program_id: params.training_program_id,
        employee_id: params.employee_id,
        status: params.status,
      },
      signal,
      schema: trainingEnrollmentListDecoder,
    });
    return requireData(data, 'GET /training-enrollments');
  },

  async create({ signal }, input) {
    const { data } = await http(TRAINING_ENROLLMENT_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: trainingEnrollmentEnvelopeDecoder,
    });
    return requireData(data, 'POST /training-enrollments').data;
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${TRAINING_ENROLLMENT_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: trainingEnrollmentEnvelopeDecoder,
    });
    return requireData(data, `PATCH /training-enrollments/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${TRAINING_ENROLLMENT_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

// ─── LearningPath ─────────────────────────────────────────────────────────────

const LEARNING_PATH_BASE = '/learning-paths';

export const httpLearningPathApi: LearningPathApi = {
  async list({ signal }, params) {
    const { data } = await http(LEARNING_PATH_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        from_position_id: params.from_position_id,
        to_position_id: params.to_position_id,
      },
      signal,
      schema: learningPathListDecoder,
    });
    return requireData(data, 'GET /learning-paths');
  },

  async create({ signal }, input) {
    const { data } = await http(LEARNING_PATH_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: learningPathEnvelopeDecoder,
    });
    return requireData(data, 'POST /learning-paths').data;
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${LEARNING_PATH_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: learningPathEnvelopeDecoder,
    });
    return requireData(data, `PATCH /learning-paths/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${LEARNING_PATH_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

// ─── LearningPathStep ─────────────────────────────────────────────────────────

const LEARNING_PATH_STEP_BASE = '/learning-path-steps';

export const httpLearningPathStepApi: LearningPathStepApi = {
  async list({ signal }, params) {
    const { data } = await http(LEARNING_PATH_STEP_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        learning_path_id: params.learning_path_id,
        type: params.type,
        is_required: params.is_required,
      },
      signal,
      schema: learningPathStepListDecoder,
    });
    return requireData(data, 'GET /learning-path-steps');
  },

  async create({ signal }, input) {
    const { data } = await http(LEARNING_PATH_STEP_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: learningPathStepEnvelopeDecoder,
    });
    return requireData(data, 'POST /learning-path-steps').data;
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${LEARNING_PATH_STEP_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: learningPathStepEnvelopeDecoder,
    });
    return requireData(data, `PATCH /learning-path-steps/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${LEARNING_PATH_STEP_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

function requireData<T>(data: T | undefined, endpoint: string): T {
  if (data === undefined) throw new Error(`${endpoint} returned an empty body`);
  return data;
}

/**
 * Chooses the transport once per app, exactly like the Employees/Attendance/
 * Contracts features: mock is the default whenever no API base URL is
 * configured, so the Learning page is fully interactive before the Laravel
 * backend is wired up, and a build pointed at a real backend switches with
 * no code change.
 */
export const trainingProgramApi: TrainingProgramApi =
  env.useMockApi ? mockTrainingProgramApi : httpTrainingProgramApi;
export const trainingEnrollmentApi: TrainingEnrollmentApi =
  env.useMockApi ? mockTrainingEnrollmentApi : httpTrainingEnrollmentApi;
export const learningPathApi: LearningPathApi =
  env.useMockApi ? mockLearningPathApi : httpLearningPathApi;
export const learningPathStepApi: LearningPathStepApi =
  env.useMockApi ? mockLearningPathStepApi : httpLearningPathStepApi;

if (env.isDev && env.useMockApi) {
  // Review affordance for loading/error/rollback states:
  //   __trainingProgramMock.setFailureRate(1)  // force every request to fail
  //   __trainingProgramMock.reset()            // restore seed data
  Object.defineProperty(window, '__trainingProgramMock', {
    value: {
      setFailureRate: setMockFailureRate,
      reset: resetMockTrainingPrograms,
    },
    configurable: true,
  });
  Object.defineProperty(window, '__trainingEnrollmentMock', {
    value: { reset: resetMockTrainingEnrollments },
    configurable: true,
  });
  Object.defineProperty(window, '__learningPathMock', {
    value: { reset: resetMockLearningPaths },
    configurable: true,
  });
  Object.defineProperty(window, '__learningPathStepMock', {
    value: { reset: resetMockLearningPathSteps },
    configurable: true,
  });
}

export type { TrainingProgramInput, TrainingProgramUpdateInput, TrainingProgramListParams };
export type {
  TrainingEnrollmentInput,
  TrainingEnrollmentUpdateInput,
  TrainingEnrollmentListParams,
  LearningPathInput,
  LearningPathUpdateInput,
  LearningPathListParams,
  LearningPathStepInput,
  LearningPathStepUpdateInput,
  LearningPathStepListParams,
};
