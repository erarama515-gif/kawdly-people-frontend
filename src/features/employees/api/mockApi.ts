import { ApiError } from '@/lib/api/errors';
import type { FetchContext } from '@/lib/query';
import { pravatar } from '@/features/dashboard/model';
import { BRANCHES, COMPANY_ID, DEPARTMENTS, JOB_GRADES, JOB_POSITIONS } from '../orgLookup';
import { employeeDecoder, employeeListDecoder } from './schema';
import type { EmployeeListWire, EmployeeWire } from './schema';
import type { EmployeeApi, EmployeeStatus } from './resource';

/**
 * In-process implementation of `EmployeeApi`, used until the Laravel backend
 * is configured (the default — see `env.useMockApi`).
 *
 * Mirrors `dashboard/api/mockApi.ts`: it owns real mutable state so a create
 * or delete is a genuine write later reads observe, it adds latency and
 * honours `AbortSignal`, and every response is re-decoded through the same
 * decoders a real HTTP response would go through, so the two transports are
 * indistinguishable to the rest of the app.
 */

interface StoredEmployee {
  id: number;
  uuid: string;
  company_id: number;
  employee_number: string;
  first_name: string;
  last_name: string;
  first_name_ar?: string | undefined;
  last_name_ar?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  photo?: string | undefined;
  gender?: 'male' | 'female' | undefined;
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed' | undefined;
  branch_id: number;
  department_id: number;
  job_position_id: number;
  job_grade_id?: number | undefined;
  job_level_id?: number | undefined;
  direct_manager_id?: number | undefined;
  joining_date: string;
  employment_type: 'full_time' | 'part_time' | 'contract' | 'intern';
  work_location: 'office' | 'remote' | 'hybrid';
  status: EmployeeStatus;
  termination_date?: string | undefined;
  termination_reason?: string | undefined;
  created_at: string;
  updated_at: string;
}

const FIRST_NAMES_EN = [
  'Ahmed', 'Mona', 'Salma', 'Karim', 'Layla', 'Omar', 'Nadia', 'Tamer', 'Youssef', 'Hana',
  'Khaled', 'Dina', 'Mahmoud', 'Rania', 'Amr', 'Farida', 'Hassan', 'Yasmin', 'Tarek', 'Noura',
] as const;
const LAST_NAMES_EN = [
  'Sami', 'Khaled', 'Adel', 'Fouad', 'Mostafa', 'Hassan', 'Fahmy', 'Zakaria', 'Said', 'Ibrahim',
  'Mansour', 'Ali', 'Saleh', 'Gamal', 'Nabil', 'Abdallah', 'Farouk', 'Hamdy', 'Shawky', 'Rashad',
] as const;

const BRANCH_IDS = [1, 2, 3];
const STATUSES: EmployeeStatus[] = ['active', 'active', 'active', 'on_leave', 'suspended', 'terminated', 'resigned'];
const EMPLOYMENT_TYPES = ['full_time', 'full_time', 'full_time', 'part_time', 'contract', 'intern'] as const;
const WORK_LOCATIONS = ['office', 'office', 'remote', 'hybrid'] as const;

/** The original 8 anchor rows from the pre-API mock, now wired to real org ids. */
const ANCHORS: StoredEmployee[] = [
  anchor(43, 'Ahmed', 'Sami', 'أحمد سامي', 'a.sami@kawdly.com', 3, 4, 'active', '2021-03-15', 1, 53),
  anchor(71, 'Mona', 'Khaled', 'منى خالد', 'm.khaled@kawdly.com', 6, 10, 'active', '2020-09-01', 1, 44),
  anchor(89, 'Salma', 'Adel', 'سلمى عادل', 's.adel@kawdly.com', 4, 7, 'on_leave', '2019-06-10', 1, 9),
  anchor(112, 'Karim', 'Fouad', 'كريم فؤاد', 'k.fouad@kawdly.com', 3, 5, 'active', '2022-01-20', 1, 26),
  anchor(134, 'Layla', 'Mostafa', 'ليلى مصطفى', 'l.mostafa@kawdly.com', 5, 9, 'active', '2020-11-03', 1, 47),
  anchor(158, 'Omar', 'Hassan', 'عمر حسن', 'o.hassan@kawdly.com', 1, 1, 'suspended', '2021-07-14', 2, 33),
  anchor(177, 'Nadia', 'Fahmy', 'نادية فهمي', 'n.fahmy@kawdly.com', 7, 12, 'active', '2018-04-22', 1, 21),
  anchor(203, 'Tamer', 'Zakaria', 'تامر زكريا', 't.zakaria@kawdly.com', 2, 13, 'terminated', '2017-09-05', 3, 13),
];

function anchor(
  numberSuffix: number,
  firstName: string,
  lastName: string,
  firstNameAr: string,
  email: string,
  departmentId: number,
  jobPositionId: number,
  status: EmployeeStatus,
  joiningDate: string,
  branchId: number,
  photoId: number,
): StoredEmployee {
  const [ar1, ar2] = firstNameAr.split(' ');
  return {
    id: numberSuffix,
    uuid: `00000000-0000-4000-8000-${String(numberSuffix).padStart(12, '0')}`,
    company_id: COMPANY_ID,
    employee_number: `EMP-${String(numberSuffix).padStart(5, '0')}`,
    first_name: firstName,
    last_name: lastName,
    first_name_ar: ar1,
    last_name_ar: ar2,
    email,
    phone: '+20 10 0000 0000',
    photo: pravatar(photoId),
    branch_id: branchId,
    department_id: departmentId,
    job_position_id: jobPositionId,
    joining_date: joiningDate,
    employment_type: 'full_time',
    work_location: 'office',
    status,
    created_at: `${joiningDate}T08:00:00.000Z`,
    updated_at: `${joiningDate}T08:00:00.000Z`,
  };
}

/** Deterministic filler so pagination (and search/filter) has something to page through. */
function generateFiller(count: number, startId: number): StoredEmployee[] {
  const rows: StoredEmployee[] = [];
  for (let index = 0; index < count; index += 1) {
    const id = startId + index;
    const firstName = FIRST_NAMES_EN[index % FIRST_NAMES_EN.length];
    const lastName = LAST_NAMES_EN[(index + 7) % LAST_NAMES_EN.length];
    const department = DEPARTMENTS[index % DEPARTMENTS.length];
    const positionsInDept = JOB_POSITIONS.filter((position) => position.departmentId === department.id);
    const position = positionsInDept[index % positionsInDept.length] ?? JOB_POSITIONS[index % JOB_POSITIONS.length];
    const year = 2016 + (index % 9);
    const month = String(1 + (index % 12)).padStart(2, '0');
    const day = String(1 + (index % 27)).padStart(2, '0');
    const joiningDate = `${year}-${month}-${day}`;

    rows.push({
      id,
      uuid: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
      company_id: COMPANY_ID,
      employee_number: `EMP-${String(id).padStart(5, '0')}`,
      first_name: firstName,
      last_name: lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${id}@kawdly.com`,
      phone: '+20 10 0000 0000',
      photo: pravatar(1 + (index % 70)),
      gender: index % 2 === 0 ? 'male' : 'female',
      branch_id: BRANCH_IDS[index % BRANCH_IDS.length],
      department_id: department.id,
      job_position_id: position.id,
      joining_date: joiningDate,
      employment_type: EMPLOYMENT_TYPES[index % EMPLOYMENT_TYPES.length],
      work_location: WORK_LOCATIONS[index % WORK_LOCATIONS.length],
      status: STATUSES[index % STATUSES.length],
      created_at: `${joiningDate}T08:00:00.000Z`,
      updated_at: `${joiningDate}T08:00:00.000Z`,
    });
  }
  return rows;
}

function seed(): StoredEmployee[] {
  return [...ANCHORS, ...generateFiller(34, 1000)];
}

let store: StoredEmployee[] = seed();
let nextId = 2000;

export function resetMockEmployees(): void {
  store = seed();
  nextId = 2000;
}

/** Failure injection for reviewing error/rollback UI; persisted so a reload doesn't "fix" it. */
const FAILURE_RATE_KEY = 'kawdly.employeesMockFailureRate';

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

export const mockEmployeeApi: EmployeeApi = {
  async show(context, id) {
    await simulate(context, READ_LATENCY_MS);
    const row = findOrThrow(id);
    return employeeDecoder.decode(structuredClone(toWire(row)));
  },

  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const search = params.search?.trim().toLowerCase();
    const filtered = store.filter((row) => {
      if (params.status && row.status !== params.status) return false;
      if (params.departmentId && row.department_id !== params.departmentId) return false;
      if (!search) return true;
      const haystack = `${row.first_name} ${row.last_name} ${row.employee_number} ${row.email ?? ''}`.toLowerCase();
      return haystack.includes(search);
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const page = filtered.slice(start, start + perPage);

    const wire: EmployeeListWire = {
      data: page.map(toWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return employeeListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);
    assertUnique(input.employee_number);

    const id = nextId;
    nextId += 1;
    const stamp = new Date().toISOString();
    const row: StoredEmployee = {
      id,
      uuid: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
      company_id: input.company_id ?? 1,
      employee_number: input.employee_number,
      first_name: input.first_name,
      last_name: input.last_name,
      first_name_ar: input.first_name_ar ?? undefined,
      last_name_ar: input.last_name_ar ?? undefined,
      email: input.email ?? undefined,
      phone: input.phone ?? undefined,
      gender: input.gender ?? undefined,
      marital_status: input.marital_status ?? undefined,
      branch_id: input.branch_id,
      department_id: input.department_id,
      job_position_id: input.job_position_id,
      job_grade_id: input.job_grade_id ?? undefined,
      job_level_id: input.job_level_id ?? undefined,
      joining_date: input.joining_date,
      employment_type: input.employment_type,
      work_location: input.work_location,
      status: input.status ?? 'active',
      created_at: stamp,
      updated_at: stamp,
    };
    store = [row, ...store];
    return employeeDecoder.decode(structuredClone(toWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findOrThrow(id);
    if (input.employee_number && input.employee_number !== row.employee_number) {
      assertUnique(input.employee_number, id);
    }

    const updated: StoredEmployee = {
      ...row,
      ...stripUndefined(input),
      first_name_ar: input.first_name_ar === null ? undefined : (input.first_name_ar ?? row.first_name_ar),
      last_name_ar: input.last_name_ar === null ? undefined : (input.last_name_ar ?? row.last_name_ar),
      email: input.email === null ? undefined : (input.email ?? row.email),
      phone: input.phone === null ? undefined : (input.phone ?? row.phone),
      gender: input.gender === null ? undefined : (input.gender ?? row.gender),
      marital_status: input.marital_status === null ? undefined : (input.marital_status ?? row.marital_status),
      job_grade_id: input.job_grade_id === null ? undefined : (input.job_grade_id ?? row.job_grade_id),
      job_level_id: input.job_level_id === null ? undefined : (input.job_level_id ?? row.job_level_id),
      photo: input.photo === null ? undefined : (input.photo ?? row.photo),
      updated_at: new Date().toISOString(),
    };
    store = store.map((item) => (item.id === id ? updated : item));
    return employeeDecoder.decode(structuredClone(toWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    findOrThrow(id);
    store = store.filter((item) => item.id !== id);
  },

  // ── Lifecycle actions ──
  // Each mirrors the real `EmployeeLifecycleService` method it stands in for:
  // only the fields that service actually writes to `employees` are touched
  // here (see `EmployeeLifecycleController` for the validated input shape).
  // The backend additionally appends `employee_history`/`employment_events`
  // audit rows — there is no equivalent read surface on the frontend yet, so
  // the mock does not fabricate any of that bookkeeping.

  async promote(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findOrThrow(id);
    const updated: StoredEmployee = {
      ...row,
      job_position_id: input.new_job_position_id ?? row.job_position_id,
      job_grade_id: input.new_job_grade_id ?? row.job_grade_id,
      job_level_id: input.new_job_level_id ?? row.job_level_id,
      updated_at: new Date().toISOString(),
    };
    store = store.map((item) => (item.id === id ? updated : item));
    return employeeDecoder.decode(structuredClone(toWire(updated)));
  },

  async transfer(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findOrThrow(id);
    const updated: StoredEmployee = {
      ...row,
      branch_id: input.new_branch_id ?? row.branch_id,
      department_id: input.new_department_id ?? row.department_id,
      direct_manager_id: input.new_direct_manager_id ?? row.direct_manager_id,
      updated_at: new Date().toISOString(),
    };
    store = store.map((item) => (item.id === id ? updated : item));
    return employeeDecoder.decode(structuredClone(toWire(updated)));
  },

  async suspend(context, id, _input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findOrThrow(id);
    const updated: StoredEmployee = { ...row, status: 'suspended', updated_at: new Date().toISOString() };
    store = store.map((item) => (item.id === id ? updated : item));
    return employeeDecoder.decode(structuredClone(toWire(updated)));
  },

  async terminate(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findOrThrow(id);
    const updated: StoredEmployee = {
      ...row,
      status: 'terminated',
      termination_date: input.termination_date,
      termination_reason: input.termination_reason,
      updated_at: new Date().toISOString(),
    };
    store = store.map((item) => (item.id === id ? updated : item));
    return employeeDecoder.decode(structuredClone(toWire(updated)));
  },

  async reinstate(context, id, _input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findOrThrow(id);
    // Matches the real `EmployeeLifecycleService::reinstate()` exactly: it
    // only flips `status` back to active and does not clear the prior
    // termination_date/termination_reason columns.
    const updated: StoredEmployee = { ...row, status: 'active', updated_at: new Date().toISOString() };
    store = store.map((item) => (item.id === id ? updated : item));
    return employeeDecoder.decode(structuredClone(toWire(updated)));
  },
};

function toWire(row: StoredEmployee): EmployeeWire {
  const department = DEPARTMENTS.find((item) => item.id === row.department_id);
  const position = JOB_POSITIONS.find((item) => item.id === row.job_position_id);
  const branch = BRANCHES.find((item) => item.id === row.branch_id);
  const jobGrade = JOB_GRADES.find((item) => item.id === row.job_grade_id);
  const manager = row.direct_manager_id !== undefined ? store.find((item) => item.id === row.direct_manager_id) : undefined;
  return {
    ...row,
    department: department ? { id: department.id, name: department.name } : undefined,
    job_position: position ? { id: position.id, title: position.name } : undefined,
    branch: branch ? { id: branch.id, name: branch.name } : undefined,
    job_grade: jobGrade ? { id: jobGrade.id, name: jobGrade.name } : undefined,
    direct_manager: manager ? { id: manager.id, first_name: manager.first_name, last_name: manager.last_name } : undefined,
  } as unknown as EmployeeWire;
}

function findOrThrow(id: number): StoredEmployee {
  const row = store.find((item) => item.id === id);
  if (!row) throw new ApiError('http', `Employee ${id} not found`, { status: 404 });
  return row;
}

function assertUnique(employeeNumber: string, excludingId?: number): void {
  const clash = store.find((item) => item.employee_number === employeeNumber && item.id !== excludingId);
  if (clash) {
    throw new ApiError('http', `Employee number ${employeeNumber} is already in use`, {
      status: 422,
      body: { message: 'Validation failed', errors: { employee_number: ['The employee number has already been taken.'] } },
    });
  }
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

