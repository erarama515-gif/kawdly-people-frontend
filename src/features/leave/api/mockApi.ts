import { ApiError } from '@/lib/api/errors';
import type { FetchContext } from '@/lib/query';
import { pravatar } from '@/features/dashboard/model';
import { leaveRequestDecoder, leaveRequestListDecoder } from './schema';
import type { LeaveRequestListWire, LeaveRequestWire, LeaveTypeWire } from './schema';
import type { LeaveRequestApi, LeaveRequestStatus } from './resource';

/**
 * In-process implementation of `LeaveRequestApi`, used until the Laravel backend
 * is configured (the default — see `env.useMockApi`).
 *
 * Mirrors `employees/api/mockApi.ts`: it owns real mutable state so a create
 * or delete is a genuine write later reads observe, it adds latency and
 * honours `AbortSignal`, and every response is re-decoded through the same
 * decoders a real HTTP response would go through, so the two transports are
 * indistinguishable to the rest of the app.
 */

// ─── Mock leave types (what the /leave-types endpoint would return) ───────────

export const MOCK_LEAVE_TYPES: LeaveTypeWire[] = [
  { id: 1, name: 'Annual Leave', code: 'AL', color: '#0ea5e9', is_paid: 1, is_active: 1 },
  { id: 2, name: 'Sick Leave', code: 'SL', color: '#ef4444', is_paid: 1, is_active: 1 },
  { id: 3, name: 'Emergency Leave', code: 'EL', color: '#f59e0b', is_paid: 1, is_active: 1 },
  { id: 4, name: 'Unpaid Leave', code: 'UL', color: '#6b7280', is_paid: 0, is_active: 1 },
  { id: 5, name: 'Maternity Leave', code: 'ML', color: '#a855f7', is_paid: 1, is_active: 1 },
];

// ─── Internal store shape ─────────────────────────────────────────────────────

interface StoredLeaveRequest {
  id: number;
  uuid: string;
  employee_id: number;
  leave_type_id: number;
  start_date: string;
  end_date: string;
  days: string;
  is_half_day?: number | undefined;
  half_day_period?: string | undefined;
  reason?: string | undefined;
  attachment?: string | undefined;
  status: LeaveRequestStatus;
  substitute_employee_id?: number | undefined;
  rejection_reason?: string | undefined;
  cancelled_at?: string | undefined;
  created_at: string;
  updated_at: string;
}

// Employee id → name/photo mapping (matches the anchor employees in employees/api/mockApi.ts)
interface EmployeeRef {
  id: number;
  first_name: string;
  last_name: string;
  employee_number: string;
  photo?: string | undefined;
}

const EMPLOYEE_REFS: EmployeeRef[] = [
  { id: 43,  first_name: 'Ahmed',   last_name: 'Sami',    employee_number: 'EMP-00043', photo: pravatar(53) },
  { id: 71,  first_name: 'Mona',    last_name: 'Khaled',  employee_number: 'EMP-00071', photo: pravatar(44) },
  { id: 89,  first_name: 'Salma',   last_name: 'Adel',    employee_number: 'EMP-00089', photo: pravatar(9)  },
  { id: 112, first_name: 'Karim',   last_name: 'Fouad',   employee_number: 'EMP-00112', photo: pravatar(26) },
  { id: 134, first_name: 'Layla',   last_name: 'Mostafa', employee_number: 'EMP-00134', photo: pravatar(47) },
  { id: 158, first_name: 'Omar',    last_name: 'Hassan',  employee_number: 'EMP-00158', photo: pravatar(33) },
  { id: 177, first_name: 'Nadia',   last_name: 'Fahmy',   employee_number: 'EMP-00177', photo: pravatar(21) },
  { id: 203, first_name: 'Tamer',   last_name: 'Zakaria', employee_number: 'EMP-00203', photo: pravatar(13) },
];

const LEAVE_REASONS = [
  'Family vacation',
  'Medical appointment',
  'Family emergency',
  'Personal travel',
  'Medical procedure',
  'Maternity leave',
  'Annual holiday',
  'Sick leave',
  'Child care',
  'Home emergency',
  'Wedding ceremony',
  'Bereavement',
];

const STATUSES: LeaveRequestStatus[] = [
  'pending', 'pending', 'approved', 'approved', 'approved', 'rejected',
];

/** Deterministic filler so pagination has something to page through. */
function generateFiller(count: number, startId: number): StoredLeaveRequest[] {
  const rows: StoredLeaveRequest[] = [];
  for (let index = 0; index < count; index += 1) {
    const id = startId + index;
    const empRef = EMPLOYEE_REFS[index % EMPLOYEE_REFS.length];
    const leaveTypeId = (index % MOCK_LEAVE_TYPES.length) + 1;
    const year = 2025 + Math.floor(index / 12);
    const month = String(1 + (index % 12)).padStart(2, '0');
    const startDay = String(1 + (index % 20)).padStart(2, '0');
    const daysCount = 1 + (index % 7);
    const startDate = `${year}-${month}-${startDay}`;
    // Simple end-date: add daysCount days
    const startMs = new Date(startDate).getTime();
    const endDate = new Date(startMs + (daysCount - 1) * 86400000).toISOString().slice(0, 10);
    const stamp = `${startDate}T08:00:00.000Z`;
    const status = STATUSES[index % STATUSES.length];

    rows.push({
      id,
      uuid: `00000000-0000-4000-b000-${String(id).padStart(12, '0')}`,
      employee_id: empRef.id,
      leave_type_id: leaveTypeId,
      start_date: startDate,
      end_date: endDate,
      days: String(daysCount) + '.0',
      reason: LEAVE_REASONS[index % LEAVE_REASONS.length],
      status,
      rejection_reason: status === 'rejected' ? 'Insufficient leave balance' : undefined,
      created_at: stamp,
      updated_at: stamp,
    });
  }
  return rows;
}

/** The original anchor rows drawn from the static `data.ts` mock. */
function makeAnchors(): StoredLeaveRequest[] {
  return [
    {
      id: 1, uuid: '00000000-0000-4000-b000-000000000001',
      employee_id: 43, leave_type_id: 1,
      start_date: '2026-10-02', end_date: '2026-10-06', days: '5.0',
      reason: 'Family vacation', status: 'pending',
      created_at: '2026-09-25T08:00:00.000Z', updated_at: '2026-09-25T08:00:00.000Z',
    },
    {
      id: 2, uuid: '00000000-0000-4000-b000-000000000002',
      employee_id: 71, leave_type_id: 2,
      start_date: '2026-09-30', end_date: '2026-10-01', days: '2.0',
      reason: 'Medical appointment', status: 'approved',
      created_at: '2026-09-28T08:00:00.000Z', updated_at: '2026-09-30T08:00:00.000Z',
    },
    {
      id: 3, uuid: '00000000-0000-4000-b000-000000000003',
      employee_id: 158, leave_type_id: 3,
      start_date: '2026-09-30', end_date: '2026-09-30', days: '1.0',
      reason: 'Family emergency', status: 'approved',
      created_at: '2026-09-30T06:00:00.000Z', updated_at: '2026-09-30T08:00:00.000Z',
    },
    {
      id: 4, uuid: '00000000-0000-4000-b000-000000000004',
      employee_id: 134, leave_type_id: 1,
      start_date: '2026-10-05', end_date: '2026-10-09', days: '5.0',
      reason: 'Personal travel', status: 'pending',
      created_at: '2026-09-29T08:00:00.000Z', updated_at: '2026-09-29T08:00:00.000Z',
    },
    {
      id: 5, uuid: '00000000-0000-4000-b000-000000000005',
      employee_id: 112, leave_type_id: 2,
      start_date: '2026-09-28', end_date: '2026-09-29', days: '2.0',
      reason: 'Medical procedure', status: 'rejected',
      rejection_reason: 'Insufficient sick leave balance',
      created_at: '2026-09-26T08:00:00.000Z', updated_at: '2026-09-28T08:00:00.000Z',
    },
    {
      id: 6, uuid: '00000000-0000-4000-b000-000000000006',
      employee_id: 177, leave_type_id: 5,
      start_date: '2026-10-01', end_date: '2026-12-31', days: '90.0',
      reason: 'Maternity leave', status: 'approved',
      created_at: '2026-09-15T08:00:00.000Z', updated_at: '2026-09-20T08:00:00.000Z',
    },
  ];
}

function seed(): StoredLeaveRequest[] {
  return [...makeAnchors(), ...generateFiller(22, 100)];
}

let store: StoredLeaveRequest[] = seed();
let nextId = 1000;

export function resetMockLeaveRequests(): void {
  store = seed();
  nextId = 1000;
}

/** Failure injection for reviewing error/rollback UI. */
const FAILURE_RATE_KEY = 'kawdly.leaveRequestsMockFailureRate';

function readFailureRate(): number {
  const raw = sessionStorage.getItem(FAILURE_RATE_KEY);
  const parsed = Number(raw);
  return raw !== null && Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0;
}

let failureRate = readFailureRate();

export function setMockLeaveFailureRate(rate: number): void {
  failureRate = Math.min(Math.max(rate, 0), 1);
  sessionStorage.setItem(FAILURE_RATE_KEY, String(failureRate));
}

const READ_LATENCY_MS = 220;
const WRITE_LATENCY_MS = 420;

export const mockLeaveRequestApi: LeaveRequestApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const filtered = store.filter((row) => {
      if (params.status && row.status !== params.status) return false;
      if (params.employeeId && row.employee_id !== params.employeeId) return false;
      if (params.leaveTypeId && row.leave_type_id !== params.leaveTypeId) return false;
      if (params.search) {
        const search = params.search.trim().toLowerCase();
        const emp = EMPLOYEE_REFS.find((e) => e.id === row.employee_id);
        if (!emp) return false;
        const haystack = `${emp.first_name} ${emp.last_name} ${emp.employee_number}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const page = filtered.slice(start, start + perPage);

    const wire: LeaveRequestListWire = {
      data: page.map(toWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return leaveRequestListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = nextId;
    nextId += 1;
    const stamp = new Date().toISOString();
    const row: StoredLeaveRequest = {
      id,
      uuid: `00000000-0000-4000-b000-${String(id).padStart(12, '0')}`,
      employee_id: input.employee_id,
      leave_type_id: input.leave_type_id,
      start_date: input.start_date,
      end_date: input.end_date,
      days: String(input.days) + '.0',
      is_half_day: input.is_half_day ? 1 : undefined,
      half_day_period: input.half_day_period ?? undefined,
      reason: input.reason ?? undefined,
      attachment: input.attachment ?? undefined,
      status: (input.status as LeaveRequestStatus | undefined) ?? 'pending',
      substitute_employee_id: input.substitute_employee_id ?? undefined,
      created_at: stamp,
      updated_at: stamp,
    };
    store = [row, ...store];
    return leaveRequestDecoder.decode(structuredClone(toWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findOrThrow(id);

    const updated: StoredLeaveRequest = {
      ...row,
      employee_id: input.employee_id ?? row.employee_id,
      leave_type_id: input.leave_type_id ?? row.leave_type_id,
      start_date: input.start_date ?? row.start_date,
      end_date: input.end_date ?? row.end_date,
      days: input.days !== undefined ? String(input.days) + '.0' : row.days,
      is_half_day: input.is_half_day === null ? undefined : (input.is_half_day !== undefined ? (input.is_half_day ? 1 : 0) : row.is_half_day),
      half_day_period: input.half_day_period === null ? undefined : (input.half_day_period ?? row.half_day_period),
      reason: input.reason === null ? undefined : (input.reason ?? row.reason),
      attachment: input.attachment === null ? undefined : (input.attachment ?? row.attachment),
      status: (input.status as LeaveRequestStatus | null | undefined) === null ? row.status : ((input.status as LeaveRequestStatus | undefined) ?? row.status),
      substitute_employee_id: input.substitute_employee_id === null ? undefined : (input.substitute_employee_id ?? row.substitute_employee_id),
      updated_at: new Date().toISOString(),
    };
    store = store.map((item) => (item.id === id ? updated : item));
    return leaveRequestDecoder.decode(structuredClone(toWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    findOrThrow(id);
    store = store.filter((item) => item.id !== id);
  },

  async approve(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findOrThrow(id);
    const updated: StoredLeaveRequest = { ...row, status: 'approved', updated_at: new Date().toISOString() };
    store = store.map((item) => (item.id === id ? updated : item));
    return leaveRequestDecoder.decode(structuredClone(toWire(updated)));
  },

  async reject(context, id, rejectionReason) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findOrThrow(id);
    const updated: StoredLeaveRequest = {
      ...row,
      status: 'rejected',
      rejection_reason: rejectionReason ?? undefined,
      updated_at: new Date().toISOString(),
    };
    store = store.map((item) => (item.id === id ? updated : item));
    return leaveRequestDecoder.decode(structuredClone(toWire(updated)));
  },

  async listLeaveTypes(context) {
    await simulate(context, READ_LATENCY_MS);
    return structuredClone(MOCK_LEAVE_TYPES);
  },
};

function toWire(row: StoredLeaveRequest): LeaveRequestWire {
  const emp = EMPLOYEE_REFS.find((e) => e.id === row.employee_id);
  const leaveType = MOCK_LEAVE_TYPES.find((lt) => lt.id === row.leave_type_id);
  return {
    ...row,
    employee: emp
      ? { id: emp.id, first_name: emp.first_name, last_name: emp.last_name, employee_number: emp.employee_number, photo: emp.photo }
      : undefined,
    leaveType: leaveType ? { id: leaveType.id, name: leaveType.name, color: leaveType.color } : undefined,
  } as unknown as LeaveRequestWire;
}

function findOrThrow(id: number): StoredLeaveRequest {
  const row = store.find((item) => item.id === id);
  if (!row) throw new ApiError('http', `LeaveRequest ${id} not found`, { status: 404 });
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
