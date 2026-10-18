import { ApiError } from '@/lib/api/errors';
import type { FetchContext } from '@/lib/query';
import {
  salaryStructureDecoder,
  salaryStructureListDecoder,
  salaryComponentDecoder,
  salaryComponentListDecoder,
} from './schema';
import type {
  SalaryStructureListWire,
  SalaryStructureWire,
  SalaryComponentListWire,
  SalaryComponentWire,
} from './schema';
import type {
  SalaryStructureApi,
  SalaryComponentApi,
  SalaryComponentType,
  SalaryComponentCalculationType,
} from './resource';

/**
 * In-process mock implementations for both `SalaryStructureApi` and
 * `SalaryComponentApi`. Mirrors Attendance/Contracts mock conventions:
 *   - Mutable in-memory stores
 *   - Real latency (220 ms read / 420 ms write, ±40 % jitter)
 *   - AbortSignal-aware
 *   - Every response passes through the same decoders the HTTP client would use
 *   - Failure injection via `setMockSalaryFailureRate`
 */

// ─── Internal storage types ───────────────────────────────────────────────────

interface StoredSalaryStructure {
  id: number;
  company_id: number;
  name: string;
  description?: string | undefined;
  is_default?: boolean | undefined;
  is_active?: boolean | undefined;
  created_at: string;
  updated_at: string;
}

interface StoredSalaryComponent {
  id: number;
  company_id: number;
  salary_structure_id: number;
  name: string;
  code?: string | undefined;
  type: SalaryComponentType;
  calculation_type: SalaryComponentCalculationType;
  percentage_of?: number | undefined;
  default_amount?: number | undefined;
  is_taxable?: boolean | undefined;
  is_variable?: boolean | undefined;
  sort_order?: number | undefined;
  created_at: string;
  updated_at: string;
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const NOW = '2026-10-06T08:00:00.000Z';

const STRUCTURE_SEEDS: StoredSalaryStructure[] = [
  { id: 1, company_id: 1, name: 'Standard Egypt', description: 'Default payroll structure for Egyptian employees', is_default: true, is_active: true, created_at: NOW, updated_at: NOW },
  { id: 2, company_id: 1, name: 'Executive Package', description: 'Senior leadership enhanced compensation', is_default: false, is_active: true, created_at: NOW, updated_at: NOW },
  { id: 3, company_id: 1, name: 'Part-Time', description: 'Structure for part-time and hourly employees', is_default: false, is_active: true, created_at: NOW, updated_at: NOW },
  { id: 4, company_id: 1, name: 'Intern / Trainee', description: 'Internship and training programme', is_default: false, is_active: true, created_at: NOW, updated_at: NOW },
  { id: 5, company_id: 1, name: 'Contract (B2B)', description: 'Independent contractor payment structure', is_default: false, is_active: false, created_at: NOW, updated_at: NOW },
  { id: 6, company_id: 1, name: 'KSA Branch', description: 'Saudi Arabia branch payroll structure', is_default: false, is_active: true, created_at: NOW, updated_at: NOW },
];

const COMPONENT_SEEDS: StoredSalaryComponent[] = [
  // Structure 1 — Standard Egypt
  { id: 1,  company_id: 1, salary_structure_id: 1, name: 'Basic Salary',         code: 'BASIC',     type: 'earning',   calculation_type: 'fixed',      default_amount: 10000, is_taxable: true,  is_variable: false, sort_order: 10, created_at: NOW, updated_at: NOW },
  { id: 2,  company_id: 1, salary_structure_id: 1, name: 'Housing Allowance',    code: 'HOUSING',   type: 'earning',   calculation_type: 'percentage', percentage_of: 1, default_amount: 25, is_taxable: false, is_variable: false, sort_order: 20, created_at: NOW, updated_at: NOW },
  { id: 3,  company_id: 1, salary_structure_id: 1, name: 'Transportation',       code: 'TRANSP',    type: 'earning',   calculation_type: 'fixed',      default_amount: 500,   is_taxable: false, is_variable: false, sort_order: 30, created_at: NOW, updated_at: NOW },
  { id: 4,  company_id: 1, salary_structure_id: 1, name: 'Performance Bonus',    code: 'PERF',      type: 'earning',   calculation_type: 'percentage', percentage_of: 1, default_amount: 10, is_taxable: true,  is_variable: true,  sort_order: 40, created_at: NOW, updated_at: NOW },
  { id: 5,  company_id: 1, salary_structure_id: 1, name: 'Income Tax',           code: 'TAX',       type: 'deduction', calculation_type: 'formula',    is_taxable: true,  is_variable: true,  sort_order: 100, created_at: NOW, updated_at: NOW },
  { id: 6,  company_id: 1, salary_structure_id: 1, name: 'Social Insurance',     code: 'SI',        type: 'deduction', calculation_type: 'percentage', percentage_of: 1, default_amount: 11, is_taxable: false, is_variable: false, sort_order: 110, created_at: NOW, updated_at: NOW },
  // Structure 2 — Executive
  { id: 7,  company_id: 1, salary_structure_id: 2, name: 'Basic Salary',         code: 'BASIC',     type: 'earning',   calculation_type: 'fixed',      default_amount: 40000, is_taxable: true,  is_variable: false, sort_order: 10, created_at: NOW, updated_at: NOW },
  { id: 8,  company_id: 1, salary_structure_id: 2, name: 'Car Allowance',        code: 'CAR',       type: 'earning',   calculation_type: 'fixed',      default_amount: 3000,  is_taxable: false, is_variable: false, sort_order: 20, created_at: NOW, updated_at: NOW },
  { id: 9,  company_id: 1, salary_structure_id: 2, name: 'Executive Bonus',      code: 'EXEC_BNS',  type: 'earning',   calculation_type: 'percentage', percentage_of: 7, default_amount: 20, is_taxable: true,  is_variable: true,  sort_order: 30, created_at: NOW, updated_at: NOW },
  { id: 10, company_id: 1, salary_structure_id: 2, name: 'Income Tax',           code: 'TAX',       type: 'deduction', calculation_type: 'formula',    is_taxable: true,  is_variable: true,  sort_order: 100, created_at: NOW, updated_at: NOW },
  // Structure 3 — Part-Time
  { id: 11, company_id: 1, salary_structure_id: 3, name: 'Hourly Rate',          code: 'HOURLY',    type: 'earning',   calculation_type: 'fixed',      default_amount: 150,   is_taxable: true,  is_variable: true,  sort_order: 10, created_at: NOW, updated_at: NOW },
  { id: 12, company_id: 1, salary_structure_id: 3, name: 'Overtime Rate',        code: 'OT',        type: 'earning',   calculation_type: 'percentage', percentage_of: 11, default_amount: 150, is_taxable: true, is_variable: true, sort_order: 20, created_at: NOW, updated_at: NOW },
  { id: 13, company_id: 1, salary_structure_id: 3, name: 'Income Tax',           code: 'TAX',       type: 'deduction', calculation_type: 'formula',    is_taxable: true,  is_variable: true,  sort_order: 100, created_at: NOW, updated_at: NOW },
  // Structure 4 — Intern
  { id: 14, company_id: 1, salary_structure_id: 4, name: 'Stipend',              code: 'STIPEND',   type: 'earning',   calculation_type: 'fixed',      default_amount: 2000,  is_taxable: false, is_variable: false, sort_order: 10, created_at: NOW, updated_at: NOW },
  { id: 15, company_id: 1, salary_structure_id: 4, name: 'Meal Allowance',       code: 'MEAL',      type: 'earning',   calculation_type: 'fixed',      default_amount: 200,   is_taxable: false, is_variable: false, sort_order: 20, created_at: NOW, updated_at: NOW },
  // Structure 5 — Contract (B2B)
  { id: 16, company_id: 1, salary_structure_id: 5, name: 'Contract Fee',         code: 'CONTRACT',  type: 'earning',   calculation_type: 'fixed',      default_amount: 20000, is_taxable: true,  is_variable: true,  sort_order: 10, created_at: NOW, updated_at: NOW },
  { id: 17, company_id: 1, salary_structure_id: 5, name: 'Withholding Tax',      code: 'WHT',       type: 'deduction', calculation_type: 'percentage', percentage_of: 16, default_amount: 5,  is_taxable: false, is_variable: false, sort_order: 100, created_at: NOW, updated_at: NOW },
  // Structure 6 — KSA Branch
  { id: 18, company_id: 1, salary_structure_id: 6, name: 'Basic Salary',         code: 'BASIC',     type: 'earning',   calculation_type: 'fixed',      default_amount: 15000, is_taxable: false, is_variable: false, sort_order: 10, created_at: NOW, updated_at: NOW },
  { id: 19, company_id: 1, salary_structure_id: 6, name: 'Housing Allowance',    code: 'HOUSING',   type: 'earning',   calculation_type: 'percentage', percentage_of: 18, default_amount: 25, is_taxable: false, is_variable: false, sort_order: 20, created_at: NOW, updated_at: NOW },
  { id: 20, company_id: 1, salary_structure_id: 6, name: 'Transportation',       code: 'TRANSP',    type: 'earning',   calculation_type: 'fixed',      default_amount: 800,   is_taxable: false, is_variable: false, sort_order: 30, created_at: NOW, updated_at: NOW },
  { id: 21, company_id: 1, salary_structure_id: 6, name: 'GOSI Employee',        code: 'GOSI_EMP',  type: 'deduction', calculation_type: 'percentage', percentage_of: 18, default_amount: 10, is_taxable: false, is_variable: false, sort_order: 100, created_at: NOW, updated_at: NOW },
  { id: 22, company_id: 1, salary_structure_id: 6, name: 'GOSI Employer',        code: 'GOSI_ER',   type: 'deduction', calculation_type: 'percentage', percentage_of: 18, default_amount: 12, is_taxable: false, is_variable: false, sort_order: 110, created_at: NOW, updated_at: NOW },
  // Extra components for structure 1 to give good pagination
  { id: 23, company_id: 1, salary_structure_id: 1, name: 'Mobile Allowance',     code: 'MOBILE',    type: 'earning',   calculation_type: 'fixed',      default_amount: 200,   is_taxable: false, is_variable: false, sort_order: 50, created_at: NOW, updated_at: NOW },
  { id: 24, company_id: 1, salary_structure_id: 1, name: 'Annual Bonus',         code: 'ANN_BNS',   type: 'earning',   calculation_type: 'percentage', percentage_of: 1, default_amount: 100, is_taxable: true, is_variable: true, sort_order: 60, created_at: NOW, updated_at: NOW },
  { id: 25, company_id: 1, salary_structure_id: 1, name: 'Absence Deduction',    code: 'ABSENT',    type: 'deduction', calculation_type: 'formula',    is_taxable: false, is_variable: true, sort_order: 120, created_at: NOW, updated_at: NOW },
];

// ─── Mutable stores ───────────────────────────────────────────────────────────

function seedStructures(): StoredSalaryStructure[] {
  return STRUCTURE_SEEDS.map((s) => ({ ...s }));
}

function seedComponents(): StoredSalaryComponent[] {
  return COMPONENT_SEEDS.map((c) => ({ ...c }));
}

let structureStore: StoredSalaryStructure[] = seedStructures();
let componentStore: StoredSalaryComponent[] = seedComponents();
let nextStructureId = 100;
let nextComponentId = 200;

export function resetMockSalary(): void {
  structureStore = seedStructures();
  componentStore = seedComponents();
  nextStructureId = 100;
  nextComponentId = 200;
}

// ─── Failure injection ────────────────────────────────────────────────────────

const FAILURE_RATE_KEY = 'kawdly.salaryMockFailureRate';

function readFailureRate(): number {
  const raw = sessionStorage.getItem(FAILURE_RATE_KEY);
  const parsed = Number(raw);
  return raw !== null && Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0;
}

let failureRate = readFailureRate();

export function setMockSalaryFailureRate(rate: number): void {
  failureRate = Math.min(Math.max(rate, 0), 1);
  sessionStorage.setItem(FAILURE_RATE_KEY, String(failureRate));
}

const READ_LATENCY_MS = 220;
const WRITE_LATENCY_MS = 420;

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

// ─── Helper ───────────────────────────────────────────────────────────────────

function paginate<T>(items: T[], page: number | undefined, perPage: number | undefined) {
  const pp = perPage && perPage > 0 ? Math.min(perPage, 200) : 25;
  const cp = page && page > 0 ? page : 1;
  const total = items.length;
  const lastPage = Math.max(1, Math.ceil(total / pp));
  const safePage = Math.min(cp, lastPage);
  const start = (safePage - 1) * pp;
  return {
    data: items.slice(start, start + pp),
    meta: { current_page: safePage, per_page: pp, total, last_page: lastPage },
  };
}

// ─── SalaryStructure mock ─────────────────────────────────────────────────────

function toStructureWire(row: StoredSalaryStructure): SalaryStructureWire {
  return structuredClone(row) as unknown as SalaryStructureWire;
}

function findStructureOrThrow(id: number): StoredSalaryStructure {
  const row = structureStore.find((s) => s.id === id);
  if (!row) throw new ApiError('http', `SalaryStructure ${id} not found`, { status: 404 });
  return row;
}

export const mockSalaryStructureApi: SalaryStructureApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const search = params.search?.trim().toLowerCase();
    const filtered = structureStore.filter((row) => {
      if (params.isActive !== undefined && Boolean(row.is_active) !== params.isActive) return false;
      if (!search) return true;
      return row.name.toLowerCase().includes(search) ||
        (row.description ?? '').toLowerCase().includes(search);
    });

    const paged = paginate(filtered, params.page, params.perPage);
    const wire: SalaryStructureListWire = {
      data: paged.data.map(toStructureWire),
      meta: paged.meta,
    };
    return salaryStructureListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const stamp = new Date().toISOString();
    const row: StoredSalaryStructure = {
      id: nextStructureId,
      company_id: input.company_id ?? 1,
      name: input.name,
      description: input.description ?? undefined,
      is_default: input.is_default ?? undefined,
      is_active: input.is_active ?? true,
      created_at: stamp,
      updated_at: stamp,
    };
    nextStructureId += 1;
    structureStore = [row, ...structureStore];
    return salaryStructureDecoder.decode(structuredClone(toStructureWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findStructureOrThrow(id);

    const updated: StoredSalaryStructure = {
      ...row,
      name: input.name ?? row.name,
      description: input.description === null ? undefined : (input.description ?? row.description),
      is_default: input.is_default === null ? undefined : (input.is_default ?? row.is_default),
      is_active: input.is_active === null ? undefined : (input.is_active ?? row.is_active),
      updated_at: new Date().toISOString(),
    };
    structureStore = structureStore.map((s) => (s.id === id ? updated : s));
    return salaryStructureDecoder.decode(structuredClone(toStructureWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    findStructureOrThrow(id);
    structureStore = structureStore.filter((s) => s.id !== id);
    // Also remove orphaned components
    componentStore = componentStore.filter((c) => c.salary_structure_id !== id);
  },
};

// ─── SalaryComponent mock ─────────────────────────────────────────────────────

function toComponentWire(row: StoredSalaryComponent): SalaryComponentWire {
  return structuredClone(row) as unknown as SalaryComponentWire;
}

function findComponentOrThrow(id: number): StoredSalaryComponent {
  const row = componentStore.find((c) => c.id === id);
  if (!row) throw new ApiError('http', `SalaryComponent ${id} not found`, { status: 404 });
  return row;
}

export const mockSalaryComponentApi: SalaryComponentApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const search = params.search?.trim().toLowerCase();
    const filtered = componentStore.filter((row) => {
      if (params.salary_structure_id !== undefined && row.salary_structure_id !== params.salary_structure_id) return false;
      if (params.type && row.type !== params.type) return false;
      if (!search) return true;
      return row.name.toLowerCase().includes(search) ||
        (row.code ?? '').toLowerCase().includes(search);
    });

    // Sort by sort_order then id for deterministic ordering
    const sorted = [...filtered].sort((a, b) => {
      const ao = a.sort_order ?? 9999;
      const bo = b.sort_order ?? 9999;
      return ao !== bo ? ao - bo : a.id - b.id;
    });

    const paged = paginate(sorted, params.page, params.perPage);
    const wire: SalaryComponentListWire = {
      data: paged.data.map(toComponentWire),
      meta: paged.meta,
    };
    return salaryComponentListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const stamp = new Date().toISOString();
    const row: StoredSalaryComponent = {
      id: nextComponentId,
      company_id: input.company_id ?? 1,
      salary_structure_id: input.salary_structure_id,
      name: input.name,
      code: input.code ?? undefined,
      type: input.type,
      calculation_type: input.calculation_type,
      percentage_of: input.percentage_of ?? undefined,
      default_amount: input.default_amount ?? undefined,
      is_taxable: input.is_taxable ?? undefined,
      is_variable: input.is_variable ?? undefined,
      sort_order: input.sort_order ?? undefined,
      created_at: stamp,
      updated_at: stamp,
    };
    nextComponentId += 1;
    componentStore = [row, ...componentStore];
    return salaryComponentDecoder.decode(structuredClone(toComponentWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findComponentOrThrow(id);

    const updated: StoredSalaryComponent = {
      ...row,
      salary_structure_id: input.salary_structure_id ?? row.salary_structure_id,
      name: input.name ?? row.name,
      code: input.code === null ? undefined : (input.code ?? row.code),
      type: input.type ?? row.type,
      calculation_type: input.calculation_type ?? row.calculation_type,
      percentage_of: input.percentage_of === null ? undefined : (input.percentage_of ?? row.percentage_of),
      default_amount: input.default_amount === null ? undefined : (input.default_amount ?? row.default_amount),
      is_taxable: input.is_taxable === null ? undefined : (input.is_taxable ?? row.is_taxable),
      is_variable: input.is_variable === null ? undefined : (input.is_variable ?? row.is_variable),
      sort_order: input.sort_order === null ? undefined : (input.sort_order ?? row.sort_order),
      updated_at: new Date().toISOString(),
    };
    componentStore = componentStore.map((c) => (c.id === id ? updated : c));
    return salaryComponentDecoder.decode(structuredClone(toComponentWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    findComponentOrThrow(id);
    componentStore = componentStore.filter((c) => c.id !== id);
  },
};
