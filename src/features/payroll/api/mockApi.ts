import { ApiError } from '@/lib/api/errors';
import type { FetchContext } from '@/lib/query';
import { pravatar } from '@/features/dashboard/model';
import {
  payrollRunDecoder,
  payrollRunListDecoder,
  payslipDecoder,
  payslipListDecoder,
  employeeSalaryDecoder,
  employeeSalaryListDecoder,
  payslipItemDecoder,
  payslipItemListDecoder,
} from './schema';
import type {
  PayrollRunListWire,
  PayrollRunWire,
  PayslipListWire,
  PayslipWire,
  EmployeeSalaryListWire,
  EmployeeSalaryWire,
  PayslipItemListWire,
  PayslipItemWire,
} from './schema';
import type {
  PayrollRunApi,
  PayrollRunStatus,
  PayslipApi,
  PayslipStatus,
  EmployeeSalaryApi,
  EmployeeSalaryInput,
  PayslipItemApi,
  PayslipItemInput,
  PayslipItemType,
} from './resource';

/**
 * In-process implementations of `PayrollRunApi` and `PayslipApi`, used until
 * the Laravel backend is configured (the default — see `env.useMockApi`).
 *
 * Mirrors `career/api/mockApi.ts`: owns real mutable state so a create or
 * delete is a genuine write later reads observe, adds latency and honours
 * `AbortSignal`, and every response is re-decoded through the same decoders a
 * real HTTP response would go through.
 *
 * Key schema differences vs. old data.ts:
 *   - PayrollRun: period_month (int 1-12) + period_year (int), not a month string.
 *   - PayrollRun: 7-value status enum, 'reviewing' not 'reviewed'.
 *   - Payslip: status is draft|finalized|paid (not 'processed').
 *   - Payslip: total_deductions (not deductions).
 *   - Payslip: no department column; resolved via employee relation.
 *
 * `calculate` aggregates the run's own payslip rows (gross/deductions/net/count)
 * so the mock behaves like the real calc engine instead of inventing numbers;
 * `approve` just flips status + locks, matching the backend's segregation of
 * draft/calculated (anyone with run.edit) vs approved (run.approve only).
 */

// ─── Shared latency / failure helpers ─────────────────────────────────────────

const READ_LATENCY_MS = 220;
const WRITE_LATENCY_MS = 420;

const FAILURE_RATE_KEY = 'kawdly.payrollMockFailureRate';

function readFailureRate(): number {
  const raw = sessionStorage.getItem(FAILURE_RATE_KEY);
  const parsed = Number(raw);
  return raw !== null && Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0;
}

let failureRate = readFailureRate();

export function setMockPayrollFailureRate(rate: number): void {
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

// ─── Employee stubs (same anchor IDs as attendance/contracts/loans mocks) ─────

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
  { id: 1002, employee_number: 'EMP-01002', first_name: 'Salma',  last_name: 'Adel',    photo: pravatar(37) },
  { id: 1003, employee_number: 'EMP-01003', first_name: 'Karim',  last_name: 'Mansour', photo: pravatar(55) },
] as const;

const EMPLOYEE_IDS = EMPLOYEE_STUBS.map((e) => e.id);

// ─── PayrollRun store ─────────────────────────────────────────────────────────

interface StoredPayrollRun {
  id: number;
  company_id: number;
  period_month: number;
  period_year: number;
  status?: PayrollRunStatus | undefined;
  total_gross?: number | undefined;
  total_deductions?: number | undefined;
  total_net?: number | undefined;
  employee_count?: number | undefined;
  notes?: string | undefined;
  is_locked?: boolean | undefined;
  created_by: number;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}

/** Anchor payroll runs matching the old mock's data (adapted to real schema). */
const PAYROLL_RUN_ANCHORS: StoredPayrollRun[] = [
  {
    id: 1,
    company_id: 1,
    period_month: 9,
    period_year: 2026,
    status: 'reviewing',
    total_gross: 14_800_000,
    total_deductions: 2_700_000,
    total_net: 12_100_000,
    employee_count: 1284,
    created_by: 1,
    created_at: '2026-09-01T08:00:00.000Z',
    updated_at: '2026-09-25T08:00:00.000Z',
  },
  {
    id: 2,
    company_id: 1,
    period_month: 8,
    period_year: 2026,
    status: 'paid',
    total_gross: 14_350_000,
    total_deductions: 2_610_000,
    total_net: 11_740_000,
    employee_count: 1271,
    created_by: 1,
    created_at: '2026-08-01T08:00:00.000Z',
    updated_at: '2026-08-31T08:00:00.000Z',
  },
  {
    id: 3,
    company_id: 1,
    period_month: 7,
    period_year: 2026,
    status: 'paid',
    total_gross: 14_010_000,
    total_deductions: 2_570_000,
    total_net: 11_440_000,
    employee_count: 1258,
    created_by: 1,
    created_at: '2026-07-01T08:00:00.000Z',
    updated_at: '2026-07-31T08:00:00.000Z',
  },
  {
    id: 4,
    company_id: 1,
    period_month: 6,
    period_year: 2026,
    status: 'paid',
    total_gross: 13_750_000,
    total_deductions: 2_480_000,
    total_net: 11_270_000,
    employee_count: 1247,
    created_by: 1,
    created_at: '2026-06-01T08:00:00.000Z',
    updated_at: '2026-06-30T08:00:00.000Z',
  },
  {
    id: 5,
    company_id: 1,
    period_month: 10,
    period_year: 2026,
    status: 'draft',
    created_by: 1,
    created_at: '2026-10-01T08:00:00.000Z',
    updated_at: '2026-10-01T08:00:00.000Z',
  },
];

const RUN_STATUSES: PayrollRunStatus[] = [
  'paid', 'paid', 'paid', 'approved', 'posted', 'calculated', 'draft',
];

function generateRunFiller(count: number, startId: number): StoredPayrollRun[] {
  const rows: StoredPayrollRun[] = [];
  for (let i = 0; i < count; i += 1) {
    const id = startId + i;
    const year = 2024 + Math.floor(i / 12);
    const month = 1 + (i % 12);
    const status = RUN_STATUSES[i % RUN_STATUSES.length];
    const gross = 12_000_000 + i * 100_000;
    const deductions = Math.round(gross * 0.18);
    rows.push({
      id,
      company_id: 1,
      period_month: month,
      period_year: year,
      status,
      total_gross: gross,
      total_deductions: deductions,
      total_net: gross - deductions,
      employee_count: 1100 + i * 5,
      created_by: 1,
      created_at: `${year}-${String(month).padStart(2, '0')}-01T08:00:00.000Z`,
      updated_at: `${year}-${String(month).padStart(2, '0')}-28T08:00:00.000Z`,
    });
  }
  return rows;
}

function seedRuns(): StoredPayrollRun[] {
  return [...PAYROLL_RUN_ANCHORS, ...generateRunFiller(10, 100)];
}

let runStore: StoredPayrollRun[] = seedRuns();
let nextRunId = 1000;

export function resetMockPayrollRuns(): void {
  runStore = seedRuns();
  nextRunId = 1000;
}

function payrollRunToWire(row: StoredPayrollRun): PayrollRunWire {
  return { ...row } as unknown as PayrollRunWire;
}

function findRunOrThrow(id: number): StoredPayrollRun {
  const row = runStore.find((r) => r.id === id);
  if (!row) throw new ApiError('http', `PayrollRun ${id} not found`, { status: 404 });
  return row;
}

/** Mirrors the backend's `PayrollRunRepository::parsePeriod()` — `YYYY-MM` or `YYYY-MM-DD`. */
function parsePeriod(value: string): [number, number] {
  const parts = value.split('-');
  return [Number(parts[0]), Number(parts[1] ?? 1)];
}

/** `(year, month)` tuple comparison, same semantics as the backend's composite range filter. */
function periodWithinRange(row: StoredPayrollRun, from: string | undefined, to: string | undefined): boolean {
  if (from) {
    const [fromYear, fromMonth] = parsePeriod(from);
    if (row.period_year < fromYear || (row.period_year === fromYear && row.period_month < fromMonth)) return false;
  }
  if (to) {
    const [toYear, toMonth] = parsePeriod(to);
    if (row.period_year > toYear || (row.period_year === toYear && row.period_month > toMonth)) return false;
  }
  return true;
}

export const mockPayrollRunApi: PayrollRunApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const filtered = runStore.filter((row) => {
      if (params.status && row.status !== params.status) return false;
      if (!periodWithinRange(row, params.periodFrom, params.periodTo)) return false;
      return true;
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const page = filtered.slice(start, start + perPage);

    const wire: PayrollRunListWire = {
      data: page.map(payrollRunToWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return payrollRunListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = nextRunId;
    nextRunId += 1;
    const stamp = new Date().toISOString();

    const row: StoredPayrollRun = {
      id,
      company_id: input.company_id ?? 1,
      period_month: input.period_month,
      period_year: input.period_year,
      status: input.status ?? 'draft',
      total_gross: input.total_gross ?? undefined,
      total_deductions: input.total_deductions ?? undefined,
      total_net: input.total_net ?? undefined,
      employee_count: input.employee_count ?? undefined,
      notes: input.notes ?? undefined,
      is_locked: input.is_locked ?? undefined,
      created_by: input.created_by,
      created_at: stamp,
      updated_at: stamp,
    };
    runStore = [row, ...runStore];
    return payrollRunDecoder.decode(structuredClone(payrollRunToWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findRunOrThrow(id);

    const updated: StoredPayrollRun = {
      id: row.id,
      company_id: input.company_id ?? row.company_id,
      period_month: input.period_month ?? row.period_month,
      period_year: input.period_year ?? row.period_year,
      status:
        input.status === null || input.status === undefined ? row.status : input.status,
      total_gross:
        input.total_gross === null ? undefined : (input.total_gross ?? row.total_gross),
      total_deductions:
        input.total_deductions === null ? undefined : (input.total_deductions ?? row.total_deductions),
      total_net:
        input.total_net === null ? undefined : (input.total_net ?? row.total_net),
      employee_count:
        input.employee_count === null ? undefined : (input.employee_count ?? row.employee_count),
      notes: input.notes === null ? undefined : (input.notes ?? row.notes),
      is_locked:
        input.is_locked === null ? undefined : (input.is_locked ?? row.is_locked),
      created_by: input.created_by ?? row.created_by,
      created_at: row.created_at,
      updated_at: new Date().toISOString(),
    };
    runStore = runStore.map((r) => (r.id === id ? updated : r));
    return payrollRunDecoder.decode(structuredClone(payrollRunToWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    findRunOrThrow(id);
    runStore = runStore.filter((r) => r.id !== id);
  },

  async calculate(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findRunOrThrow(id);
    if (row.is_locked) {
      throw new ApiError('http', `PayrollRun ${id} is locked and cannot be recalculated`, {
        status: 422,
      });
    }

    // Aggregate from this run's own payslips, same as the real calc engine
    // would — never invent a total_gross/employee_count out of thin air.
    const runPayslips = payslipStore.filter((p) => p.payroll_run_id === id);
    const totals = runPayslips.reduce(
      (acc, p) => ({
        gross: acc.gross + p.gross_salary,
        deductions: acc.deductions + p.total_deductions,
        net: acc.net + p.net_salary,
      }),
      { gross: 0, deductions: 0, net: 0 },
    );

    const updated: StoredPayrollRun = {
      ...row,
      status: 'calculated',
      total_gross: totals.gross,
      total_deductions: totals.deductions,
      total_net: totals.net,
      employee_count: runPayslips.length,
      updated_at: new Date().toISOString(),
    };
    runStore = runStore.map((r) => (r.id === id ? updated : r));
    return payrollRunDecoder.decode(structuredClone(payrollRunToWire(updated)));
  },

  async approve(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findRunOrThrow(id);
    if (row.status !== 'calculated') {
      throw new ApiError('http', `PayrollRun ${id} must be calculated before it can be approved`, {
        status: 422,
      });
    }

    const updated: StoredPayrollRun = {
      ...row,
      status: 'approved',
      is_locked: true,
      updated_at: new Date().toISOString(),
    };
    runStore = runStore.map((r) => (r.id === id ? updated : r));
    return payrollRunDecoder.decode(structuredClone(payrollRunToWire(updated)));
  },
};

// ─── Payslip store ────────────────────────────────────────────────────────────

interface StoredPayslip {
  id: number;
  payroll_run_id: number;
  employee_id: number;
  basic_salary: number;
  gross_salary: number;
  total_earnings: number;
  total_deductions: number;
  net_salary: number;
  working_days?: number | undefined;
  present_days?: number | undefined;
  absent_days?: number | undefined;
  overtime_hours?: number | undefined;
  overtime_amount?: number | undefined;
  status?: PayslipStatus | undefined;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}

const PAYSLIP_STATUSES: PayslipStatus[] = [
  'finalized', 'finalized', 'finalized', 'finalized',
  'finalized', 'paid', 'paid',
  'draft', 'draft',
];

/** Anchor payslips for the Sep-2026 run (run id=1). */
const PAYSLIP_ANCHORS: StoredPayslip[] = [
  {
    id: 1,
    payroll_run_id: 1,
    employee_id: 43,
    basic_salary: 12_000,
    gross_salary: 14_500,
    total_earnings: 14_500,
    total_deductions: 2_100,
    net_salary: 12_400,
    working_days: 22,
    present_days: 22,
    absent_days: 0,
    status: 'finalized',
    created_at: '2026-09-25T08:00:00.000Z',
    updated_at: '2026-09-25T08:00:00.000Z',
  },
  {
    id: 2,
    payroll_run_id: 1,
    employee_id: 71,
    basic_salary: 9_500,
    gross_salary: 11_200,
    total_earnings: 11_200,
    total_deductions: 1_680,
    net_salary: 9_520,
    working_days: 22,
    present_days: 21,
    absent_days: 1,
    status: 'finalized',
    created_at: '2026-09-25T08:00:00.000Z',
    updated_at: '2026-09-25T08:00:00.000Z',
  },
  {
    id: 3,
    payroll_run_id: 1,
    employee_id: 112,
    basic_salary: 10_800,
    gross_salary: 13_100,
    total_earnings: 13_100,
    total_deductions: 1_965,
    net_salary: 11_135,
    working_days: 22,
    present_days: 22,
    absent_days: 0,
    overtime_hours: 4,
    overtime_amount: 600,
    status: 'draft',
    created_at: '2026-09-25T08:00:00.000Z',
    updated_at: '2026-09-25T08:00:00.000Z',
  },
  {
    id: 4,
    payroll_run_id: 1,
    employee_id: 158,
    basic_salary: 8_200,
    gross_salary: 9_800,
    total_earnings: 9_800,
    total_deductions: 1_470,
    net_salary: 8_330,
    working_days: 22,
    present_days: 20,
    absent_days: 2,
    status: 'finalized',
    created_at: '2026-09-25T08:00:00.000Z',
    updated_at: '2026-09-25T08:00:00.000Z',
  },
  {
    id: 5,
    payroll_run_id: 1,
    employee_id: 134,
    basic_salary: 7_600,
    gross_salary: 9_100,
    total_earnings: 9_100,
    total_deductions: 1_365,
    net_salary: 7_735,
    working_days: 22,
    present_days: 22,
    absent_days: 0,
    status: 'draft',
    created_at: '2026-09-25T08:00:00.000Z',
    updated_at: '2026-09-25T08:00:00.000Z',
  },
  {
    id: 6,
    payroll_run_id: 1,
    employee_id: 203,
    basic_salary: 6_800,
    gross_salary: 8_200,
    total_earnings: 8_200,
    total_deductions: 1_230,
    net_salary: 6_970,
    working_days: 22,
    present_days: 22,
    absent_days: 0,
    status: 'finalized',
    created_at: '2026-09-25T08:00:00.000Z',
    updated_at: '2026-09-25T08:00:00.000Z',
  },
];

function generatePayslipFiller(count: number, startId: number): StoredPayslip[] {
  const rows: StoredPayslip[] = [];
  for (let i = 0; i < count; i += 1) {
    const id = startId + i;
    const employeeId = EMPLOYEE_IDS[i % EMPLOYEE_IDS.length];
    const runId = 1 + (i % 5);
    const status = PAYSLIP_STATUSES[i % PAYSLIP_STATUSES.length];
    const basic = 5_000 + (i % 8) * 2_000;
    const gross = Math.round(basic * 1.2);
    const deductions = Math.round(gross * 0.15);
    const stamp = `2026-09-25T08:00:00.000Z`;
    rows.push({
      id,
      payroll_run_id: runId,
      employee_id: employeeId,
      basic_salary: basic,
      gross_salary: gross,
      total_earnings: gross,
      total_deductions: deductions,
      net_salary: gross - deductions,
      working_days: 22,
      present_days: 20 + (i % 3),
      absent_days: 2 - (i % 3) < 0 ? 0 : 2 - (i % 3),
      status,
      created_at: stamp,
      updated_at: stamp,
    });
  }
  return rows;
}

function seedPayslips(): StoredPayslip[] {
  return [...PAYSLIP_ANCHORS, ...generatePayslipFiller(20, 100)];
}

let payslipStore: StoredPayslip[] = seedPayslips();
let nextPayslipId = 1000;

export function resetMockPayslips(): void {
  payslipStore = seedPayslips();
  nextPayslipId = 1000;
}

function payslipToWire(row: StoredPayslip): PayslipWire {
  const emp = EMPLOYEE_STUBS.find((e) => e.id === row.employee_id);
  return {
    ...row,
    employee: emp ? { ...emp } : undefined,
  } as unknown as PayslipWire;
}

function findPayslipOrThrow(id: number): StoredPayslip {
  const row = payslipStore.find((r) => r.id === id);
  if (!row) throw new ApiError('http', `Payslip ${id} not found`, { status: 404 });
  return row;
}

export const mockPayslipApi: PayslipApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const filtered = payslipStore.filter((row) => {
      if (params.payroll_run_id && row.payroll_run_id !== params.payroll_run_id) return false;
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

    const wire: PayslipListWire = {
      data: page.map(payslipToWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return payslipListDecoder.decode(structuredClone(wire));
  },

  async get(context, id) {
    await simulate(context, READ_LATENCY_MS);
    const row = findPayslipOrThrow(id);
    const wire = payslipToWire(row) as PayslipWire & {
      payslipItems?: PayslipItemWire[];
    };
    wire.payslipItems = payslipItemStore
      .filter((item) => item.payslip_id === id)
      .map(payslipItemToWire);
    return payslipDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = nextPayslipId;
    nextPayslipId += 1;
    const stamp = new Date().toISOString();

    const row: StoredPayslip = {
      id,
      payroll_run_id: input.payroll_run_id,
      employee_id: input.employee_id,
      basic_salary: input.basic_salary,
      gross_salary: input.gross_salary,
      total_earnings: input.total_earnings,
      total_deductions: input.total_deductions,
      net_salary: input.net_salary,
      working_days: input.working_days ?? undefined,
      present_days: input.present_days ?? undefined,
      absent_days: input.absent_days ?? undefined,
      overtime_hours: input.overtime_hours ?? undefined,
      overtime_amount: input.overtime_amount ?? undefined,
      status: input.status ?? 'draft',
      created_at: stamp,
      updated_at: stamp,
    };
    payslipStore = [row, ...payslipStore];
    return payslipDecoder.decode(structuredClone(payslipToWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findPayslipOrThrow(id);

    const updated: StoredPayslip = {
      id: row.id,
      created_at: row.created_at,
      payroll_run_id: input.payroll_run_id ?? row.payroll_run_id,
      employee_id: input.employee_id ?? row.employee_id,
      basic_salary: input.basic_salary ?? row.basic_salary,
      gross_salary: input.gross_salary ?? row.gross_salary,
      total_earnings: input.total_earnings ?? row.total_earnings,
      total_deductions: input.total_deductions ?? row.total_deductions,
      net_salary: input.net_salary ?? row.net_salary,
      working_days:
        input.working_days === null ? undefined : (input.working_days ?? row.working_days),
      present_days:
        input.present_days === null ? undefined : (input.present_days ?? row.present_days),
      absent_days:
        input.absent_days === null ? undefined : (input.absent_days ?? row.absent_days),
      overtime_hours:
        input.overtime_hours === null ? undefined : (input.overtime_hours ?? row.overtime_hours),
      overtime_amount:
        input.overtime_amount === null ? undefined : (input.overtime_amount ?? row.overtime_amount),
      status:
        input.status === null || input.status === undefined ? row.status : input.status,
      updated_at: new Date().toISOString(),
    };
    payslipStore = payslipStore.map((r) => (r.id === id ? updated : r));
    return payslipDecoder.decode(structuredClone(payslipToWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    findPayslipOrThrow(id);
    payslipStore = payslipStore.filter((r) => r.id !== id);
  },
};

// ─── EmployeeSalary store ─────────────────────────────────────────────────────

/** Minimal salary-structure name lookup — mirrors compensation/api/mockApi.ts's STRUCTURE_SEEDS ids/names. */
const STRUCTURE_NAME_STUBS: Record<number, string> = {
  1: 'Standard Egypt',
  2: 'Executive Package',
  3: 'Part-Time',
  4: 'Intern / Trainee',
  5: 'Contract (B2B)',
  6: 'KSA Branch',
};

interface StoredEmployeeSalary {
  id: number;
  employee_id: number;
  salary_structure_id: number;
  effective_date: string;
  components: unknown[];
  gross_salary: number;
  net_salary: number;
  is_current?: boolean | undefined;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}

/** One current assignment per employee stub, plus a couple of superseded history rows. */
const EMPLOYEE_SALARY_ANCHORS: StoredEmployeeSalary[] = [
  { id: 1, employee_id: 43, salary_structure_id: 1, effective_date: '2026-01-01', components: [], gross_salary: 14_500, net_salary: 12_400, is_current: true, created_at: '2026-01-01T08:00:00.000Z', updated_at: '2026-01-01T08:00:00.000Z' },
  { id: 2, employee_id: 71, salary_structure_id: 1, effective_date: '2026-01-01', components: [], gross_salary: 11_200, net_salary: 9_520, is_current: true, created_at: '2026-01-01T08:00:00.000Z', updated_at: '2026-01-01T08:00:00.000Z' },
  { id: 3, employee_id: 89, salary_structure_id: 2, effective_date: '2025-06-01', components: [], gross_salary: 48_000, net_salary: 39_600, is_current: true, created_at: '2025-06-01T08:00:00.000Z', updated_at: '2025-06-01T08:00:00.000Z' },
  { id: 4, employee_id: 112, salary_structure_id: 1, effective_date: '2026-01-01', components: [], gross_salary: 13_100, net_salary: 11_135, is_current: true, created_at: '2026-01-01T08:00:00.000Z', updated_at: '2026-01-01T08:00:00.000Z' },
  { id: 5, employee_id: 134, salary_structure_id: 1, effective_date: '2026-01-01', components: [], gross_salary: 9_100, net_salary: 7_735, is_current: true, created_at: '2026-01-01T08:00:00.000Z', updated_at: '2026-01-01T08:00:00.000Z' },
  { id: 6, employee_id: 158, salary_structure_id: 3, effective_date: '2026-02-01', components: [], gross_salary: 9_800, net_salary: 8_330, is_current: true, created_at: '2026-02-01T08:00:00.000Z', updated_at: '2026-02-01T08:00:00.000Z' },
  { id: 7, employee_id: 177, salary_structure_id: 1, effective_date: '2026-01-01', components: [], gross_salary: 10_600, net_salary: 9_010, is_current: true, created_at: '2026-01-01T08:00:00.000Z', updated_at: '2026-01-01T08:00:00.000Z' },
  { id: 8, employee_id: 203, salary_structure_id: 1, effective_date: '2026-01-01', components: [], gross_salary: 8_200, net_salary: 6_970, is_current: true, created_at: '2026-01-01T08:00:00.000Z', updated_at: '2026-01-01T08:00:00.000Z' },
  { id: 9, employee_id: 1000, salary_structure_id: 4, effective_date: '2026-09-01', components: [], gross_salary: 2_200, net_salary: 2_200, is_current: true, created_at: '2026-09-01T08:00:00.000Z', updated_at: '2026-09-01T08:00:00.000Z' },
  { id: 10, employee_id: 1001, salary_structure_id: 1, effective_date: '2026-01-01', components: [], gross_salary: 10_900, net_salary: 9_265, is_current: true, created_at: '2026-01-01T08:00:00.000Z', updated_at: '2026-01-01T08:00:00.000Z' },
  { id: 11, employee_id: 1002, salary_structure_id: 1, effective_date: '2026-01-01', components: [], gross_salary: 10_200, net_salary: 8_670, is_current: true, created_at: '2026-01-01T08:00:00.000Z', updated_at: '2026-01-01T08:00:00.000Z' },
  { id: 12, employee_id: 1003, salary_structure_id: 6, effective_date: '2026-03-01', components: [], gross_salary: 16_800, net_salary: 14_950, is_current: true, created_at: '2026-03-01T08:00:00.000Z', updated_at: '2026-03-01T08:00:00.000Z' },
  // Superseded history rows (is_current: false) so the "history" case is exercised
  { id: 13, employee_id: 43, salary_structure_id: 1, effective_date: '2025-01-01', components: [], gross_salary: 13_000, net_salary: 11_100, is_current: false, created_at: '2025-01-01T08:00:00.000Z', updated_at: '2025-01-01T08:00:00.000Z' },
  { id: 14, employee_id: 89, salary_structure_id: 2, effective_date: '2024-06-01', components: [], gross_salary: 42_000, net_salary: 34_700, is_current: false, created_at: '2024-06-01T08:00:00.000Z', updated_at: '2024-06-01T08:00:00.000Z' },
];

function seedEmployeeSalaries(): StoredEmployeeSalary[] {
  return EMPLOYEE_SALARY_ANCHORS.map((row) => ({ ...row, components: [...row.components] }));
}

let employeeSalaryStore: StoredEmployeeSalary[] = seedEmployeeSalaries();
let nextEmployeeSalaryId = 1000;

export function resetMockEmployeeSalaries(): void {
  employeeSalaryStore = seedEmployeeSalaries();
  nextEmployeeSalaryId = 1000;
}

function employeeSalaryToWire(row: StoredEmployeeSalary): EmployeeSalaryWire {
  const emp = EMPLOYEE_STUBS.find((e) => e.id === row.employee_id);
  const structureName = STRUCTURE_NAME_STUBS[row.salary_structure_id];
  return {
    ...row,
    employee: emp ? { ...emp } : undefined,
    salaryStructure: structureName ? { id: row.salary_structure_id, name: structureName } : undefined,
  } as unknown as EmployeeSalaryWire;
}

function findEmployeeSalaryOrThrow(id: number): StoredEmployeeSalary {
  const row = employeeSalaryStore.find((r) => r.id === id);
  if (!row) throw new ApiError('http', `EmployeeSalary ${id} not found`, { status: 404 });
  return row;
}

export const mockEmployeeSalaryApi: EmployeeSalaryApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const filtered = employeeSalaryStore.filter((row) => {
      if (params.employee_id !== undefined && row.employee_id !== params.employee_id) return false;
      if (params.salary_structure_id !== undefined && row.salary_structure_id !== params.salary_structure_id) return false;
      if (params.is_current !== undefined && Boolean(row.is_current) !== params.is_current) return false;
      return true;
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const page = filtered.slice(start, start + perPage);

    const wire: EmployeeSalaryListWire = {
      data: page.map(employeeSalaryToWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return employeeSalaryListDecoder.decode(structuredClone(wire));
  },

  async create(context, input: EmployeeSalaryInput) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = nextEmployeeSalaryId;
    nextEmployeeSalaryId += 1;
    const stamp = new Date().toISOString();

    const row: StoredEmployeeSalary = {
      id,
      employee_id: input.employee_id,
      salary_structure_id: input.salary_structure_id,
      effective_date: input.effective_date,
      components: input.components ?? [],
      gross_salary: input.gross_salary,
      net_salary: input.net_salary,
      is_current: input.is_current ?? undefined,
      created_at: stamp,
      updated_at: stamp,
    };
    employeeSalaryStore = [row, ...employeeSalaryStore];
    return employeeSalaryDecoder.decode(structuredClone(employeeSalaryToWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findEmployeeSalaryOrThrow(id);

    const updated: StoredEmployeeSalary = {
      id: row.id,
      created_at: row.created_at,
      employee_id: input.employee_id ?? row.employee_id,
      salary_structure_id: input.salary_structure_id ?? row.salary_structure_id,
      effective_date: input.effective_date ?? row.effective_date,
      components: input.components ?? row.components,
      gross_salary: input.gross_salary ?? row.gross_salary,
      net_salary: input.net_salary ?? row.net_salary,
      is_current: input.is_current === null ? undefined : (input.is_current ?? row.is_current),
      updated_at: new Date().toISOString(),
    };
    employeeSalaryStore = employeeSalaryStore.map((r) => (r.id === id ? updated : r));
    return employeeSalaryDecoder.decode(structuredClone(employeeSalaryToWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    findEmployeeSalaryOrThrow(id);
    employeeSalaryStore = employeeSalaryStore.filter((r) => r.id !== id);
  },
};

// ─── PayslipItem store ────────────────────────────────────────────────────────

interface StoredPayslipItem {
  id: number;
  payslip_id: number;
  salary_component_id?: number | undefined;
  description: string;
  type: PayslipItemType;
  amount: number;
  is_taxable?: boolean | undefined;
  sort_order?: number | undefined;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}

/** Five line items per anchor payslip, matching the real backend seeder's pattern. */
const LINE_ITEM_TEMPLATE: Array<{ description: string; type: PayslipItemType; share: number; is_taxable: boolean }> = [
  { description: 'Basic Salary', type: 'earning', share: 0.82, is_taxable: true },
  { description: 'Housing Allowance', type: 'earning', share: 0.12, is_taxable: false },
  { description: 'Transportation Allowance', type: 'earning', share: 0.06, is_taxable: false },
  { description: 'Income Tax', type: 'deduction', share: -0.1, is_taxable: true },
  { description: 'Social Insurance', type: 'deduction', share: -0.05, is_taxable: false },
];

function generateItemsForPayslip(payslip: StoredPayslip, startId: number): StoredPayslipItem[] {
  const stamp = payslip.created_at ?? new Date().toISOString();
  return LINE_ITEM_TEMPLATE.map((tpl, idx) => ({
    id: startId + idx,
    payslip_id: payslip.id,
    description: tpl.description,
    type: tpl.type,
    amount: Math.round(Math.abs(payslip.gross_salary * tpl.share)),
    is_taxable: tpl.is_taxable,
    sort_order: tpl.type === 'earning' ? (idx + 1) * 10 : (idx + 1) * 10 + 50,
    created_at: stamp,
    updated_at: stamp,
  }));
}

function seedPayslipItems(): StoredPayslipItem[] {
  const rows: StoredPayslipItem[] = [];
  let nextId = 1;
  for (const payslip of seedPayslips()) {
    rows.push(...generateItemsForPayslip(payslip, nextId));
    nextId += LINE_ITEM_TEMPLATE.length;
  }
  return rows;
}

let payslipItemStore: StoredPayslipItem[] = seedPayslipItems();
let nextPayslipItemId = 10_000;

export function resetMockPayslipItems(): void {
  payslipItemStore = seedPayslipItems();
  nextPayslipItemId = 10_000;
}

function payslipItemToWire(row: StoredPayslipItem): PayslipItemWire {
  return { ...row } as unknown as PayslipItemWire;
}

function findPayslipItemOrThrow(id: number): StoredPayslipItem {
  const row = payslipItemStore.find((r) => r.id === id);
  if (!row) throw new ApiError('http', `PayslipItem ${id} not found`, { status: 404 });
  return row;
}

export const mockPayslipItemApi: PayslipItemApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const filtered = payslipItemStore.filter((row) => {
      if (params.payslip_id !== undefined && row.payslip_id !== params.payslip_id) return false;
      if (params.salary_component_id !== undefined && row.salary_component_id !== params.salary_component_id) return false;
      if (params.type && row.type !== params.type) return false;
      if (params.is_taxable !== undefined && Boolean(row.is_taxable) !== params.is_taxable) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const ao = a.sort_order ?? 9999;
      const bo = b.sort_order ?? 9999;
      return ao !== bo ? ao - bo : a.id - b.id;
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = sorted.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const page = sorted.slice(start, start + perPage);

    const wire: PayslipItemListWire = {
      data: page.map(payslipItemToWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return payslipItemListDecoder.decode(structuredClone(wire));
  },

  async create(context, input: PayslipItemInput) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = nextPayslipItemId;
    nextPayslipItemId += 1;
    const stamp = new Date().toISOString();

    const row: StoredPayslipItem = {
      id,
      payslip_id: input.payslip_id,
      salary_component_id: input.salary_component_id ?? undefined,
      description: input.description,
      type: input.type,
      amount: input.amount,
      is_taxable: input.is_taxable ?? undefined,
      sort_order: input.sort_order ?? undefined,
      created_at: stamp,
      updated_at: stamp,
    };
    payslipItemStore = [...payslipItemStore, row];
    return payslipItemDecoder.decode(structuredClone(payslipItemToWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findPayslipItemOrThrow(id);

    const updated: StoredPayslipItem = {
      id: row.id,
      created_at: row.created_at,
      payslip_id: input.payslip_id ?? row.payslip_id,
      salary_component_id:
        input.salary_component_id === null ? undefined : (input.salary_component_id ?? row.salary_component_id),
      description: input.description ?? row.description,
      type: input.type ?? row.type,
      amount: input.amount ?? row.amount,
      is_taxable: input.is_taxable === null ? undefined : (input.is_taxable ?? row.is_taxable),
      sort_order: input.sort_order === null ? undefined : (input.sort_order ?? row.sort_order),
      updated_at: new Date().toISOString(),
    };
    payslipItemStore = payslipItemStore.map((r) => (r.id === id ? updated : r));
    return payslipItemDecoder.decode(structuredClone(payslipItemToWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    findPayslipItemOrThrow(id);
    payslipItemStore = payslipItemStore.filter((r) => r.id !== id);
  },
};
