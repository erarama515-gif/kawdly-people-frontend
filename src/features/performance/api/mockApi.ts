import { ApiError } from '@/lib/api/errors';
import type { FetchContext } from '@/lib/query';
import { pravatar } from '@/features/dashboard/model';
import {
  performanceCycleDecoder,
  performanceCycleListDecoder,
  performanceReviewDecoder,
  performanceReviewListDecoder,
} from './schema';
import type {
  PerformanceCycleListWire,
  PerformanceCycleWire,
  PerformanceReviewListWire,
  PerformanceReviewWire,
} from './schema';
import type {
  PerformanceCycleApi,
  PerformanceCycleStatus,
  PerformanceCycleType,
  PerformanceReviewApi,
  PerformanceReviewStatus,
  PerformanceReviewType,
} from './resource';

/**
 * In-process implementations of `PerformanceCycleApi` and `PerformanceReviewApi`,
 * used until the Laravel backend is configured (the default — see `env.useMockApi`).
 *
 * Mirrors `career/api/mockApi.ts`: owns real mutable state so a create or
 * delete is a genuine write later reads observe, adds latency, honours
 * `AbortSignal`, and every response is re-decoded through the same decoders a
 * real HTTP response would go through.
 *
 * Key schema differences vs. old data.ts mock:
 *   - PerformanceCycle: no `period`/`deadline` pre-formatted strings;
 *     real dates are `start_date`/`end_date`/`manager_review_deadline`.
 *   - PerformanceCycle.status: real enum draft|active|in_review|completed;
 *     old mock used 'active'|'closed' — 'closed' doesn't exist.
 *   - PerformanceReview: ONE row per (cycle_id, employee_id, reviewer_id, review_type).
 *     Old mock had selfRating/managerRating pivot; that does not exist in the backend.
 *   - No `department` column — resolved via the `employee` relation.
 *   - PerformanceReview.status: real enum pending|in_progress|submitted|acknowledged;
 *     old mock used 'completed' which is not a real value.
 */

// ─── Shared latency / failure helpers ─────────────────────────────────────────

const READ_LATENCY_MS = 220;
const WRITE_LATENCY_MS = 420;

const FAILURE_RATE_KEY = 'kawdly.performanceMockFailureRate';

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

// ─── Employee stubs (same anchor IDs as attendance/career mocks) ───────────

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

// ─── PerformanceCycle store ───────────────────────────────────────────────────

interface StoredPerformanceCycle {
  id: number;
  company_id: number;
  name: string;
  type: PerformanceCycleType;
  start_date: string;
  end_date: string;
  self_review_deadline: string;
  manager_review_deadline: string;
  status?: PerformanceCycleStatus | undefined;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}

const CYCLE_SEEDS: StoredPerformanceCycle[] = [
  {
    id: 1,
    company_id: 1,
    name: '2026 Annual Review',
    type: 'annual',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    self_review_deadline: '2026-10-01',
    manager_review_deadline: '2026-10-15',
    status: 'active',
  },
  {
    id: 2,
    company_id: 1,
    name: 'Q3 2026 Review',
    type: 'quarterly',
    start_date: '2026-07-01',
    end_date: '2026-09-30',
    self_review_deadline: '2026-09-20',
    manager_review_deadline: '2026-09-30',
    status: 'in_review',
  },
  {
    id: 3,
    company_id: 1,
    name: 'H1 2026 Semi-Annual Review',
    type: 'semi_annual',
    start_date: '2026-01-01',
    end_date: '2026-06-30',
    self_review_deadline: '2026-06-15',
    manager_review_deadline: '2026-06-30',
    status: 'completed',
  },
  {
    id: 4,
    company_id: 1,
    name: 'Q4 2026 Review (Draft)',
    type: 'quarterly',
    start_date: '2026-10-01',
    end_date: '2026-12-31',
    self_review_deadline: '2026-12-15',
    manager_review_deadline: '2026-12-31',
    status: 'draft',
  },
];

function seedCycles(): StoredPerformanceCycle[] {
  return CYCLE_SEEDS.map((c) => ({
    ...c,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }));
}

let cycleStore: StoredPerformanceCycle[] = seedCycles();
let nextCycleId = 100;

export function resetMockPerformanceCycles(): void {
  cycleStore = seedCycles();
  nextCycleId = 100;
}

function cycleToWire(c: StoredPerformanceCycle): PerformanceCycleWire {
  return performanceCycleDecoder.decode(structuredClone(c) as unknown);
}

function findCycleOrThrow(id: number): StoredPerformanceCycle {
  const row = cycleStore.find((c) => c.id === id);
  if (!row) throw new ApiError('http', `PerformanceCycle ${id} not found`, { status: 404 });
  return row;
}

export const mockPerformanceCycleApi: PerformanceCycleApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const filtered = cycleStore.filter((row) => {
      if (params.status !== undefined && row.status !== params.status) return false;
      return true;
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const page = filtered.slice(start, start + perPage);

    const wire: PerformanceCycleListWire = {
      data: page.map(cycleToWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return performanceCycleListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = nextCycleId;
    nextCycleId += 1;
    const stamp = new Date().toISOString();
    const row: StoredPerformanceCycle = {
      id,
      company_id: input.company_id,
      name: input.name,
      type: input.type,
      start_date: input.start_date,
      end_date: input.end_date,
      self_review_deadline: input.self_review_deadline,
      manager_review_deadline: input.manager_review_deadline,
      status: input.status ?? undefined,
      created_at: stamp,
      updated_at: stamp,
    };
    cycleStore = [row, ...cycleStore];
    return performanceCycleDecoder.decode(structuredClone(cycleToWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findCycleOrThrow(id);

    const updated: StoredPerformanceCycle = {
      ...row,
      name: input.name ?? row.name,
      company_id: input.company_id ?? row.company_id,
      type: input.type ?? row.type,
      start_date: input.start_date ?? row.start_date,
      end_date: input.end_date ?? row.end_date,
      self_review_deadline: input.self_review_deadline ?? row.self_review_deadline,
      manager_review_deadline: input.manager_review_deadline ?? row.manager_review_deadline,
      status: input.status === null ? undefined : (input.status ?? row.status),
      updated_at: new Date().toISOString(),
    };
    cycleStore = cycleStore.map((c) => (c.id === id ? updated : c));
    return performanceCycleDecoder.decode(structuredClone(cycleToWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    findCycleOrThrow(id);
    cycleStore = cycleStore.filter((c) => c.id !== id);
  },
};

// ─── PerformanceReview store ──────────────────────────────────────────────────

interface StoredPerformanceReview {
  id: number;
  cycle_id: number;
  employee_id: number;
  reviewer_id: number;
  review_type: PerformanceReviewType;
  overall_rating?: number | undefined;
  strengths?: string | undefined;
  improvements?: string | undefined;
  comments?: string | undefined;
  status?: PerformanceReviewStatus | undefined;
  submitted_at?: string | undefined;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}

const REVIEW_SEEDS: StoredPerformanceReview[] = [
  // Cycle 1 — Annual 2026 (mix of self/manager reviews, various statuses)
  { id: 1,  cycle_id: 1, employee_id: 43,  reviewer_id: 43,  review_type: 'self',    overall_rating: 4.2, status: 'submitted',    submitted_at: '2026-09-28', strengths: 'Strong technical skills', improvements: 'Communication' },
  { id: 2,  cycle_id: 1, employee_id: 43,  reviewer_id: 112, review_type: 'manager', overall_rating: 4.0, status: 'submitted',    submitted_at: '2026-10-05', strengths: 'Reliable delivery', improvements: 'Cross-team collaboration' },
  { id: 3,  cycle_id: 1, employee_id: 71,  reviewer_id: 71,  review_type: 'self',    overall_rating: 3.8, status: 'submitted',    submitted_at: '2026-09-29' },
  { id: 4,  cycle_id: 1, employee_id: 71,  reviewer_id: 112, review_type: 'manager', overall_rating: 4.1, status: 'acknowledged', submitted_at: '2026-10-04' },
  { id: 5,  cycle_id: 1, employee_id: 89,  reviewer_id: 89,  review_type: 'self',    overall_rating: 4.5, status: 'submitted',    submitted_at: '2026-09-30' },
  { id: 6,  cycle_id: 1, employee_id: 89,  reviewer_id: 158, review_type: 'manager', status: 'pending' },
  { id: 7,  cycle_id: 1, employee_id: 112, reviewer_id: 112, review_type: 'self',    status: 'pending' },
  { id: 8,  cycle_id: 1, employee_id: 112, reviewer_id: 43,  review_type: 'manager', status: 'in_progress' },
  { id: 9,  cycle_id: 1, employee_id: 134, reviewer_id: 134, review_type: 'self',    overall_rating: 3.5, status: 'submitted',    submitted_at: '2026-09-27' },
  { id: 10, cycle_id: 1, employee_id: 134, reviewer_id: 71,  review_type: 'manager', overall_rating: 3.7, status: 'acknowledged', submitted_at: '2026-10-03' },
  { id: 11, cycle_id: 1, employee_id: 158, reviewer_id: 158, review_type: 'self',    status: 'pending' },
  { id: 12, cycle_id: 1, employee_id: 158, reviewer_id: 203, review_type: 'peer',    status: 'in_progress' },
  // Cycle 2 — Q3 2026 (in_review cycle)
  { id: 13, cycle_id: 2, employee_id: 177, reviewer_id: 177, review_type: 'self',    overall_rating: 4.3, status: 'submitted',    submitted_at: '2026-09-18' },
  { id: 14, cycle_id: 2, employee_id: 177, reviewer_id: 43,  review_type: 'manager', overall_rating: 4.1, status: 'in_progress' },
  { id: 15, cycle_id: 2, employee_id: 203, reviewer_id: 203, review_type: 'self',    status: 'pending' },
  // Cycle 3 — H1 2026 (completed cycle)
  { id: 16, cycle_id: 3, employee_id: 1000, reviewer_id: 1000, review_type: 'self',    overall_rating: 3.9, status: 'acknowledged', submitted_at: '2026-06-14' },
  { id: 17, cycle_id: 3, employee_id: 1000, reviewer_id: 71,   review_type: 'manager', overall_rating: 4.0, status: 'acknowledged', submitted_at: '2026-06-28' },
  { id: 18, cycle_id: 3, employee_id: 1001, reviewer_id: 1001, review_type: 'self',    overall_rating: 3.6, status: 'acknowledged', submitted_at: '2026-06-13' },
];

function seedReviews(): StoredPerformanceReview[] {
  return REVIEW_SEEDS.map((r) => ({
    ...r,
    created_at: '2026-01-10T00:00:00.000Z',
    updated_at: '2026-01-10T00:00:00.000Z',
  }));
}

let reviewStore: StoredPerformanceReview[] = seedReviews();
let nextReviewId = 100;

export function resetMockPerformanceReviews(): void {
  reviewStore = seedReviews();
  nextReviewId = 100;
}

function reviewToWire(r: StoredPerformanceReview): PerformanceReviewWire {
  const employee = EMPLOYEE_STUBS.find((e) => e.id === r.employee_id);
  const reviewer = EMPLOYEE_STUBS.find((e) => e.id === r.reviewer_id);
  const raw = {
    ...r,
    employee: employee ? { ...employee } : undefined,
    reviewer: reviewer ? { ...reviewer } : undefined,
  };
  return performanceReviewDecoder.decode(structuredClone(raw) as unknown);
}

function findReviewOrThrow(id: number): StoredPerformanceReview {
  const row = reviewStore.find((r) => r.id === id);
  if (!row) throw new ApiError('http', `PerformanceReview ${id} not found`, { status: 404 });
  return row;
}

export const mockPerformanceReviewApi: PerformanceReviewApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const filtered = reviewStore.filter((row) => {
      if (params.cycle_id !== undefined && row.cycle_id !== params.cycle_id) return false;
      if (params.review_type !== undefined && row.review_type !== params.review_type) return false;
      if (params.status !== undefined && row.status !== params.status) return false;
      return true;
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const page = filtered.slice(start, start + perPage);

    const wire: PerformanceReviewListWire = {
      data: page.map(reviewToWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return performanceReviewListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = nextReviewId;
    nextReviewId += 1;
    const stamp = new Date().toISOString();
    const row: StoredPerformanceReview = {
      id,
      cycle_id: input.cycle_id,
      employee_id: input.employee_id,
      reviewer_id: input.reviewer_id,
      review_type: input.review_type,
      overall_rating: input.overall_rating ?? undefined,
      strengths: input.strengths ?? undefined,
      improvements: input.improvements ?? undefined,
      comments: input.comments ?? undefined,
      status: input.status ?? undefined,
      submitted_at: input.submitted_at ?? undefined,
      created_at: stamp,
      updated_at: stamp,
    };
    reviewStore = [row, ...reviewStore];
    return performanceReviewDecoder.decode(structuredClone(reviewToWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findReviewOrThrow(id);

    const updated: StoredPerformanceReview = {
      ...row,
      cycle_id: input.cycle_id ?? row.cycle_id,
      employee_id: input.employee_id ?? row.employee_id,
      reviewer_id: input.reviewer_id ?? row.reviewer_id,
      review_type: input.review_type ?? row.review_type,
      overall_rating:
        input.overall_rating === null ? undefined : (input.overall_rating ?? row.overall_rating),
      strengths:
        input.strengths === null ? undefined : (input.strengths ?? row.strengths),
      improvements:
        input.improvements === null ? undefined : (input.improvements ?? row.improvements),
      comments:
        input.comments === null ? undefined : (input.comments ?? row.comments),
      status: input.status === null ? undefined : (input.status ?? row.status),
      submitted_at:
        input.submitted_at === null ? undefined : (input.submitted_at ?? row.submitted_at),
      updated_at: new Date().toISOString(),
    };
    reviewStore = reviewStore.map((r) => (r.id === id ? updated : r));
    return performanceReviewDecoder.decode(structuredClone(reviewToWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    findReviewOrThrow(id);
    reviewStore = reviewStore.filter((r) => r.id !== id);
  },
};
