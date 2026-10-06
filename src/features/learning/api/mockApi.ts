import { ApiError } from '@/lib/api/errors';
import type { FetchContext } from '@/lib/query';
import { trainingProgramDecoder, trainingProgramListDecoder } from './schema';
import type { TrainingProgramListWire, TrainingProgramWire } from './schema';
import type { TrainingProgramApi, TrainingProgramStatus, TrainingProgramType } from './resource';

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
      company_id: input.company_id,
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
