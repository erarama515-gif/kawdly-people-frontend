import { ApiError } from '@/lib/api/errors';
import type { FetchContext } from '@/lib/query';
import { pravatar } from '@/features/dashboard/model';
import {
  careerPathDecoder,
  careerPathListDecoder,
  careerPathLevelDecoder,
  careerPathLevelListDecoder,
  successionPlanDecoder,
  successionPlanListDecoder,
} from './schema';
import type {
  CareerPathListWire,
  CareerPathWire,
  CareerPathLevelListWire,
  CareerPathLevelWire,
  SuccessionPlanListWire,
  SuccessionPlanWire,
} from './schema';
import type { CareerPathApi, CareerPathLevelApi, SuccessionPlanApi, SuccessionReadiness } from './resource';

/**
 * In-process implementations of `CareerPathApi` and `SuccessionPlanApi`, used
 * until the Laravel backend is configured (the default — see `env.useMockApi`).
 *
 * Mirrors `attendance/api/mockApi.ts`: owns real mutable state so a create or
 * delete is a genuine write later reads observe, adds latency, honours
 * `AbortSignal`, and every response is re-decoded through the same decoders a
 * real HTTP response would go through.
 *
 * Key schema differences vs. old mock data.ts:
 *   - CareerPath: no `description` field (not real); no `levelsCount` stat.
 *   - SuccessionPlan: ONE row per successor (not an array of successors per plan).
 *     The real backend has `successor_id` (single int FK) + `readiness` enum
 *     (ready_now | ready_1_year | ready_2_years | development_needed).
 */

// ─── Shared latency / failure helpers ─────────────────────────────────────────

const READ_LATENCY_MS = 220;
const WRITE_LATENCY_MS = 420;

const FAILURE_RATE_KEY = 'kawdly.careerMockFailureRate';

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

// ─── Employee stubs (same anchor IDs as attendance/contracts mocks) ───────────

const EMPLOYEE_STUBS = [
  { id: 43,   employee_number: 'EMP-00043', first_name: 'Ahmed',  last_name: 'Sami',    photo: pravatar(53) },
  { id: 71,   employee_number: 'EMP-00071', first_name: 'Mona',   last_name: 'Khaled',  photo: pravatar(44) },
  { id: 89,   employee_number: 'EMP-00089', first_name: 'Salma',  last_name: 'Adel',    photo: pravatar(9)  },
  { id: 112,  employee_number: 'EMP-00112', first_name: 'Karim',  last_name: 'Fouad',   photo: pravatar(26) },
  { id: 134,  employee_number: 'EMP-00134', first_name: 'Layla',  last_name: 'Mostafa', photo: pravatar(47) },
  { id: 158,  employee_number: 'EMP-00158', first_name: 'Omar',   last_name: 'Hassan',  photo: pravatar(33) },
  { id: 177,  employee_number: 'EMP-00177', first_name: 'Nadia',  last_name: 'Fahmy',   photo: pravatar(21) },
  { id: 203,  employee_number: 'EMP-00203', first_name: 'Tamer',  last_name: 'Zakaria', photo: pravatar(13) },
  { id: 1000, employee_number: 'EMP-01000', first_name: 'Ahmed',  last_name: 'Hamdy',   photo: pravatar(15) },
  { id: 1001, employee_number: 'EMP-01001', first_name: 'Mona',   last_name: 'Zakaria', photo: pravatar(22) },
] as const;

// ─── Job-position stubs ───────────────────────────────────────────────────────

const JOB_POSITION_STUBS = [
  { id: 1,  title: 'VP Engineering' },
  { id: 2,  title: 'Chief Financial Officer' },
  { id: 3,  title: 'Head of Marketing' },
  { id: 4,  title: 'Head of Sales' },
  { id: 5,  title: 'Head of People & HR' },
  { id: 6,  title: 'Director of Operations' },
  { id: 7,  title: 'Chief Technology Officer' },
  { id: 8,  title: 'Regional Manager — Gulf' },
] as const;

// ─── CareerPath store ─────────────────────────────────────────────────────────

interface StoredCareerPath {
  id: number;
  company_id: number;
  name: string;
  job_family?: string | undefined;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}

// Job-family strings used only in seed data above; kept here so it's easy to extend.
const _JOB_FAMILIES = ['Technology', 'Finance', 'Sales', 'Human Resources', 'Operations', 'Marketing'];
void _JOB_FAMILIES; // referenced to avoid dead-code removal in bundlers

const CAREER_PATH_SEEDS: StoredCareerPath[] = [
  { id: 1,  company_id: 1, name: 'Software Engineering',        job_family: 'Technology'     },
  { id: 2,  company_id: 1, name: 'Sales & Business Development', job_family: 'Sales'          },
  { id: 3,  company_id: 1, name: 'Finance & Accounting',        job_family: 'Finance'         },
  { id: 4,  company_id: 1, name: 'People & HR',                 job_family: 'Human Resources' },
  { id: 5,  company_id: 1, name: 'Marketing & Brand',           job_family: 'Marketing'       },
  { id: 6,  company_id: 1, name: 'Operations & Supply Chain',   job_family: 'Operations'      },
  { id: 7,  company_id: 1, name: 'Legal & Compliance',          job_family: undefined         },
  { id: 8,  company_id: 1, name: 'Customer Success',            job_family: 'Sales'           },
  { id: 9,  company_id: 1, name: 'Product Management',         job_family: 'Technology'      },
  { id: 10, company_id: 1, name: 'Data & Analytics',            job_family: 'Technology'      },
];

function seedCareerPaths(): StoredCareerPath[] {
  return CAREER_PATH_SEEDS.map((p) => ({ ...p, created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' }));
}

let pathStore: StoredCareerPath[] = seedCareerPaths();
let nextPathId = 100;

export function resetMockCareerPaths(): void {
  pathStore = seedCareerPaths();
  nextPathId = 100;
}

function careerPathToWire(p: StoredCareerPath): CareerPathWire {
  return careerPathDecoder.decode(structuredClone(p) as unknown);
}

function findPathOrThrow(id: number): StoredCareerPath {
  const row = pathStore.find((p) => p.id === id);
  if (!row) throw new ApiError('http', `CareerPath ${id} not found`, { status: 404 });
  return row;
}

export const mockCareerPathApi: CareerPathApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = pathStore.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const page = pathStore.slice(start, start + perPage);

    const wire: CareerPathListWire = {
      data: page.map(careerPathToWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return careerPathListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = nextPathId;
    nextPathId += 1;
    const stamp = new Date().toISOString();
    const row: StoredCareerPath = {
      id,
      company_id: input.company_id,
      name: input.name,
      job_family: input.job_family ?? undefined,
      created_at: stamp,
      updated_at: stamp,
    };
    pathStore = [row, ...pathStore];
    return careerPathDecoder.decode(structuredClone(careerPathToWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findPathOrThrow(id);

    const updated: StoredCareerPath = {
      ...row,
      name: input.name ?? row.name,
      company_id: input.company_id ?? row.company_id,
      job_family:
        input.job_family === null ? undefined : (input.job_family ?? row.job_family),
      updated_at: new Date().toISOString(),
    };
    pathStore = pathStore.map((p) => (p.id === id ? updated : p));
    return careerPathDecoder.decode(structuredClone(careerPathToWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    findPathOrThrow(id);
    pathStore = pathStore.filter((p) => p.id !== id);
  },
};

// ─── CareerPathLevel store ────────────────────────────────────────────────────

interface StoredCareerPathLevel {
  id: number;
  career_path_id: number;
  job_position_id: number;
  level_order?: number | undefined;
  min_experience_years?: number | undefined;
  required_competencies?: string[] | undefined;
  required_certifications?: string[] | undefined;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}

const CAREER_PATH_LEVEL_SEEDS: StoredCareerPathLevel[] = [
  // Software Engineering (career_path_id: 1)
  { id: 1,  career_path_id: 1, job_position_id: 7,  level_order: 1, min_experience_years: 0,  required_competencies: ['JavaScript', 'HTML/CSS'],                          required_certifications: undefined },
  { id: 2,  career_path_id: 1, job_position_id: 7,  level_order: 2, min_experience_years: 2,  required_competencies: ['React', 'TypeScript', 'REST APIs'],                 required_certifications: undefined },
  { id: 3,  career_path_id: 1, job_position_id: 7,  level_order: 3, min_experience_years: 5,  required_competencies: ['System Design', 'Mentoring', 'Code Review'],        required_certifications: ['AWS Solutions Architect'] },
  // Finance & Accounting (career_path_id: 3)
  { id: 4,  career_path_id: 3, job_position_id: 2,  level_order: 1, min_experience_years: 0,  required_competencies: ['Bookkeeping', 'Excel'],                             required_certifications: undefined },
  { id: 5,  career_path_id: 3, job_position_id: 2,  level_order: 2, min_experience_years: 3,  required_competencies: ['IFRS', 'Financial Reporting', 'ERP Systems'],       required_certifications: ['CPA'] },
  { id: 6,  career_path_id: 3, job_position_id: 2,  level_order: 3, min_experience_years: 7,  required_competencies: ['Strategic Finance', 'Team Leadership'],             required_certifications: ['CFA', 'CPA'] },
  // People & HR (career_path_id: 4)
  { id: 7,  career_path_id: 4, job_position_id: 5,  level_order: 1, min_experience_years: 0,  required_competencies: ['Recruitment', 'Onboarding'],                        required_certifications: undefined },
  { id: 8,  career_path_id: 4, job_position_id: 5,  level_order: 2, min_experience_years: 3,  required_competencies: ['HRIS', 'Performance Management', 'Labour Law'],     required_certifications: ['SHRM-CP'] },
  // Sales & Business Development (career_path_id: 2)
  { id: 9,  career_path_id: 2, job_position_id: 4,  level_order: 1, min_experience_years: 0,  required_competencies: ['Prospecting', 'CRM'],                               required_certifications: undefined },
  { id: 10, career_path_id: 2, job_position_id: 4,  level_order: 2, min_experience_years: 2,  required_competencies: ['Solution Selling', 'Pipeline Management'],          required_certifications: undefined },
  { id: 11, career_path_id: 2, job_position_id: 4,  level_order: 3, min_experience_years: 5,  required_competencies: ['Strategic Accounts', 'Team Coaching', 'Forecasting'], required_certifications: undefined },
];

function seedCareerPathLevels(): StoredCareerPathLevel[] {
  return CAREER_PATH_LEVEL_SEEDS.map((l) => ({
    ...l,
    created_at: '2025-01-10T00:00:00.000Z',
    updated_at: '2025-01-10T00:00:00.000Z',
  }));
}

let levelStore: StoredCareerPathLevel[] = seedCareerPathLevels();
let nextLevelId = 100;

export function resetMockCareerPathLevels(): void {
  levelStore = seedCareerPathLevels();
  nextLevelId = 100;
}

function careerPathLevelToWire(l: StoredCareerPathLevel): CareerPathLevelWire {
  const careerPath = pathStore.find((p) => p.id === l.career_path_id);
  const jobPosition = JOB_POSITION_STUBS.find((j) => j.id === l.job_position_id);
  const raw = {
    ...l,
    career_path: careerPath
      ? { id: careerPath.id, name: careerPath.name, job_family: careerPath.job_family }
      : undefined,
    job_position: jobPosition ? { ...jobPosition } : undefined,
  };
  return careerPathLevelDecoder.decode(structuredClone(raw) as unknown);
}

function findLevelOrThrow(id: number): StoredCareerPathLevel {
  const row = levelStore.find((l) => l.id === id);
  if (!row) throw new ApiError('http', `CareerPathLevel ${id} not found`, { status: 404 });
  return row;
}

export const mockCareerPathLevelApi: CareerPathLevelApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const filtered = levelStore.filter((row) => {
      if (params.career_path_id !== undefined && row.career_path_id !== params.career_path_id)
        return false;
      return true;
    });

    // Sort by level_order ascending for a natural display order.
    const sorted = [...filtered].sort((a, b) => (a.level_order ?? 999) - (b.level_order ?? 999));

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = sorted.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const page = sorted.slice(start, start + perPage);

    const wire: CareerPathLevelListWire = {
      data: page.map(careerPathLevelToWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return careerPathLevelListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = nextLevelId;
    nextLevelId += 1;
    const stamp = new Date().toISOString();
    const row: StoredCareerPathLevel = {
      id,
      career_path_id: input.career_path_id,
      job_position_id: input.job_position_id,
      level_order: input.level_order ?? undefined,
      min_experience_years: input.min_experience_years ?? undefined,
      required_competencies: input.required_competencies,
      required_certifications: input.required_certifications ?? undefined,
      created_at: stamp,
      updated_at: stamp,
    };
    levelStore = [row, ...levelStore];
    return careerPathLevelDecoder.decode(structuredClone(careerPathLevelToWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findLevelOrThrow(id);

    const updated: StoredCareerPathLevel = {
      ...row,
      career_path_id: input.career_path_id ?? row.career_path_id,
      job_position_id: input.job_position_id ?? row.job_position_id,
      level_order:
        input.level_order === null ? undefined : (input.level_order ?? row.level_order),
      min_experience_years:
        input.min_experience_years === null
          ? undefined
          : (input.min_experience_years ?? row.min_experience_years),
      required_competencies:
        input.required_competencies ?? row.required_competencies,
      required_certifications:
        input.required_certifications === null
          ? undefined
          : (input.required_certifications ?? row.required_certifications),
      updated_at: new Date().toISOString(),
    };
    levelStore = levelStore.map((l) => (l.id === id ? updated : l));
    return careerPathLevelDecoder.decode(structuredClone(careerPathLevelToWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    findLevelOrThrow(id);
    levelStore = levelStore.filter((l) => l.id !== id);
  },
};

// ─── SuccessionPlan store ─────────────────────────────────────────────────────

interface StoredSuccessionPlan {
  id: number;
  job_position_id: number;
  current_holder_id?: number | undefined;
  successor_id: number;
  readiness: SuccessionReadiness;
  readiness_score?: number | undefined;
  development_plan?: string | undefined;
  notes?: string | undefined;
  updated_by: number;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}

const READINESS_CYCLE: SuccessionReadiness[] = [
  'ready_now',
  'ready_1_year',
  'ready_2_years',
  'development_needed',
];
void READINESS_CYCLE; // referenced to avoid dead-code removal in bundlers

const SUCCESSION_SEEDS: StoredSuccessionPlan[] = [
  { id: 1,  job_position_id: 1, current_holder_id: 43,  successor_id: 112,  readiness: 'ready_now',          readiness_score: 92, updated_by: 1 },
  { id: 2,  job_position_id: 1, current_holder_id: 43,  successor_id: 177,  readiness: 'ready_1_year',        readiness_score: 78, updated_by: 1 },
  { id: 3,  job_position_id: 2, current_holder_id: 89,  successor_id: 203,  readiness: 'ready_1_year',        readiness_score: 84, updated_by: 1 },
  { id: 4,  job_position_id: 3, current_holder_id: 158, successor_id: 134,  readiness: 'ready_now',           readiness_score: 88, updated_by: 1 },
  { id: 5,  job_position_id: 3, current_holder_id: 158, successor_id: 1001, readiness: 'ready_2_years',       readiness_score: 65, updated_by: 1 },
  { id: 6,  job_position_id: 4, current_holder_id: 71,  successor_id: 1000, readiness: 'ready_1_year',        readiness_score: 74, updated_by: 1 },
  { id: 7,  job_position_id: 5, current_holder_id: 177, successor_id: 89,   readiness: 'development_needed',  readiness_score: 55, updated_by: 1 },
  { id: 8,  job_position_id: 6, current_holder_id: undefined, successor_id: 203, readiness: 'ready_2_years', readiness_score: 70, updated_by: 1 },
  { id: 9,  job_position_id: 7, current_holder_id: 112, successor_id: 1000, readiness: 'ready_now',           readiness_score: 95, updated_by: 1 },
  { id: 10, job_position_id: 7, current_holder_id: 112, successor_id: 43,   readiness: 'ready_1_year',        readiness_score: 80, updated_by: 1 },
  { id: 11, job_position_id: 8, current_holder_id: 134, successor_id: 71,   readiness: 'development_needed',  readiness_score: 48, updated_by: 1 },
  { id: 12, job_position_id: 4, current_holder_id: 71,  successor_id: 177,  readiness: 'ready_now',           readiness_score: 90, updated_by: 1 },
  { id: 13, job_position_id: 2, current_holder_id: 89,  successor_id: 1001, readiness: 'ready_2_years',       readiness_score: 60, updated_by: 1 },
  { id: 14, job_position_id: 5, current_holder_id: undefined, successor_id: 134, readiness: 'ready_1_year',  readiness_score: 77, updated_by: 1 },
  { id: 15, job_position_id: 6, current_holder_id: 158, successor_id: 112,  readiness: 'ready_now',           readiness_score: 85, updated_by: 1 },
];

function seedSuccessionPlans(): StoredSuccessionPlan[] {
  return SUCCESSION_SEEDS.map((s) => ({
    ...s,
    created_at: '2025-03-01T00:00:00.000Z',
    updated_at: '2025-03-01T00:00:00.000Z',
  }));
}

let planStore: StoredSuccessionPlan[] = seedSuccessionPlans();
let nextPlanId = 100;

export function resetMockSuccessionPlans(): void {
  planStore = seedSuccessionPlans();
  nextPlanId = 100;
}

function successionPlanToWire(s: StoredSuccessionPlan): SuccessionPlanWire {
  const jobPosition = JOB_POSITION_STUBS.find((j) => j.id === s.job_position_id);
  const currentHolder = s.current_holder_id !== undefined
    ? EMPLOYEE_STUBS.find((e) => e.id === s.current_holder_id)
    : undefined;
  const successor = EMPLOYEE_STUBS.find((e) => e.id === s.successor_id);

  const raw = {
    ...s,
    job_position: jobPosition ? { ...jobPosition } : undefined,
    current_holder: currentHolder ? { ...currentHolder } : undefined,
    successor: successor ? { ...successor } : undefined,
  };
  return successionPlanDecoder.decode(structuredClone(raw) as unknown);
}

function findPlanOrThrow(id: number): StoredSuccessionPlan {
  const row = planStore.find((p) => p.id === id);
  if (!row) throw new ApiError('http', `SuccessionPlan ${id} not found`, { status: 404 });
  return row;
}

export const mockSuccessionPlanApi: SuccessionPlanApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const filtered = planStore.filter((row) => {
      if (params.readiness && row.readiness !== params.readiness) return false;
      return true;
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const page = filtered.slice(start, start + perPage);

    const wire: SuccessionPlanListWire = {
      data: page.map(successionPlanToWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return successionPlanListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = nextPlanId;
    nextPlanId += 1;
    const stamp = new Date().toISOString();
    const row: StoredSuccessionPlan = {
      id,
      job_position_id: input.job_position_id,
      current_holder_id: input.current_holder_id ?? undefined,
      successor_id: input.successor_id,
      readiness: input.readiness,
      readiness_score: input.readiness_score ?? undefined,
      development_plan: input.development_plan ?? undefined,
      notes: input.notes ?? undefined,
      updated_by: input.updated_by,
      created_at: stamp,
      updated_at: stamp,
    };
    planStore = [row, ...planStore];
    return successionPlanDecoder.decode(structuredClone(successionPlanToWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findPlanOrThrow(id);

    const updated: StoredSuccessionPlan = {
      ...row,
      job_position_id: input.job_position_id ?? row.job_position_id,
      current_holder_id:
        input.current_holder_id === null
          ? undefined
          : (input.current_holder_id ?? row.current_holder_id),
      successor_id: input.successor_id ?? row.successor_id,
      readiness: input.readiness ?? row.readiness,
      readiness_score:
        input.readiness_score === null
          ? undefined
          : (input.readiness_score ?? row.readiness_score),
      development_plan:
        input.development_plan === null
          ? undefined
          : (input.development_plan ?? row.development_plan),
      notes: input.notes === null ? undefined : (input.notes ?? row.notes),
      updated_by: input.updated_by ?? row.updated_by,
      updated_at: new Date().toISOString(),
    };
    planStore = planStore.map((p) => (p.id === id ? updated : p));
    return successionPlanDecoder.decode(structuredClone(successionPlanToWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    findPlanOrThrow(id);
    planStore = planStore.filter((p) => p.id !== id);
  },
};

