import { ApiError } from '@/lib/api/errors';
import type { FetchContext } from '@/lib/query';
import { pravatar } from '@/features/dashboard/model';
import { loanDecoder, loanListDecoder } from './schema';
import type { LoanListWire, LoanWire } from './schema';
import type { LoanApi, LoanStatus, LoanType } from './resource';

/**
 * In-process implementation of `LoanApi`, used until the Laravel backend is
 * configured (the default — see `env.useMockApi`).
 *
 * Mirrors `attendance/api/mockApi.ts`: owns real mutable state so a create or
 * delete is a genuine write later reads observe, adds latency and honours
 * `AbortSignal`, and every response is re-decoded through the same decoders a
 * real HTTP response would go through.
 *
 * NOTE: The real backend has no `defaulted` status. The old mock had it as
 * a UI-only fabrication; it has been dropped entirely.
 */

interface StoredLoan {
  id: number;
  uuid: string;
  employee_id: number;
  type: LoanType;
  amount: number;
  installment_amount: number;
  total_installments: number;
  paid_installments?: number | undefined;
  remaining_amount: number;
  start_date: string;
  status?: LoanStatus | undefined;
  reason?: string | undefined;
  approved_by?: number | undefined;
  approved_at?: string | undefined;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}

/**
 * Employee stubs matching the anchor ids used in `attendance/api/mockApi.ts`.
 * IDs are stable across features so cross-feature queries produce consistent names.
 */
const EMPLOYEE_STUBS = [
  { id: 43,   employee_number: 'EMP-00043', first_name: 'Ahmed',   last_name: 'Sami',    photo: pravatar(53) },
  { id: 71,   employee_number: 'EMP-00071', first_name: 'Mona',    last_name: 'Khaled',  photo: pravatar(44) },
  { id: 89,   employee_number: 'EMP-00089', first_name: 'Salma',   last_name: 'Adel',    photo: pravatar(9)  },
  { id: 112,  employee_number: 'EMP-00112', first_name: 'Karim',   last_name: 'Fouad',   photo: pravatar(26) },
  { id: 134,  employee_number: 'EMP-00134', first_name: 'Layla',   last_name: 'Mostafa', photo: pravatar(47) },
  { id: 158,  employee_number: 'EMP-00158', first_name: 'Omar',    last_name: 'Hassan',  photo: pravatar(33) },
  { id: 177,  employee_number: 'EMP-00177', first_name: 'Nadia',   last_name: 'Fahmy',   photo: pravatar(21) },
  { id: 203,  employee_number: 'EMP-00203', first_name: 'Tamer',   last_name: 'Zakaria', photo: pravatar(13) },
  { id: 1000, employee_number: 'EMP-01000', first_name: 'Ahmed',   last_name: 'Hamdy',   photo: pravatar(15) },
  { id: 1001, employee_number: 'EMP-01001', first_name: 'Mona',    last_name: 'Zakaria', photo: pravatar(22) },
  { id: 1002, employee_number: 'EMP-01002', first_name: 'Salma',   last_name: 'Adel',    photo: pravatar(37) },
  { id: 1003, employee_number: 'EMP-01003', first_name: 'Karim',   last_name: 'Mansour', photo: pravatar(55) },
] as const;

const EMPLOYEE_IDS = EMPLOYEE_STUBS.map((e) => e.id);

const LOAN_TYPES: LoanType[] = ['loan', 'loan', 'loan', 'advance', 'advance'];
const LOAN_STATUSES: LoanStatus[] = [
  'active', 'active', 'active', 'active',
  'active', 'active',
  'pending', 'pending', 'pending',
  'completed', 'completed',
  'cancelled',
];

const AMOUNTS = [10000, 15000, 20000, 25000, 30000, 40000, 50000, 75000];
const REASONS = [
  'Medical expenses',
  'Home renovation',
  'Education fees',
  'Emergency funds',
  'Car purchase',
  undefined,
  undefined,
];

/** Anchor records that mirror the pre-API mock's visible rows. */
const ANCHORS: StoredLoan[] = [
  {
    id: 1,
    uuid: '00000000-0000-4000-b000-000000000001',
    employee_id: 43,
    type: 'loan',
    amount: 50000,
    installment_amount: 2500,
    total_installments: 24,
    paid_installments: 12,
    remaining_amount: 30000,
    start_date: '2025-10-01',
    status: 'active',
    reason: 'Home renovation',
    created_at: '2025-10-01T08:00:00.000Z',
    updated_at: '2025-10-01T08:00:00.000Z',
  },
  {
    id: 2,
    uuid: '00000000-0000-4000-b000-000000000002',
    employee_id: 71,
    type: 'advance',
    amount: 8000,
    installment_amount: 2000,
    total_installments: 4,
    paid_installments: 3,
    remaining_amount: 2000,
    start_date: '2026-07-01',
    status: 'active',
    created_at: '2026-07-01T08:00:00.000Z',
    updated_at: '2026-07-01T08:00:00.000Z',
  },
  {
    id: 3,
    uuid: '00000000-0000-4000-b000-000000000003',
    employee_id: 112,
    type: 'loan',
    amount: 30000,
    installment_amount: 1500,
    total_installments: 20,
    paid_installments: 20,
    remaining_amount: 0,
    start_date: '2025-02-01',
    status: 'completed',
    created_at: '2025-02-01T08:00:00.000Z',
    updated_at: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 4,
    uuid: '00000000-0000-4000-b000-000000000004',
    employee_id: 158,
    type: 'loan',
    amount: 75000,
    installment_amount: 3125,
    total_installments: 36,
    paid_installments: 2,
    remaining_amount: 69750,
    start_date: '2026-10-01',
    status: 'pending',
    reason: 'Car purchase',
    created_at: '2026-09-15T08:00:00.000Z',
    updated_at: '2026-09-15T08:00:00.000Z',
  },
  {
    id: 5,
    uuid: '00000000-0000-4000-b000-000000000005',
    employee_id: 134,
    type: 'advance',
    amount: 5000,
    installment_amount: 2500,
    total_installments: 2,
    paid_installments: 1,
    remaining_amount: 2500,
    start_date: '2026-09-01',
    status: 'active',
    created_at: '2026-09-01T08:00:00.000Z',
    updated_at: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 6,
    uuid: '00000000-0000-4000-b000-000000000006',
    employee_id: 89,
    type: 'loan',
    amount: 20000,
    installment_amount: 1000,
    total_installments: 24,
    paid_installments: 0,
    remaining_amount: 20000,
    start_date: '2026-11-01',
    status: 'pending',
    reason: 'Education fees',
    created_at: '2026-10-01T08:00:00.000Z',
    updated_at: '2026-10-01T08:00:00.000Z',
  },
];

/** Deterministic filler so pagination has something to page through. */
function generateFiller(count: number, startId: number): StoredLoan[] {
  const rows: StoredLoan[] = [];
  for (let index = 0; index < count; index += 1) {
    const id = startId + index;
    const employeeId = EMPLOYEE_IDS[index % EMPLOYEE_IDS.length];
    const type = LOAN_TYPES[index % LOAN_TYPES.length];
    const status = LOAN_STATUSES[index % LOAN_STATUSES.length];
    const amount = AMOUNTS[index % AMOUNTS.length];

    const startYear = 2024 + (index % 3);
    const startMonth = String(1 + (index % 12)).padStart(2, '0');
    const startDate = `${startYear}-${startMonth}-01`;

    const totalInstallments = type === 'advance' ? 2 + (index % 4) : 12 + (index % 25);
    const paidInstallments =
      status === 'completed'
        ? totalInstallments
        : status === 'pending'
          ? 0
          : Math.floor(totalInstallments * (0.2 + (index % 7) * 0.1));
    const installmentAmount = Math.round(amount / totalInstallments);
    const remainingAmount = Math.max(0, amount - paidInstallments * installmentAmount);
    const reason = REASONS[index % REASONS.length];

    rows.push({
      id,
      uuid: `00000000-0000-4000-b000-${String(id).padStart(12, '0')}`,
      employee_id: employeeId,
      type,
      amount,
      installment_amount: installmentAmount,
      total_installments: totalInstallments,
      paid_installments: paidInstallments,
      remaining_amount: remainingAmount,
      start_date: startDate,
      status,
      reason,
      created_at: `${startDate}T08:00:00.000Z`,
      updated_at: `${startDate}T08:00:00.000Z`,
    });
  }
  return rows;
}

function seed(): StoredLoan[] {
  return [...ANCHORS, ...generateFiller(18, 100)];
}

let store: StoredLoan[] = seed();
let nextId = 1000;

export function resetMockLoans(): void {
  store = seed();
  nextId = 1000;
}

/** Failure injection for reviewing error/rollback UI. */
const FAILURE_RATE_KEY = 'kawdly.loansMockFailureRate';

function readFailureRate(): number {
  const raw = sessionStorage.getItem(FAILURE_RATE_KEY);
  const parsed = Number(raw);
  return raw !== null && Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0;
}

let failureRate = readFailureRate();

export function setMockLoanFailureRate(rate: number): void {
  failureRate = Math.min(Math.max(rate, 0), 1);
  sessionStorage.setItem(FAILURE_RATE_KEY, String(failureRate));
}

const READ_LATENCY_MS = 220;
const WRITE_LATENCY_MS = 420;

export const mockLoanApi: LoanApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const search = params.search?.trim().toLowerCase();
    const filtered = store.filter((row) => {
      if (params.status && row.status !== params.status) return false;
      if (params.employeeId && row.employee_id !== params.employeeId) return false;
      if (!search) return true;
      const emp = EMPLOYEE_STUBS.find((e) => e.id === row.employee_id);
      if (!emp) return false;
      const haystack = `${emp.first_name} ${emp.last_name} ${emp.employee_number}`.toLowerCase();
      return haystack.includes(search);
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const page = filtered.slice(start, start + perPage);

    const wire: LoanListWire = {
      data: page.map(toWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return loanListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = nextId;
    nextId += 1;
    const stamp = new Date().toISOString();

    const row: StoredLoan = {
      id,
      uuid: `00000000-0000-4000-b000-${String(id).padStart(12, '0')}`,
      employee_id: input.employee_id,
      type: input.type,
      amount: input.amount,
      installment_amount: input.installment_amount,
      total_installments: input.total_installments,
      paid_installments: input.paid_installments ?? undefined,
      remaining_amount: input.remaining_amount,
      start_date: input.start_date,
      status: input.status ?? 'pending',
      reason: input.reason ?? undefined,
      approved_by: input.approved_by ?? undefined,
      approved_at: input.approved_at ?? undefined,
      created_at: stamp,
      updated_at: stamp,
    };
    store = [row, ...store];
    return loanDecoder.decode(structuredClone(toWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findOrThrow(id);

    const updated: StoredLoan = {
      id: row.id,
      uuid: row.uuid,
      created_at: row.created_at,
      employee_id: input.employee_id ?? row.employee_id,
      type: input.type ?? row.type,
      amount: input.amount ?? row.amount,
      installment_amount: input.installment_amount ?? row.installment_amount,
      total_installments: input.total_installments ?? row.total_installments,
      paid_installments:
        input.paid_installments === null
          ? undefined
          : (input.paid_installments ?? row.paid_installments),
      remaining_amount: input.remaining_amount ?? row.remaining_amount,
      start_date: input.start_date ?? row.start_date,
      status:
        input.status === null || input.status === undefined ? row.status : input.status,
      reason: input.reason === null ? undefined : (input.reason ?? row.reason),
      approved_by:
        input.approved_by === null ? undefined : (input.approved_by ?? row.approved_by),
      approved_at:
        input.approved_at === null ? undefined : (input.approved_at ?? row.approved_at),
      updated_at: new Date().toISOString(),
    };
    store = store.map((item) => (item.id === id ? updated : item));
    return loanDecoder.decode(structuredClone(toWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    findOrThrow(id);
    store = store.filter((item) => item.id !== id);
  },

  async approve(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findOrThrow(id);
    if (row.status !== 'pending') {
      throw new ApiError('http', `Loan ${id} is not pending approval`, { status: 422 });
    }
    const updated: StoredLoan = {
      ...row,
      status: 'active',
      approved_by: 1,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store = store.map((item) => (item.id === id ? updated : item));
    return loanDecoder.decode(structuredClone(toWire(updated)));
  },
};

function toWire(row: StoredLoan): LoanWire {
  const emp = EMPLOYEE_STUBS.find((e) => e.id === row.employee_id);
  return {
    ...row,
    employee: emp ? { ...emp } : undefined,
  } as unknown as LoanWire;
}

function findOrThrow(id: number): StoredLoan {
  const row = store.find((item) => item.id === id);
  if (!row) throw new ApiError('http', `Loan ${id} not found`, { status: 404 });
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
