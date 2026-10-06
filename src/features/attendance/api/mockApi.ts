import { ApiError } from '@/lib/api/errors';
import type { FetchContext } from '@/lib/query';
import { pravatar } from '@/features/dashboard/model';
import { attendanceDecoder, attendanceListDecoder } from './schema';
import type { AttendanceListWire, AttendanceWire } from './schema';
import type { AttendanceApi, AttendanceStatus } from './resource';

/**
 * In-process implementation of `AttendanceApi`, used until the Laravel backend
 * is configured (the default — see `env.useMockApi`).
 *
 * Mirrors `employees/api/mockApi.ts`: it owns real mutable state so a create
 * or delete is a genuine write later reads observe, it adds latency and
 * honours `AbortSignal`, and every response is re-decoded through the same
 * decoders a real HTTP response would go through, so the two transports are
 * indistinguishable to the rest of the app.
 *
 * NOTE: The real backend has no `late` status — lateness is indicated by
 * `late_minutes > 0` on a `present` record. This mock follows the real schema.
 */

interface StoredAttendance {
  id: number;
  employee_id: number;
  work_schedule_id: number;
  date: string;
  check_in?: string | undefined;
  check_out?: string | undefined;
  check_in_method?: 'web' | 'mobile' | 'biometric' | 'qr' | 'manual' | undefined;
  check_out_method?: 'web' | 'mobile' | 'biometric' | 'qr' | 'manual' | undefined;
  regular_hours?: string | undefined;
  overtime_hours?: string | undefined;
  late_minutes?: number | undefined;
  early_leave_minutes?: number | undefined;
  break_minutes?: number | undefined;
  night_hours?: string | undefined;
  status: AttendanceStatus;
  notes?: string | undefined;
  is_corrected?: boolean | undefined;
  corrected_by?: number | undefined;
  created_at?: string | undefined;
}

/**
 * A small in-memory roster of employee stubs so the mock can populate the
 * `employee` relation without importing from the employees mock store.
 * Employee IDs are the same anchor ids used in `employees/api/mockApi.ts`.
 */
const EMPLOYEE_STUBS = [
  { id: 43,  employee_number: 'EMP-00043', first_name: 'Ahmed',   last_name: 'Sami',    photo: pravatar(53) },
  { id: 71,  employee_number: 'EMP-00071', first_name: 'Mona',    last_name: 'Khaled',  photo: pravatar(44) },
  { id: 89,  employee_number: 'EMP-00089', first_name: 'Salma',   last_name: 'Adel',    photo: pravatar(9)  },
  { id: 112, employee_number: 'EMP-00112', first_name: 'Karim',   last_name: 'Fouad',   photo: pravatar(26) },
  { id: 134, employee_number: 'EMP-00134', first_name: 'Layla',   last_name: 'Mostafa', photo: pravatar(47) },
  { id: 158, employee_number: 'EMP-00158', first_name: 'Omar',    last_name: 'Hassan',  photo: pravatar(33) },
  { id: 177, employee_number: 'EMP-00177', first_name: 'Nadia',   last_name: 'Fahmy',   photo: pravatar(21) },
  { id: 203, employee_number: 'EMP-00203', first_name: 'Tamer',   last_name: 'Zakaria', photo: pravatar(13) },
  { id: 1000, employee_number: 'EMP-01000', first_name: 'Ahmed',  last_name: 'Hamdy',   photo: pravatar(15) },
  { id: 1001, employee_number: 'EMP-01001', first_name: 'Mona',   last_name: 'Zakaria', photo: pravatar(22) },
  { id: 1002, employee_number: 'EMP-01002', first_name: 'Salma',  last_name: 'Adel',    photo: pravatar(37) },
  { id: 1003, employee_number: 'EMP-01003', first_name: 'Karim',  last_name: 'Mansour', photo: pravatar(55) },
  { id: 1004, employee_number: 'EMP-01004', first_name: 'Layla',  last_name: 'Hassan',  photo: pravatar(60) },
  { id: 1005, employee_number: 'EMP-01005', first_name: 'Omar',   last_name: 'Fahmy',   photo: pravatar(68) },
] as const;

const EMPLOYEE_IDS = EMPLOYEE_STUBS.map((e) => e.id);

const STATUSES: AttendanceStatus[] = [
  'present', 'present', 'present', 'present', 'present',
  'absent', 'leave', 'half_day', 'holiday', 'weekend',
];
const CHECK_IN_METHODS = ['web', 'mobile', 'biometric', 'qr', 'manual'] as const;

/** Deterministic filler so pagination (and search/filter) has something to page through. */
function generateFiller(count: number, startId: number, baseDate: string): StoredAttendance[] {
  const rows: StoredAttendance[] = [];
  for (let index = 0; index < count; index += 1) {
    const id = startId + index;
    const employeeId = EMPLOYEE_IDS[index % EMPLOYEE_IDS.length];
    // Spread dates around the base date
    const dayOffset = Math.floor(index / EMPLOYEE_IDS.length);
    const d = new Date(baseDate);
    d.setDate(d.getDate() - dayOffset);
    const date = d.toISOString().slice(0, 10);

    const status = STATUSES[index % STATUSES.length];
    const isWorking = status === 'present' || status === 'half_day';
    const lateMinutes = isWorking && index % 5 === 2 ? 15 + (index % 4) * 10 : undefined;
    const checkInHour = 8 + (index % 2);
    const checkInMin = isWorking ? (lateMinutes ? lateMinutes : (index % 10)) : undefined;
    const checkIn = isWorking
      ? `${date} ${String(checkInHour).padStart(2, '0')}:${String(checkInMin ?? 0).padStart(2, '0')}:00`
      : undefined;
    const checkOut = isWorking
      ? `${date} 17:${String(index % 60).padStart(2, '0')}:00`
      : undefined;
    const regularHours = isWorking
      ? (status === 'half_day' ? '4.00' : `${(7 + (index % 3)).toFixed(2)}`)
      : undefined;

    rows.push({
      id,
      employee_id: employeeId,
      work_schedule_id: 1,
      date,
      check_in: checkIn,
      check_out: checkOut,
      check_in_method: isWorking ? CHECK_IN_METHODS[index % CHECK_IN_METHODS.length] : undefined,
      check_out_method: isWorking ? CHECK_IN_METHODS[(index + 2) % CHECK_IN_METHODS.length] : undefined,
      regular_hours: regularHours,
      late_minutes: lateMinutes,
      status,
      is_corrected: false,
      created_at: `${date}T18:00:00.000Z`,
    });
  }
  return rows;
}

const BASE_DATE = '2026-10-06';

function seed(): StoredAttendance[] {
  return generateFiller(42, 1, BASE_DATE);
}

let store: StoredAttendance[] = seed();
let nextId = 1000;

export function resetMockAttendances(): void {
  store = seed();
  nextId = 1000;
}

/** Failure injection for reviewing error/rollback UI; persisted so a reload doesn't "fix" it. */
const FAILURE_RATE_KEY = 'kawdly.attendanceMockFailureRate';

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

export const mockAttendanceApi: AttendanceApi = {
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

    const wire: AttendanceListWire = {
      data: page.map(toWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return attendanceListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = nextId;
    nextId += 1;
    const stamp = new Date().toISOString();
    const row: StoredAttendance = {
      id,
      employee_id: input.employee_id,
      work_schedule_id: input.work_schedule_id,
      date: input.date,
      check_in: input.check_in ?? undefined,
      check_out: input.check_out ?? undefined,
      check_in_method: input.check_in_method ?? undefined,
      check_out_method: input.check_out_method ?? undefined,
      regular_hours: input.regular_hours !== null && input.regular_hours !== undefined ? String(input.regular_hours) : undefined,
      overtime_hours: input.overtime_hours !== null && input.overtime_hours !== undefined ? String(input.overtime_hours) : undefined,
      late_minutes: input.late_minutes ?? undefined,
      early_leave_minutes: input.early_leave_minutes ?? undefined,
      break_minutes: input.break_minutes ?? undefined,
      night_hours: input.night_hours !== null && input.night_hours !== undefined ? String(input.night_hours) : undefined,
      status: input.status,
      notes: input.notes ?? undefined,
      is_corrected: input.is_corrected ?? false,
      corrected_by: input.corrected_by ?? undefined,
      created_at: stamp,
    };
    store = [row, ...store];
    return attendanceDecoder.decode(structuredClone(toWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findOrThrow(id);

    // Explicitly map each field so null clears to undefined and we never
    // spread `null` into a `string | undefined` field.
    const updated: StoredAttendance = {
      id: row.id,
      created_at: row.created_at,
      employee_id: input.employee_id ?? row.employee_id,
      work_schedule_id: input.work_schedule_id ?? row.work_schedule_id,
      date: input.date ?? row.date,
      status: input.status ?? row.status,
      check_in: input.check_in === null ? undefined : (input.check_in ?? row.check_in),
      check_out: input.check_out === null ? undefined : (input.check_out ?? row.check_out),
      check_in_method: input.check_in_method === null ? undefined : (input.check_in_method ?? row.check_in_method),
      check_out_method: input.check_out_method === null ? undefined : (input.check_out_method ?? row.check_out_method),
      notes: input.notes === null ? undefined : (input.notes ?? row.notes),
      regular_hours: input.regular_hours === null
        ? undefined
        : (input.regular_hours !== undefined ? String(input.regular_hours) : row.regular_hours),
      overtime_hours: input.overtime_hours === null
        ? undefined
        : (input.overtime_hours !== undefined ? String(input.overtime_hours) : row.overtime_hours),
      night_hours: input.night_hours === null
        ? undefined
        : (input.night_hours !== undefined ? String(input.night_hours) : row.night_hours),
      late_minutes: input.late_minutes === null ? undefined : (input.late_minutes ?? row.late_minutes),
      early_leave_minutes: input.early_leave_minutes === null ? undefined : (input.early_leave_minutes ?? row.early_leave_minutes),
      break_minutes: input.break_minutes === null ? undefined : (input.break_minutes ?? row.break_minutes),
      is_corrected: input.is_corrected === null ? undefined : (input.is_corrected ?? row.is_corrected),
      corrected_by: input.corrected_by === null ? undefined : (input.corrected_by ?? row.corrected_by),
    };
    store = store.map((item) => (item.id === id ? updated : item));
    return attendanceDecoder.decode(structuredClone(toWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    findOrThrow(id);
    store = store.filter((item) => item.id !== id);
  },
};

function toWire(row: StoredAttendance): AttendanceWire {
  const emp = EMPLOYEE_STUBS.find((e) => e.id === row.employee_id);
  return {
    ...row,
    employee: emp ? { ...emp } : undefined,
  } as unknown as AttendanceWire;
}

function findOrThrow(id: number): StoredAttendance {
  const row = store.find((item) => item.id === id);
  if (!row) throw new ApiError('http', `Attendance ${id} not found`, { status: 404 });
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
