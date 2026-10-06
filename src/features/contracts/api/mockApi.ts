import { ApiError } from '@/lib/api/errors';
import type { FetchContext } from '@/lib/query';
import { contractDecoder, contractListDecoder } from './schema';
import type { ContractListWire, ContractWire } from './schema';
import type { ContractApi, ContractStatus, ContractType } from './resource';

/**
 * In-process implementation of `ContractApi`, used until the Laravel backend
 * is configured (the default — see `env.useMockApi`).
 *
 * Mirrors `employees/api/mockApi.ts`: owns real mutable state so a create or
 * delete is a genuine write later reads observe, adds latency and honours
 * `AbortSignal`, and every response is re-decoded through the same decoders a
 * real HTTP response would go through.
 */

interface StoredContract {
  id: number;
  uuid: string;
  employee_id: number;
  type: ContractType;
  start_date: string;
  end_date?: string | undefined;
  probation_months?: number | undefined;
  basic_salary: number;
  terms?: string | undefined;
  status: ContractStatus;
  signed_at?: string | undefined;
  attachment?: string | undefined;
  parent_contract_id?: number | undefined;
  created_by: number;
  created_at: string;
  updated_at: string;
}

/**
 * Employee ids from the employees mock:
 *  - Anchors: 43, 71, 89, 112, 134, 158, 177, 203
 *  - Filler:  1000..1033  (34 rows, generateFiller(34, 1000))
 * We spread contracts across all 42 employees deterministically.
 */
const EMPLOYEE_IDS = [
  43, 71, 89, 112, 134, 158, 177, 203,
  1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009,
  1010, 1011, 1012, 1013, 1014, 1015, 1016, 1017, 1018, 1019,
  1020, 1021, 1022, 1023, 1024, 1025, 1026, 1027, 1028, 1029,
  1030, 1031, 1032, 1033,
];

const CONTRACT_TYPES: ContractType[] = ['initial', 'initial', 'renewal', 'renewal', 'amendment'];
const CONTRACT_STATUSES: ContractStatus[] = [
  'active', 'active', 'active', 'active',
  'active', 'active',
  'expired', 'expired',
  'draft', 'draft',
  'terminated',
];

const BASIC_SALARIES = [8000, 10000, 12000, 15000, 18000, 22000, 25000, 30000];

/** Anchor contracts that mirror the pre-API mock's visible rows. */
const ANCHORS: StoredContract[] = [
  {
    id: 1, uuid: '00000000-0000-4000-a000-000000000001',
    employee_id: 43, type: 'renewal', start_date: '2024-01-01', end_date: '2026-12-31',
    basic_salary: 22000, status: 'active', created_by: 1,
    created_at: '2024-01-01T08:00:00.000Z', updated_at: '2024-01-01T08:00:00.000Z',
  },
  {
    id: 2, uuid: '00000000-0000-4000-a000-000000000002',
    employee_id: 71, type: 'initial', start_date: '2025-09-01', end_date: '2025-10-14',
    basic_salary: 15000, status: 'active', created_by: 1,
    created_at: '2025-09-01T08:00:00.000Z', updated_at: '2025-09-01T08:00:00.000Z',
  },
  {
    id: 3, uuid: '00000000-0000-4000-a000-000000000003',
    employee_id: 89, type: 'renewal', start_date: '2025-07-01', end_date: '2025-09-28',
    basic_salary: 12000, status: 'expired', created_by: 1,
    created_at: '2025-07-01T08:00:00.000Z', updated_at: '2025-07-01T08:00:00.000Z',
  },
  {
    id: 4, uuid: '00000000-0000-4000-a000-000000000004',
    employee_id: 112, type: 'initial', start_date: '2022-01-20', end_date: '2025-08-20',
    basic_salary: 18000, status: 'expired', created_by: 1,
    created_at: '2022-01-20T08:00:00.000Z', updated_at: '2022-01-20T08:00:00.000Z',
  },
  {
    id: 5, uuid: '00000000-0000-4000-a000-000000000005',
    employee_id: 134, type: 'renewal', start_date: '2025-10-01', end_date: '2027-09-30',
    basic_salary: 25000, status: 'draft', created_by: 1,
    created_at: '2025-10-01T08:00:00.000Z', updated_at: '2025-10-01T08:00:00.000Z',
  },
  {
    id: 6, uuid: '00000000-0000-4000-a000-000000000006',
    employee_id: 158, type: 'initial', start_date: '2024-06-01', end_date: '2026-05-31',
    basic_salary: 10000, status: 'active', created_by: 1,
    created_at: '2024-06-01T08:00:00.000Z', updated_at: '2024-06-01T08:00:00.000Z',
  },
];

/** Deterministic filler so pagination (and search/filter) has something to page through. */
function generateFiller(count: number, startId: number): StoredContract[] {
  const rows: StoredContract[] = [];
  for (let index = 0; index < count; index += 1) {
    const id = startId + index;
    const employeeId = EMPLOYEE_IDS[index % EMPLOYEE_IDS.length];
    const type = CONTRACT_TYPES[index % CONTRACT_TYPES.length];
    const status = CONTRACT_STATUSES[index % CONTRACT_STATUSES.length];
    const salary = BASIC_SALARIES[index % BASIC_SALARIES.length];

    const startYear = 2020 + (index % 6);
    const startMonth = String(1 + (index % 12)).padStart(2, '0');
    const startDay = String(1 + (index % 27)).padStart(2, '0');
    const startDate = `${startYear}-${startMonth}-${startDay}`;

    const endYear = startYear + 1 + (index % 2);
    const endDate = `${endYear}-${startMonth}-${startDay}`;

    rows.push({
      id,
      uuid: `00000000-0000-4000-a000-${String(id).padStart(12, '0')}`,
      employee_id: employeeId,
      type,
      start_date: startDate,
      end_date: endDate,
      basic_salary: salary,
      status,
      created_by: 1,
      created_at: `${startDate}T08:00:00.000Z`,
      updated_at: `${startDate}T08:00:00.000Z`,
    });
  }
  return rows;
}

function seed(): StoredContract[] {
  return [...ANCHORS, ...generateFiller(36, 100)];
}

let store: StoredContract[] = seed();
let nextId = 1000;

export function resetMockContracts(): void {
  store = seed();
  nextId = 1000;
}

/** Failure injection for reviewing error/rollback UI. */
const FAILURE_RATE_KEY = 'kawdly.contractsMockFailureRate';

function readFailureRate(): number {
  const raw = sessionStorage.getItem(FAILURE_RATE_KEY);
  const parsed = Number(raw);
  return raw !== null && Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0;
}

let failureRate = readFailureRate();

export function setMockContractFailureRate(rate: number): void {
  failureRate = Math.min(Math.max(rate, 0), 1);
  sessionStorage.setItem(FAILURE_RATE_KEY, String(failureRate));
}

const READ_LATENCY_MS = 220;
const WRITE_LATENCY_MS = 420;

export const mockContractApi: ContractApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const search = params.search?.trim().toLowerCase();
    const filtered = store.filter((row) => {
      if (params.status && row.status !== params.status) return false;
      if (params.employeeId && row.employee_id !== params.employeeId) return false;
      if (!search) return true;
      // Search matches employee_id (as string) and contract id; in the real
      // API search would match on the employee's name — this is close enough
      // for the mock to be useful.
      const haystack = `${row.employee_id} ${row.id} ${row.type} ${row.status}`;
      return haystack.includes(search);
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const page = filtered.slice(start, start + perPage);

    const wire: ContractListWire = {
      data: page.map(toWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return contractListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = nextId;
    nextId += 1;
    const stamp = new Date().toISOString();
    const startDate = input.start_date;

    const row: StoredContract = {
      id,
      uuid: `00000000-0000-4000-a000-${String(id).padStart(12, '0')}`,
      employee_id: input.employee_id,
      type: input.type,
      start_date: startDate,
      end_date: input.end_date ?? undefined,
      probation_months: input.probation_months ?? undefined,
      basic_salary: input.basic_salary,
      terms: input.terms ?? undefined,
      status: input.status ?? 'draft',
      signed_at: input.signed_at ?? undefined,
      attachment: input.attachment ?? undefined,
      parent_contract_id: input.parent_contract_id ?? undefined,
      created_by: input.created_by,
      created_at: stamp,
      updated_at: stamp,
    };
    store = [row, ...store];
    return contractDecoder.decode(structuredClone(toWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findOrThrow(id);

    const updated: StoredContract = {
      ...row,
      ...stripUndefined(input),
      // nullable fields: null means "clear to undefined"; undefined means "keep current value"
      end_date: input.end_date === null ? undefined : (input.end_date ?? row.end_date),
      probation_months: input.probation_months === null ? undefined : (input.probation_months ?? row.probation_months),
      terms: input.terms === null ? undefined : (input.terms ?? row.terms),
      signed_at: input.signed_at === null ? undefined : (input.signed_at ?? row.signed_at),
      attachment: input.attachment === null ? undefined : (input.attachment ?? row.attachment),
      parent_contract_id: input.parent_contract_id === null ? undefined : (input.parent_contract_id ?? row.parent_contract_id),
      // status: null from the wire means keep existing
      status: input.status === null || input.status === undefined ? row.status : input.status,
      updated_at: new Date().toISOString(),
    };
    store = store.map((item) => (item.id === id ? updated : item));
    return contractDecoder.decode(structuredClone(toWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    findOrThrow(id);
    store = store.filter((item) => item.id !== id);
  },
};

function toWire(row: StoredContract): ContractWire {
  return {
    ...row,
    // The mock doesn't have a full employee store to join against, so we
    // synthesise a minimal employee ref from the known anchor ids and a
    // generic fallback for filler rows.
    employee: {
      id: row.employee_id,
      employee_number: `EMP-${String(row.employee_id).padStart(5, '0')}`,
      first_name: firstNameFor(row.employee_id),
      last_name: lastNameFor(row.employee_id),
    },
  } as unknown as ContractWire;
}

/** Deterministic first-name lookup matching `employees/api/mockApi.ts` FIRST_NAMES_EN order. */
const FIRST_NAMES = [
  'Ahmed', 'Mona', 'Salma', 'Karim', 'Layla', 'Omar', 'Nadia', 'Tamer',
  'Youssef', 'Hana', 'Khaled', 'Dina', 'Mahmoud', 'Rania', 'Amr',
  'Farida', 'Hassan', 'Yasmin', 'Tarek', 'Noura',
];
const LAST_NAMES = [
  'Sami', 'Khaled', 'Adel', 'Fouad', 'Mostafa', 'Hassan', 'Fahmy', 'Zakaria',
  'Said', 'Ibrahim', 'Mansour', 'Ali', 'Saleh', 'Gamal', 'Nabil',
  'Abdallah', 'Farouk', 'Hamdy', 'Shawky', 'Rashad',
];

/** Maps anchor ids to their known names; filler falls back to the arrays. */
const ANCHOR_NAMES: Record<number, [string, string]> = {
  43:  ['Ahmed',   'Sami'],
  71:  ['Mona',    'Khaled'],
  89:  ['Salma',   'Adel'],
  112: ['Karim',   'Fouad'],
  134: ['Layla',   'Mostafa'],
  158: ['Omar',    'Hassan'],
  177: ['Nadia',   'Fahmy'],
  203: ['Tamer',   'Zakaria'],
};

function firstNameFor(employeeId: number): string {
  return ANCHOR_NAMES[employeeId]?.[0] ?? FIRST_NAMES[employeeId % FIRST_NAMES.length];
}

function lastNameFor(employeeId: number): string {
  return ANCHOR_NAMES[employeeId]?.[1] ?? LAST_NAMES[(employeeId + 7) % LAST_NAMES.length];
}

function findOrThrow(id: number): StoredContract {
  const row = store.find((item) => item.id === id);
  if (!row) throw new ApiError('http', `Contract ${id} not found`, { status: 404 });
  return row;
}

function stripUndefined<T extends object>(input: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
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
