import { ApiError } from '@/lib/api/errors';
import type { FetchContext } from '@/lib/query';
import {
  trainingProgramDecoder,
  trainingProgramListDecoder,
  trainingEnrollmentDecoder,
  trainingEnrollmentListDecoder,
  learningPathDecoder,
  learningPathListDecoder,
  learningPathStepDecoder,
  learningPathStepListDecoder,
} from './schema';
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
import type {
  TrainingProgramApi,
  TrainingProgramStatus,
  TrainingProgramType,
  TrainingEnrollmentApi,
  TrainingEnrollmentStatus,
  LearningPathApi,
  LearningPathStepApi,
  LearningPathStepType,
} from './resource';

/**
 * In-process implementation of `TrainingProgramApi`, used until the Laravel
 * backend is configured (the default — see `env.useMockApi`).
 *
 * Mirrors `contracts/api/mockApi.ts`: owns real mutable state so a create
 * or delete is a genuine write later reads observe, adds latency, honours
 * `AbortSignal`, and every response is re-decoded through the same decoders
 * a real HTTP response would go through, so both transports are
 * indistinguishable to the rest of the app.
 *
 * Status enum reflects the REAL backend: `planned | ongoing | completed |
 * cancelled` — the old mock's `active | scheduled | draft` are gone.
 *
 * `trainer_name` is a plain string; `trainerInitials`/`trainerPhoto` are
 * old mock-only fields that do not exist on the real model.
 *
 * `enrolled` / `EnrolledBar` are dropped because enrollment counts require
 * `TrainingEnrollment` CRUD which is out of scope for this task.
 */

interface StoredTrainingProgram {
  id: number;
  company_id: number;
  title: string;
  description?: string | undefined;
  category?: string | undefined;
  type: TrainingProgramType;
  trainer_name?: string | undefined;
  duration_hours?: string | undefined;
  cost?: number | undefined;
  max_participants?: number | undefined;
  start_date: string;
  end_date: string;
  location?: string | undefined;
  status?: TrainingProgramStatus | undefined;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}

const TYPES: TrainingProgramType[] = ['internal', 'external', 'online'];
const STATUSES: TrainingProgramStatus[] = ['planned', 'ongoing', 'completed', 'cancelled'];

const CATEGORIES = [
  'Management',
  'Technical',
  'Compliance',
  'Sales',
  'HR & People',
  'Finance',
  'Communication',
  'Leadership',
];

const TRAINER_NAMES = [
  'Layla Mostafa',
  'Ahmed Sami',
  'External – Coursera',
  'SafeWork Institute',
  'PMI Certified Trainer',
  'Mona Khaled',
  'Karim Fouad',
  'TalentBridge Academy',
  'Omar Hassan',
  'Nadia Fahmy',
];

const PROGRAM_TITLES = [
  'Leadership Essentials',
  'Advanced Excel & Data Analysis',
  'Workplace Safety Certification',
  'Customer Experience Workshop',
  'Project Management Professional',
  'Effective Communication Skills',
  'Data Privacy & Compliance',
  'Strategic Financial Planning',
  'HR Business Partner Fundamentals',
  'Python for Non-Developers',
  'Agile & Scrum Foundations',
  'Public Speaking & Presentations',
  'Talent Acquisition Masterclass',
  'Conflict Resolution Workshop',
  'Digital Marketing Essentials',
  'Supply Chain Management Basics',
  'Emotional Intelligence at Work',
  'Change Management Certification',
  'Business Writing Excellence',
  'Time Management & Productivity',
];

function generateFiller(count: number): StoredTrainingProgram[] {
  const rows: StoredTrainingProgram[] = [];
  for (let index = 0; index < count; index += 1) {
    const id = index + 1;
    const startYear = 2026;
    const startMonth = 8 + (index % 5); // Aug – Dec
    const startDay = 1 + (index % 28);
    const durationDays = 3 + (index % 14);
    const startDate = new Date(startYear, startMonth - 1, startDay);
    const endDate = new Date(startYear, startMonth - 1, startDay + durationDays);

    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    rows.push({
      id,
      company_id: 1,
      title: PROGRAM_TITLES[index % PROGRAM_TITLES.length],
      description: index % 3 !== 0
        ? `A focused ${durationDays}-day program covering core skills and best practices.`
        : undefined,
      category: CATEGORIES[index % CATEGORIES.length],
      type: TYPES[index % TYPES.length],
      trainer_name: TRAINER_NAMES[index % TRAINER_NAMES.length],
      duration_hours: `${(8 + (index % 6) * 4).toFixed(1)}`,
      cost: index % 4 === 0 ? undefined : (500 + index * 75),
      max_participants: 10 + (index % 5) * 5,
      start_date: fmt(startDate),
      end_date: fmt(endDate),
      location: index % 3 === 0 ? 'Online' : index % 3 === 1 ? 'Cairo HQ, Room 204' : 'Dubai Office',
      status: STATUSES[index % STATUSES.length],
      created_at: new Date(startYear, 6, 1 + index).toISOString(),
      updated_at: new Date(startYear, 6, 1 + index).toISOString(),
    });
  }
  return rows;
}

function seed(): StoredTrainingProgram[] {
  return generateFiller(20);
}

let store: StoredTrainingProgram[] = seed();
let nextId = 1000;

export function resetMockTrainingPrograms(): void {
  store = seed();
  nextId = 1000;
}

/** Failure injection for reviewing error/rollback UI. */
const FAILURE_RATE_KEY = 'kawdly.trainingProgramMockFailureRate';

function readFailureRate(): number {
  const raw = sessionStorage.getItem(FAILURE_RATE_KEY);
  const parsed = Number(raw);
  return raw !== null && Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0;
}

let failureRate = readFailureRate();

export function setMockFailureRate(rate: number): void {
  failureRate = Math.min(Math.max(rate, 0), 1);
  sessionStorage.setItem(FAILURE_RATE_KEY, String(failureRate));
}

const READ_LATENCY_MS = 220;
const WRITE_LATENCY_MS = 420;

export const mockTrainingProgramApi: TrainingProgramApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const search = params.search?.trim().toLowerCase();
    const filtered = store.filter((row) => {
      if (params.status && row.status !== params.status) return false;
      if (params.type && row.type !== params.type) return false;
      if (!search) return true;
      const haystack = [
        row.title,
        row.category ?? '',
        row.trainer_name ?? '',
        row.location ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const page = filtered.slice(start, start + perPage);

    const wire: TrainingProgramListWire = {
      data: page.map(toWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return trainingProgramListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = nextId;
    nextId += 1;
    const stamp = new Date().toISOString();
    const row: StoredTrainingProgram = {
      id,
      company_id: input.company_id ?? 1,
      title: input.title,
      description: input.description ?? undefined,
      category: input.category ?? undefined,
      type: input.type,
      trainer_name: input.trainer_name ?? undefined,
      duration_hours:
        input.duration_hours !== null && input.duration_hours !== undefined
          ? Number(input.duration_hours).toFixed(1)
          : undefined,
      cost: input.cost ?? undefined,
      max_participants: input.max_participants ?? undefined,
      start_date: input.start_date,
      end_date: input.end_date,
      location: input.location ?? undefined,
      status: input.status ?? undefined,
      created_at: stamp,
      updated_at: stamp,
    };
    store = [row, ...store];
    return trainingProgramDecoder.decode(structuredClone(toWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findOrThrow(id);

    const stamp = new Date().toISOString();
    const updated: StoredTrainingProgram = {
      id: row.id,
      created_at: row.created_at,
      updated_at: stamp,
      company_id: input.company_id ?? row.company_id,
      title: input.title ?? row.title,
      type: input.type ?? row.type,
      start_date: input.start_date ?? row.start_date,
      end_date: input.end_date ?? row.end_date,
      description:
        input.description === null ? undefined : (input.description ?? row.description),
      category:
        input.category === null ? undefined : (input.category ?? row.category),
      trainer_name:
        input.trainer_name === null ? undefined : (input.trainer_name ?? row.trainer_name),
      duration_hours:
        input.duration_hours === null
          ? undefined
          : input.duration_hours !== undefined
          ? Number(input.duration_hours).toFixed(1)
          : row.duration_hours,
      cost:
        input.cost === null ? undefined : (input.cost ?? row.cost),
      max_participants:
        input.max_participants === null
          ? undefined
          : (input.max_participants ?? row.max_participants),
      location:
        input.location === null ? undefined : (input.location ?? row.location),
      status:
        input.status === null ? undefined : (input.status ?? row.status),
    };
    store = store.map((item) => (item.id === id ? updated : item));
    return trainingProgramDecoder.decode(structuredClone(toWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    findOrThrow(id);
    store = store.filter((item) => item.id !== id);
  },
};

function toWire(row: StoredTrainingProgram): TrainingProgramWire {
  return { ...row } as unknown as TrainingProgramWire;
}

function findOrThrow(id: number): StoredTrainingProgram {
  const row = store.find((item) => item.id === id);
  if (!row) throw new ApiError('http', `TrainingProgram ${id} not found`, { status: 404 });
  return row;
}

/** Simulated network delay that rejects promptly when the caller aborts. */
async function simulate(context: FetchContext, baseMs: number): Promise<void> {
  if (context.signal.aborted) throw new ApiError('aborted', 'Request aborted');
  if (failureRate > 0 && Math.random() < failureRate) {
    throw new ApiError('network', 'Simulated transport failure');
  }

  const jittered = baseMs + Math.random() * baseMs * 0.4;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      context.signal.removeEventListener('abort', onAbort);
      resolve();
    }, jittered);
    function onAbort() {
      clearTimeout(timer);
      reject(new ApiError('aborted', 'Request aborted'));
    }
    context.signal.addEventListener('abort', onAbort, { once: true });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// TrainingEnrollment
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Employee ids reused verbatim from `employees/api/mockApi.ts`'s `ANCHORS`
 * (Ahmed Sami, Mona Khaled, Salma Adel, Karim Fouad, Layla Mostafa, Omar
 * Hassan, Nadia Fahmy, Tamer Zakaria) so a cross-feature employee lookup in
 * the UI resolves to a real name instead of a dangling id.
 */
const ENROLLMENT_EMPLOYEE_IDS = [43, 71, 89, 112, 134, 158, 177, 203];

interface StoredTrainingEnrollment {
  id: number;
  training_program_id: number;
  employee_id: number;
  status?: TrainingEnrollmentStatus | undefined;
  score?: string | undefined;
  certificate_path?: string | undefined;
  feedback?: string | undefined;
  feedback_rating?: number | undefined;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}

const ENROLLMENT_STATUSES: TrainingEnrollmentStatus[] = [
  'enrolled',
  'attended',
  'completed',
  'no_show',
  'cancelled',
];

function generateEnrollmentFiller(count: number): StoredTrainingEnrollment[] {
  const rows: StoredTrainingEnrollment[] = [];
  for (let index = 0; index < count; index += 1) {
    const id = index + 1;
    const status = ENROLLMENT_STATUSES[index % ENROLLMENT_STATUSES.length];
    const stamp = new Date(2026, 6, 1 + index).toISOString();
    rows.push({
      id,
      training_program_id: 1 + (index % 20),
      employee_id: ENROLLMENT_EMPLOYEE_IDS[index % ENROLLMENT_EMPLOYEE_IDS.length],
      status,
      score: status === 'completed' ? (70 + (index % 30)).toFixed(2) : undefined,
      certificate_path: status === 'completed' && index % 2 === 0 ? `/certificates/cert-${id}.pdf` : undefined,
      feedback:
        status === 'completed' || status === 'attended'
          ? 'Clear and well-paced. Would recommend to peers.'
          : undefined,
      feedback_rating: status === 'completed' || status === 'attended' ? 3 + (index % 3) : undefined,
      created_at: stamp,
      updated_at: stamp,
    });
  }
  return rows;
}

function seedEnrollments(): StoredTrainingEnrollment[] {
  return generateEnrollmentFiller(18);
}

let enrollmentStore: StoredTrainingEnrollment[] = seedEnrollments();
let enrollmentNextId = 1000;

export function resetMockTrainingEnrollments(): void {
  enrollmentStore = seedEnrollments();
  enrollmentNextId = 1000;
}

export const mockTrainingEnrollmentApi: TrainingEnrollmentApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const filtered = enrollmentStore.filter((row) => {
      if (params.training_program_id !== undefined && row.training_program_id !== params.training_program_id)
        return false;
      if (params.employee_id !== undefined && row.employee_id !== params.employee_id) return false;
      if (params.status && row.status !== params.status) return false;
      return true;
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const page = filtered.slice(start, start + perPage);

    const wire: TrainingEnrollmentListWire = {
      data: page.map(enrollmentToWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return trainingEnrollmentListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = enrollmentNextId;
    enrollmentNextId += 1;
    const stamp = new Date().toISOString();
    const row: StoredTrainingEnrollment = {
      id,
      training_program_id: input.training_program_id,
      employee_id: input.employee_id,
      status: input.status ?? undefined,
      score: input.score !== null && input.score !== undefined ? Number(input.score).toFixed(2) : undefined,
      certificate_path: input.certificate_path ?? undefined,
      feedback: input.feedback ?? undefined,
      feedback_rating: input.feedback_rating ?? undefined,
      created_at: stamp,
      updated_at: stamp,
    };
    enrollmentStore = [row, ...enrollmentStore];
    return trainingEnrollmentDecoder.decode(structuredClone(enrollmentToWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = enrollmentFindOrThrow(id);

    const updated: StoredTrainingEnrollment = {
      id: row.id,
      created_at: row.created_at,
      updated_at: new Date().toISOString(),
      training_program_id: input.training_program_id ?? row.training_program_id,
      employee_id: input.employee_id ?? row.employee_id,
      status: input.status === null ? undefined : (input.status ?? row.status),
      score:
        input.score === null
          ? undefined
          : input.score !== undefined
            ? Number(input.score).toFixed(2)
            : row.score,
      certificate_path:
        input.certificate_path === null ? undefined : (input.certificate_path ?? row.certificate_path),
      feedback: input.feedback === null ? undefined : (input.feedback ?? row.feedback),
      feedback_rating:
        input.feedback_rating === null ? undefined : (input.feedback_rating ?? row.feedback_rating),
    };
    enrollmentStore = enrollmentStore.map((item) => (item.id === id ? updated : item));
    return trainingEnrollmentDecoder.decode(structuredClone(enrollmentToWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    enrollmentFindOrThrow(id);
    enrollmentStore = enrollmentStore.filter((item) => item.id !== id);
  },
};

function enrollmentToWire(row: StoredTrainingEnrollment): TrainingEnrollmentWire {
  return { ...row } as unknown as TrainingEnrollmentWire;
}

function enrollmentFindOrThrow(id: number): StoredTrainingEnrollment {
  const row = enrollmentStore.find((item) => item.id === id);
  if (!row) throw new ApiError('http', `TrainingEnrollment ${id} not found`, { status: 404 });
  return row;
}

// ═══════════════════════════════════════════════════════════════════════════
// LearningPath + LearningPathStep
// ═══════════════════════════════════════════════════════════════════════════

interface StoredLearningPathStep {
  id: number;
  learning_path_id: number;
  title: string;
  description?: string | undefined;
  type: LearningPathStepType;
  reference_id?: number | undefined;
  sort_order?: number | undefined;
  is_required?: boolean | undefined;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}

interface StoredLearningPath {
  id: number;
  company_id: number;
  name: string;
  description?: string | undefined;
  from_position_id?: number | undefined;
  to_position_id?: number | undefined;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}

/**
 * Seed mirrors `LearningCareerPlatformSeeder`'s real DB fixtures: same path
 * names, same "training" steps referencing a real `training_program_id`
 * (1-20, matching this file's `PROGRAM_TITLES` order index+1), non-training
 * steps leave `reference_id` null. Position ids are reused verbatim from
 * `organization/api/mockApi.ts`'s `SEED_JOB_POSITIONS`.
 */
const LEARNING_PATH_SEED: Array<{
  name: string;
  description: string;
  from_position_id: number;
  to_position_id: number;
  steps: Array<{
    title: string;
    description: string;
    type: LearningPathStepType;
    reference_id: number | undefined;
    sort_order: number;
    is_required: boolean;
  }>;
}> = [
  {
    name: 'Engineering Growth Path',
    description:
      'A structured progression for software engineers from junior contributor to technical lead, combining hands-on training, certifications, and on-the-job experience.',
    from_position_id: 8, // Software Engineer
    to_position_id: 7, // IT Manager
    steps: [
      {
        title: 'Complete Leadership Essentials',
        description: 'Build foundational leadership skills required for tech leads and senior engineers.',
        type: 'training',
        reference_id: 1, // "Leadership Essentials"
        sort_order: 1,
        is_required: true,
      },
      {
        title: 'Earn Project Management Professional Certification',
        description: 'Obtain PMP or equivalent to manage engineering projects end-to-end.',
        type: 'certification',
        reference_id: undefined,
        sort_order: 2,
        is_required: true,
      },
      {
        title: 'Complete Advanced Data Analysis Training',
        description: 'Develop data-driven decision-making skills for architecture and product trade-offs.',
        type: 'training',
        reference_id: 2, // "Advanced Excel & Data Analysis"
        sort_order: 3,
        is_required: false,
      },
      {
        title: 'Lead a cross-functional project',
        description: 'Demonstrate leadership competency by successfully delivering a cross-team initiative.',
        type: 'experience',
        reference_id: undefined,
        sort_order: 4,
        is_required: true,
      },
    ],
  },
  {
    name: 'Sales Leadership Path',
    description:
      'Designed for high-potential sales contributors aspiring to team lead and managerial roles in commercial functions.',
    from_position_id: 2, // Sales Executive
    to_position_id: 1, // Sales Manager
    steps: [
      {
        title: 'Complete Customer Experience Workshop',
        description: 'Master consultative selling and customer success frameworks.',
        type: 'training',
        reference_id: 4, // "Customer Experience Workshop"
        sort_order: 1,
        is_required: true,
      },
      {
        title: 'Earn Negotiation Certification',
        description: 'Formal certification in commercial negotiation tactics.',
        type: 'certification',
        reference_id: undefined,
        sort_order: 2,
        is_required: true,
      },
      {
        title: 'Shadow a senior account manager',
        description: 'Observe a full sales cycle on a key account before taking one on independently.',
        type: 'experience',
        reference_id: undefined,
        sort_order: 3,
        is_required: false,
      },
    ],
  },
  {
    name: 'Finance Leadership Path',
    description: 'Prepares senior accountants for financial management responsibilities.',
    from_position_id: 6, // Accountant
    to_position_id: 5, // Finance Manager
    steps: [
      {
        title: 'Complete Strategic Financial Planning',
        description: 'Build budgeting and forecasting skills at the departmental level.',
        type: 'training',
        reference_id: 8, // "Strategic Financial Planning"
        sort_order: 1,
        is_required: true,
      },
      {
        title: 'Earn CMA Certification',
        description: 'Certified Management Accountant designation.',
        type: 'certification',
        reference_id: undefined,
        sort_order: 2,
        is_required: true,
      },
      {
        title: 'Lead a budget cycle end-to-end',
        description: 'Own one full annual budgeting cycle for a department.',
        type: 'experience',
        reference_id: undefined,
        sort_order: 3,
        is_required: true,
      },
    ],
  },
  {
    name: 'HR Business Partner Path',
    description: 'Builds HR specialists into strategic business partners.',
    from_position_id: 10, // HR Specialist
    to_position_id: 9, // HR Manager
    steps: [
      {
        title: 'Complete HR Business Partner Fundamentals',
        description: 'Core HRBP curriculum covering workforce planning and stakeholder management.',
        type: 'training',
        reference_id: 9, // "HR Business Partner Fundamentals"
        sort_order: 1,
        is_required: true,
      },
      {
        title: 'Complete Conflict Resolution Workshop',
        description: 'Practical mediation and conflict-resolution techniques for people managers.',
        type: 'training',
        reference_id: 14, // "Conflict Resolution Workshop"
        sort_order: 2,
        is_required: false,
      },
      {
        title: 'Demonstrate stakeholder management competency',
        description: 'Evidenced through 360 feedback from at least two business-unit leaders.',
        type: 'competency',
        reference_id: undefined,
        sort_order: 3,
        is_required: true,
      },
    ],
  },
];

function seedLearningPaths(): { paths: StoredLearningPath[]; steps: StoredLearningPathStep[] } {
  const paths: StoredLearningPath[] = [];
  const steps: StoredLearningPathStep[] = [];
  let pathId = 1;
  let stepId = 1;
  const stamp = new Date(2026, 5, 1).toISOString();

  for (const entry of LEARNING_PATH_SEED) {
    const id = pathId;
    pathId += 1;
    paths.push({
      id,
      company_id: 1,
      name: entry.name,
      description: entry.description,
      from_position_id: entry.from_position_id,
      to_position_id: entry.to_position_id,
      created_at: stamp,
      updated_at: stamp,
    });
    for (const step of entry.steps) {
      steps.push({
        id: stepId,
        learning_path_id: id,
        title: step.title,
        description: step.description,
        type: step.type,
        reference_id: step.reference_id,
        sort_order: step.sort_order,
        is_required: step.is_required,
        created_at: stamp,
        updated_at: stamp,
      });
      stepId += 1;
    }
  }
  return { paths, steps };
}

let { paths: learningPathStore, steps: learningPathStepStore } = seedLearningPaths();
let learningPathNextId = 1000;
let learningPathStepNextId = 1000;

export function resetMockLearningPaths(): void {
  const seeded = seedLearningPaths();
  learningPathStore = seeded.paths;
  learningPathStepStore = seeded.steps;
  learningPathNextId = 1000;
}

/** Steps live in the same backing store, so resetting one resets the other too. */
export function resetMockLearningPathSteps(): void {
  resetMockLearningPaths();
  learningPathStepNextId = 1000;
}

export const mockLearningPathApi: LearningPathApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const filtered = learningPathStore.filter((row) => {
      if (params.from_position_id !== undefined && row.from_position_id !== params.from_position_id)
        return false;
      if (params.to_position_id !== undefined && row.to_position_id !== params.to_position_id) return false;
      return true;
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const page = filtered.slice(start, start + perPage);

    const wire: LearningPathListWire = {
      data: page.map(learningPathToWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return learningPathListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = learningPathNextId;
    learningPathNextId += 1;
    const stamp = new Date().toISOString();
    const row: StoredLearningPath = {
      id,
      company_id: input.company_id ?? 1,
      name: input.name,
      description: input.description ?? undefined,
      from_position_id: input.from_position_id ?? undefined,
      to_position_id: input.to_position_id ?? undefined,
      created_at: stamp,
      updated_at: stamp,
    };
    learningPathStore = [row, ...learningPathStore];
    return learningPathDecoder.decode(structuredClone(learningPathToWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = learningPathFindOrThrow(id);

    const updated: StoredLearningPath = {
      id: row.id,
      company_id: row.company_id,
      created_at: row.created_at,
      updated_at: new Date().toISOString(),
      name: input.name ?? row.name,
      description: input.description === null ? undefined : (input.description ?? row.description),
      from_position_id:
        input.from_position_id === null ? undefined : (input.from_position_id ?? row.from_position_id),
      to_position_id: input.to_position_id === null ? undefined : (input.to_position_id ?? row.to_position_id),
    };
    learningPathStore = learningPathStore.map((item) => (item.id === id ? updated : item));
    return learningPathDecoder.decode(structuredClone(learningPathToWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    learningPathFindOrThrow(id);
    learningPathStore = learningPathStore.filter((item) => item.id !== id);
    learningPathStepStore = learningPathStepStore.filter((item) => item.learning_path_id !== id);
  },
};

function learningPathToWire(row: StoredLearningPath): LearningPathWire {
  return { ...row } as unknown as LearningPathWire;
}

function learningPathFindOrThrow(id: number): StoredLearningPath {
  const row = learningPathStore.find((item) => item.id === id);
  if (!row) throw new ApiError('http', `LearningPath ${id} not found`, { status: 404 });
  return row;
}

export const mockLearningPathStepApi: LearningPathStepApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const filtered = learningPathStepStore
      .filter((row) => {
        if (params.learning_path_id !== undefined && row.learning_path_id !== params.learning_path_id)
          return false;
        if (params.type && row.type !== params.type) return false;
        if (params.is_required !== undefined && Boolean(row.is_required) !== params.is_required) return false;
        return true;
      })
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const page = filtered.slice(start, start + perPage);

    const wire: LearningPathStepListWire = {
      data: page.map(learningPathStepToWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return learningPathStepListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = learningPathStepNextId;
    learningPathStepNextId += 1;
    const stamp = new Date().toISOString();
    const row: StoredLearningPathStep = {
      id,
      learning_path_id: input.learning_path_id,
      title: input.title,
      description: input.description ?? undefined,
      type: input.type,
      reference_id: input.reference_id ?? undefined,
      sort_order: input.sort_order ?? undefined,
      is_required: input.is_required ?? undefined,
      created_at: stamp,
      updated_at: stamp,
    };
    learningPathStepStore = [...learningPathStepStore, row];
    return learningPathStepDecoder.decode(structuredClone(learningPathStepToWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = learningPathStepFindOrThrow(id);

    const updated: StoredLearningPathStep = {
      id: row.id,
      learning_path_id: input.learning_path_id ?? row.learning_path_id,
      created_at: row.created_at,
      updated_at: new Date().toISOString(),
      title: input.title ?? row.title,
      type: input.type ?? row.type,
      description: input.description === null ? undefined : (input.description ?? row.description),
      reference_id: input.reference_id === null ? undefined : (input.reference_id ?? row.reference_id),
      sort_order: input.sort_order === null ? undefined : (input.sort_order ?? row.sort_order),
      is_required: input.is_required === null ? undefined : (input.is_required ?? row.is_required),
    };
    learningPathStepStore = learningPathStepStore.map((item) => (item.id === id ? updated : item));
    return learningPathStepDecoder.decode(structuredClone(learningPathStepToWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    learningPathStepFindOrThrow(id);
    learningPathStepStore = learningPathStepStore.filter((item) => item.id !== id);
  },
};

function learningPathStepToWire(row: StoredLearningPathStep): LearningPathStepWire {
  return { ...row } as unknown as LearningPathStepWire;
}

function learningPathStepFindOrThrow(id: number): StoredLearningPathStep {
  const row = learningPathStepStore.find((item) => item.id === id);
  if (!row) throw new ApiError('http', `LearningPathStep ${id} not found`, { status: 404 });
  return row;
}
