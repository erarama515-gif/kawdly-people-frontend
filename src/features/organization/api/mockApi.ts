import { ApiError } from '@/lib/api/errors';
import type { FetchContext } from '@/lib/query';
import {
  departmentDecoder,
  departmentListDecoder,
  companyDecoder,
  companyListDecoder,
  branchDecoder,
  branchListDecoder,
  jobPositionDecoder,
  jobPositionListDecoder,
  jobGradeDecoder,
  jobGradeListDecoder,
  jobLevelDecoder,
  jobLevelListDecoder,
  costCenterDecoder,
  costCenterListDecoder,
} from './schema';
import type {
  DepartmentListWire,
  DepartmentWire,
  CompanyListWire,
  CompanyWire,
  BranchListWire,
  BranchWire,
  JobPositionListWire,
  JobPositionWire,
  JobGradeListWire,
  JobGradeWire,
  JobLevelListWire,
  JobLevelWire,
  CostCenterListWire,
  CostCenterWire,
} from './schema';
import type {
  DepartmentApi,
  CompanyApi,
  BranchApi,
  JobPositionApi,
  JobGradeApi,
  JobLevelApi,
  CostCenterApi,
} from './resource';

/**
 * In-process implementations of DepartmentApi, CompanyApi, BranchApi,
 * JobPositionApi, JobGradeApi, JobLevelApi, and CostCenterApi — used until
 * the Laravel backend is configured (the default — see `env.useMockApi`).
 *
 * Mirrors `employees/api/mockApi.ts`: mutable state so writes are observed by
 * later reads, latency + AbortSignal honoured, and every response decoded
 * through the same decoders a real HTTP response would use.
 */

// ─── Shared simulation helpers ────────────────────────────────────────────────

const READ_LATENCY_MS = 220;
const WRITE_LATENCY_MS = 420;

const FAILURE_RATE_KEY = 'kawdly.departmentsMockFailureRate';

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

// ─── Department ───────────────────────────────────────────────────────────────

interface StoredDepartment {
  id: number;
  uuid: string;
  company_id: number;
  parent_id?: number | undefined;
  name: string;
  code?: string | undefined;
  head_employee_id?: number | undefined;
  cost_center_id?: number | undefined;
  level?: number | undefined;
  path?: string | undefined;
  sort_order?: number | undefined;
  is_active?: boolean | undefined;
  created_at: string;
  updated_at: string;
}

/** Minimal heads referenced by seed data — enough to render names. */
interface HeadStub {
  id: number;
  employee_number: string;
  first_name: string;
  last_name: string;
  photo?: string | undefined;
}

export const HEAD_STUBS: HeadStub[] = [
  { id: 43, employee_number: 'EMP-00043', first_name: 'Ahmed', last_name: 'Sami' },
  { id: 71, employee_number: 'EMP-00071', first_name: 'Mona', last_name: 'Khaled' },
  { id: 89, employee_number: 'EMP-00089', first_name: 'Salma', last_name: 'Adel' },
  { id: 112, employee_number: 'EMP-00112', first_name: 'Karim', last_name: 'Fouad' },
  { id: 134, employee_number: 'EMP-00134', first_name: 'Layla', last_name: 'Mostafa' },
  { id: 158, employee_number: 'EMP-00158', first_name: 'Omar', last_name: 'Hassan' },
  { id: 177, employee_number: 'EMP-00177', first_name: 'Nadia', last_name: 'Fahmy' },
  { id: 203, employee_number: 'EMP-00203', first_name: 'Tamer', last_name: 'Zakaria' },
];

const SEED_DEPARTMENTS: StoredDepartment[] = [
  { id: 1, uuid: '00000000-0000-4000-8000-000000000001', company_id: 1, name: 'Sales', code: 'SLS', head_employee_id: 43, cost_center_id: 1, level: 1, sort_order: 1, is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 2, uuid: '00000000-0000-4000-8000-000000000002', company_id: 1, name: 'Operations', code: 'OPS', head_employee_id: 71, cost_center_id: 2, level: 1, sort_order: 2, is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 3, uuid: '00000000-0000-4000-8000-000000000003', company_id: 1, name: 'Finance', code: 'FIN', head_employee_id: 89, cost_center_id: 4, level: 1, sort_order: 3, is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 4, uuid: '00000000-0000-4000-8000-000000000004', company_id: 1, name: 'IT', code: 'IT', head_employee_id: 112, cost_center_id: 3, level: 1, sort_order: 4, is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 5, uuid: '00000000-0000-4000-8000-000000000005', company_id: 1, name: 'HR', code: 'HR', head_employee_id: 134, cost_center_id: 5, level: 1, sort_order: 5, is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 6, uuid: '00000000-0000-4000-8000-000000000006', company_id: 1, name: 'Marketing', code: 'MKT', head_employee_id: 158, cost_center_id: 6, level: 1, sort_order: 6, is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 7, uuid: '00000000-0000-4000-8000-000000000007', company_id: 1, name: 'Legal', code: 'LGL', head_employee_id: 177, cost_center_id: 7, level: 1, sort_order: 7, is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 8, uuid: '00000000-0000-4000-8000-000000000008', company_id: 1, name: 'Admin', code: 'ADM', head_employee_id: 203, cost_center_id: 8, level: 1, sort_order: 8, is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
];

let deptStore: StoredDepartment[] = SEED_DEPARTMENTS.map((d) => ({ ...d }));
let deptNextId = 100;

export function resetMockDepartments(): void {
  deptStore = SEED_DEPARTMENTS.map((d) => ({ ...d }));
  deptNextId = 100;
}

function deptFindOrThrow(id: number): StoredDepartment {
  const row = deptStore.find((item) => item.id === id);
  if (!row) throw new ApiError('http', `Department ${id} not found`, { status: 404 });
  return row;
}

function deptToWire(row: StoredDepartment): DepartmentWire {
  const head = row.head_employee_id !== undefined
    ? HEAD_STUBS.find((s) => s.id === row.head_employee_id)
    : undefined;
  const costCenter = row.cost_center_id !== undefined
    ? costCenterStore.find((c) => c.id === row.cost_center_id)
    : undefined;

  return departmentDecoder.decode({
    ...row,
    head: head ?? undefined,
    costCenter: costCenter ? { id: costCenter.id, name: costCenter.name } : undefined,
  });
}

export const mockDepartmentApi: DepartmentApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const search = params.search?.trim().toLowerCase();
    const filtered = deptStore.filter((row) => {
      if (params.isActive !== undefined && row.is_active !== params.isActive) return false;
      if (!search) return true;
      return row.name.toLowerCase().includes(search) || (row.code ?? '').toLowerCase().includes(search);
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const page = filtered.slice(start, start + perPage);

    const wire: DepartmentListWire = {
      data: page.map(deptToWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return departmentListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = deptNextId;
    deptNextId += 1;
    const stamp = new Date().toISOString();
    const row: StoredDepartment = {
      id,
      uuid: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
      company_id: input.company_id ?? 1,
      parent_id: input.parent_id ?? undefined,
      name: input.name,
      code: input.code ?? undefined,
      head_employee_id: input.head_employee_id ?? undefined,
      cost_center_id: input.cost_center_id ?? undefined,
      level: input.level ?? undefined,
      path: input.path ?? undefined,
      sort_order: input.sort_order ?? undefined,
      is_active: input.is_active ?? true,
      created_at: stamp,
      updated_at: stamp,
    };
    deptStore = [row, ...deptStore];
    return departmentDecoder.decode(structuredClone(deptToWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = deptFindOrThrow(id);

    const updated: StoredDepartment = {
      ...row,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code ?? undefined } : {}),
      ...(input.parent_id !== undefined ? { parent_id: input.parent_id ?? undefined } : {}),
      ...(input.head_employee_id !== undefined ? { head_employee_id: input.head_employee_id ?? undefined } : {}),
      ...(input.cost_center_id !== undefined ? { cost_center_id: input.cost_center_id ?? undefined } : {}),
      ...(input.level !== undefined ? { level: input.level ?? undefined } : {}),
      ...(input.path !== undefined ? { path: input.path ?? undefined } : {}),
      ...(input.sort_order !== undefined ? { sort_order: input.sort_order ?? undefined } : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active ?? undefined } : {}),
      updated_at: new Date().toISOString(),
    };
    deptStore = deptStore.map((item) => (item.id === id ? updated : item));
    return departmentDecoder.decode(structuredClone(deptToWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    deptFindOrThrow(id);
    deptStore = deptStore.filter((item) => item.id !== id);
  },
};

// ─── Company ─────────────────────────────────────────────────────────────────

interface StoredCompany {
  id: number;
  uuid: string;
  name: string;
  name_ar?: string | undefined;
  legal_name?: string | undefined;
  registration_number?: string | undefined;
  tax_number?: string | undefined;
  logo?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  website?: string | undefined;
  address?: string | undefined;
  city?: string | undefined;
  country_code: string;
  currency_code: string;
  timezone?: string | undefined;
  fiscal_year_start?: number | undefined;
  is_active?: boolean | undefined;
  created_at: string;
  updated_at: string;
}

const SEED_COMPANIES: StoredCompany[] = [
  {
    id: 1,
    uuid: 'c0000000-0000-4000-8000-000000000001',
    name: 'Kawdly People',
    name_ar: 'كودلي للموارد البشرية',
    legal_name: 'Kawdly People LLC',
    registration_number: 'REG-00001',
    tax_number: 'TAX-00001',
    email: 'info@kawdly.com',
    phone: '+20 2 1234 5678',
    website: 'https://kawdly.com',
    address: '15 Tahrir Square, Downtown',
    city: 'Cairo',
    country_code: 'EG',
    currency_code: 'EGP',
    timezone: 'Africa/Cairo',
    fiscal_year_start: 1,
    is_active: true,
    created_at: '2021-01-01T00:00:00.000Z',
    updated_at: '2021-01-01T00:00:00.000Z',
  },
];

let companyStore: StoredCompany[] = SEED_COMPANIES.map((c) => ({ ...c }));
let companyNextId = 200;

export function resetMockCompanies(): void {
  companyStore = SEED_COMPANIES.map((c) => ({ ...c }));
  companyNextId = 200;
}

function companyFindOrThrow(id: number): StoredCompany {
  const row = companyStore.find((item) => item.id === id);
  if (!row) throw new ApiError('http', `Company ${id} not found`, { status: 404 });
  return row;
}

function companyToWire(row: StoredCompany): CompanyWire {
  return companyDecoder.decode({ ...row });
}

export const mockCompanyApi: CompanyApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const search = params.search?.trim().toLowerCase();
    const filtered = companyStore.filter((row) => {
      if (params.isActive !== undefined && row.is_active !== params.isActive) return false;
      if (!search) return true;
      return (
        row.name.toLowerCase().includes(search) ||
        (row.registration_number ?? '').toLowerCase().includes(search) ||
        (row.city ?? '').toLowerCase().includes(search)
      );
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const pageData = filtered.slice(start, start + perPage);

    const wire: CompanyListWire = {
      data: pageData.map(companyToWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return companyListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = companyNextId;
    companyNextId += 1;
    const stamp = new Date().toISOString();
    const row: StoredCompany = {
      id,
      uuid: `c0000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
      name: input.name,
      name_ar: input.name_ar ?? undefined,
      legal_name: input.legal_name ?? undefined,
      registration_number: input.registration_number ?? undefined,
      tax_number: input.tax_number ?? undefined,
      logo: input.logo ?? undefined,
      email: input.email ?? undefined,
      phone: input.phone ?? undefined,
      website: input.website ?? undefined,
      address: input.address ?? undefined,
      city: input.city ?? undefined,
      country_code: input.country_code,
      currency_code: input.currency_code,
      timezone: input.timezone ?? undefined,
      fiscal_year_start: input.fiscal_year_start ?? undefined,
      is_active: input.is_active ?? true,
      created_at: stamp,
      updated_at: stamp,
    };
    companyStore = [row, ...companyStore];
    return companyDecoder.decode(structuredClone(companyToWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = companyFindOrThrow(id);

    const updated: StoredCompany = {
      ...row,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.name_ar !== undefined ? { name_ar: input.name_ar ?? undefined } : {}),
      ...(input.legal_name !== undefined ? { legal_name: input.legal_name ?? undefined } : {}),
      ...(input.registration_number !== undefined ? { registration_number: input.registration_number ?? undefined } : {}),
      ...(input.tax_number !== undefined ? { tax_number: input.tax_number ?? undefined } : {}),
      ...(input.logo !== undefined ? { logo: input.logo ?? undefined } : {}),
      ...(input.email !== undefined ? { email: input.email ?? undefined } : {}),
      ...(input.phone !== undefined ? { phone: input.phone ?? undefined } : {}),
      ...(input.website !== undefined ? { website: input.website ?? undefined } : {}),
      ...(input.address !== undefined ? { address: input.address ?? undefined } : {}),
      ...(input.city !== undefined ? { city: input.city ?? undefined } : {}),
      ...(input.country_code !== undefined ? { country_code: input.country_code } : {}),
      ...(input.currency_code !== undefined ? { currency_code: input.currency_code } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone ?? undefined } : {}),
      ...(input.fiscal_year_start !== undefined ? { fiscal_year_start: input.fiscal_year_start ?? undefined } : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active ?? undefined } : {}),
      updated_at: new Date().toISOString(),
    };
    companyStore = companyStore.map((item) => (item.id === id ? updated : item));
    return companyDecoder.decode(structuredClone(companyToWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    companyFindOrThrow(id);
    companyStore = companyStore.filter((item) => item.id !== id);
  },
};

// ─── Branch ──────────────────────────────────────────────────────────────────

interface StoredBranch {
  id: number;
  uuid: string;
  company_id: number;
  name: string;
  code?: string | undefined;
  address?: string | undefined;
  city?: string | undefined;
  country_code?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  geofence_radius?: number | undefined;
  phone?: string | undefined;
  is_headquarters?: boolean | undefined;
  is_active?: boolean | undefined;
  created_at: string;
  updated_at: string;
}

const SEED_BRANCHES: StoredBranch[] = [
  {
    id: 1,
    uuid: 'b0000000-0000-4000-8000-000000000001',
    company_id: 1,
    name: 'Cairo HQ',
    code: 'CAI-HQ',
    address: '15 Tahrir Square, Downtown',
    city: 'Cairo',
    country_code: 'EG',
    latitude: 30.0444,
    longitude: 31.2357,
    geofence_radius: 200,
    phone: '+20 2 1234 5678',
    is_headquarters: true,
    is_active: true,
    created_at: '2021-01-01T00:00:00.000Z',
    updated_at: '2021-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    uuid: 'b0000000-0000-4000-8000-000000000002',
    company_id: 1,
    name: 'Alexandria Branch',
    code: 'ALX',
    city: 'Alexandria',
    country_code: 'EG',
    phone: '+20 3 5678 1234',
    is_headquarters: false,
    is_active: true,
    created_at: '2021-06-01T00:00:00.000Z',
    updated_at: '2021-06-01T00:00:00.000Z',
  },
  {
    id: 3,
    uuid: 'b0000000-0000-4000-8000-000000000003',
    company_id: 1,
    name: 'New Cairo Office',
    code: 'NC',
    address: '5th Settlement, New Cairo',
    city: 'New Cairo',
    country_code: 'EG',
    is_headquarters: false,
    is_active: false,
    created_at: '2022-03-01T00:00:00.000Z',
    updated_at: '2022-03-01T00:00:00.000Z',
  },
];

let branchStore: StoredBranch[] = SEED_BRANCHES.map((b) => ({ ...b }));
let branchNextId = 300;

export function resetMockBranches(): void {
  branchStore = SEED_BRANCHES.map((b) => ({ ...b }));
  branchNextId = 300;
}

function branchFindOrThrow(id: number): StoredBranch {
  const row = branchStore.find((item) => item.id === id);
  if (!row) throw new ApiError('http', `Branch ${id} not found`, { status: 404 });
  return row;
}

function branchToWire(row: StoredBranch): BranchWire {
  const company = companyStore.find((c) => c.id === row.company_id);
  return branchDecoder.decode({
    ...row,
    company: company ? { id: company.id, name: company.name } : undefined,
  });
}

export const mockBranchApi: BranchApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const search = params.search?.trim().toLowerCase();
    const filtered = branchStore.filter((row) => {
      if (params.companyId !== undefined && row.company_id !== params.companyId) return false;
      if (params.isActive !== undefined && row.is_active !== params.isActive) return false;
      if (!search) return true;
      return (
        row.name.toLowerCase().includes(search) ||
        (row.code ?? '').toLowerCase().includes(search) ||
        (row.city ?? '').toLowerCase().includes(search)
      );
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const pageData = filtered.slice(start, start + perPage);

    const wire: BranchListWire = {
      data: pageData.map(branchToWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return branchListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = branchNextId;
    branchNextId += 1;
    const stamp = new Date().toISOString();
    const row: StoredBranch = {
      id,
      uuid: `b0000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
      company_id: input.company_id ?? 1,
      name: input.name,
      code: input.code ?? undefined,
      address: input.address ?? undefined,
      city: input.city ?? undefined,
      country_code: input.country_code ?? undefined,
      latitude: input.latitude ?? undefined,
      longitude: input.longitude ?? undefined,
      geofence_radius: input.geofence_radius ?? undefined,
      phone: input.phone ?? undefined,
      is_headquarters: input.is_headquarters ?? false,
      is_active: input.is_active ?? true,
      created_at: stamp,
      updated_at: stamp,
    };
    branchStore = [row, ...branchStore];
    return branchDecoder.decode(structuredClone(branchToWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = branchFindOrThrow(id);

    const updated: StoredBranch = {
      ...row,
      ...(input.company_id !== undefined ? { company_id: input.company_id } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code ?? undefined } : {}),
      ...(input.address !== undefined ? { address: input.address ?? undefined } : {}),
      ...(input.city !== undefined ? { city: input.city ?? undefined } : {}),
      ...(input.country_code !== undefined ? { country_code: input.country_code ?? undefined } : {}),
      ...(input.latitude !== undefined ? { latitude: input.latitude ?? undefined } : {}),
      ...(input.longitude !== undefined ? { longitude: input.longitude ?? undefined } : {}),
      ...(input.geofence_radius !== undefined ? { geofence_radius: input.geofence_radius ?? undefined } : {}),
      ...(input.phone !== undefined ? { phone: input.phone ?? undefined } : {}),
      ...(input.is_headquarters !== undefined ? { is_headquarters: input.is_headquarters ?? undefined } : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active ?? undefined } : {}),
      updated_at: new Date().toISOString(),
    };
    branchStore = branchStore.map((item) => (item.id === id ? updated : item));
    return branchDecoder.decode(structuredClone(branchToWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    branchFindOrThrow(id);
    branchStore = branchStore.filter((item) => item.id !== id);
  },
};

// ─── JobGrade ─────────────────────────────────────────────────────────────────

interface StoredJobGrade {
  id: number;
  company_id: number;
  name: string;
  code?: string | undefined;
  min_salary?: number | undefined;
  mid_salary?: number | undefined;
  max_salary?: number | undefined;
  sort_order?: number | undefined;
  created_at: string;
  updated_at: string;
}

/** Mirrors `OrganizationSeeder.php`'s `$gradeData` exactly. */
const SEED_JOB_GRADES: StoredJobGrade[] = [
  { id: 1, company_id: 1, code: 'G1', name: 'Associate', min_salary: 4000, mid_salary: 5500, max_salary: 7000, sort_order: 1, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 2, company_id: 1, code: 'G2', name: 'Professional', min_salary: 6500, mid_salary: 8500, max_salary: 10500, sort_order: 2, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 3, company_id: 1, code: 'G3', name: 'Senior Professional', min_salary: 9500, mid_salary: 12500, max_salary: 15500, sort_order: 3, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 4, company_id: 1, code: 'G4', name: 'Lead / Manager', min_salary: 14000, mid_salary: 18000, max_salary: 22000, sort_order: 4, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 5, company_id: 1, code: 'G5', name: 'Senior Manager', min_salary: 20000, mid_salary: 26000, max_salary: 32000, sort_order: 5, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 6, company_id: 1, code: 'G6', name: 'Director', min_salary: 30000, mid_salary: 38000, max_salary: 46000, sort_order: 6, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
];

let jobGradeStore: StoredJobGrade[] = SEED_JOB_GRADES.map((g) => ({ ...g }));
let jobGradeNextId = 500;

export function resetMockJobGrades(): void {
  jobGradeStore = SEED_JOB_GRADES.map((g) => ({ ...g }));
  jobGradeNextId = 500;
}

function jobGradeFindOrThrow(id: number): StoredJobGrade {
  const row = jobGradeStore.find((item) => item.id === id);
  if (!row) throw new ApiError('http', `JobGrade ${id} not found`, { status: 404 });
  return row;
}

function jobGradeToWire(row: StoredJobGrade): JobGradeWire {
  return jobGradeDecoder.decode({ ...row });
}

export const mockJobGradeApi: JobGradeApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const filtered = jobGradeStore.filter((row) => {
      if (params.companyId !== undefined && row.company_id !== params.companyId) return false;
      return true;
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const pageData = filtered.slice(start, start + perPage);

    const wire: JobGradeListWire = {
      data: pageData.map(jobGradeToWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return jobGradeListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = jobGradeNextId;
    jobGradeNextId += 1;
    const stamp = new Date().toISOString();
    const row: StoredJobGrade = {
      id,
      company_id: input.company_id ?? 1,
      name: input.name,
      code: input.code ?? undefined,
      min_salary: input.min_salary ?? undefined,
      mid_salary: input.mid_salary ?? undefined,
      max_salary: input.max_salary ?? undefined,
      sort_order: input.sort_order ?? undefined,
      created_at: stamp,
      updated_at: stamp,
    };
    jobGradeStore = [row, ...jobGradeStore];
    return jobGradeDecoder.decode(structuredClone(jobGradeToWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = jobGradeFindOrThrow(id);

    const updated: StoredJobGrade = {
      ...row,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code ?? undefined } : {}),
      ...(input.min_salary !== undefined ? { min_salary: input.min_salary ?? undefined } : {}),
      ...(input.mid_salary !== undefined ? { mid_salary: input.mid_salary ?? undefined } : {}),
      ...(input.max_salary !== undefined ? { max_salary: input.max_salary ?? undefined } : {}),
      ...(input.sort_order !== undefined ? { sort_order: input.sort_order ?? undefined } : {}),
      updated_at: new Date().toISOString(),
    };
    jobGradeStore = jobGradeStore.map((item) => (item.id === id ? updated : item));
    return jobGradeDecoder.decode(structuredClone(jobGradeToWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    jobGradeFindOrThrow(id);
    jobGradeStore = jobGradeStore.filter((item) => item.id !== id);
  },
};

// ─── JobLevel ─────────────────────────────────────────────────────────────────

interface StoredJobLevel {
  id: number;
  company_id: number;
  name: string;
  sort_order?: number | undefined;
  created_at: string;
  updated_at: string;
}

/** Mirrors `OrganizationSeeder.php`'s `$levelData` exactly. */
const SEED_JOB_LEVELS: StoredJobLevel[] = [
  { id: 1, company_id: 1, name: 'Junior', sort_order: 1, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 2, company_id: 1, name: 'Mid-Level', sort_order: 2, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 3, company_id: 1, name: 'Senior', sort_order: 3, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 4, company_id: 1, name: 'Lead', sort_order: 4, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 5, company_id: 1, name: 'Principal', sort_order: 5, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 6, company_id: 1, name: 'Director', sort_order: 6, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
];

let jobLevelStore: StoredJobLevel[] = SEED_JOB_LEVELS.map((l) => ({ ...l }));
let jobLevelNextId = 600;

export function resetMockJobLevels(): void {
  jobLevelStore = SEED_JOB_LEVELS.map((l) => ({ ...l }));
  jobLevelNextId = 600;
}

function jobLevelFindOrThrow(id: number): StoredJobLevel {
  const row = jobLevelStore.find((item) => item.id === id);
  if (!row) throw new ApiError('http', `JobLevel ${id} not found`, { status: 404 });
  return row;
}

function jobLevelToWire(row: StoredJobLevel): JobLevelWire {
  return jobLevelDecoder.decode({ ...row });
}

export const mockJobLevelApi: JobLevelApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const filtered = jobLevelStore.filter((row) => {
      if (params.companyId !== undefined && row.company_id !== params.companyId) return false;
      return true;
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const pageData = filtered.slice(start, start + perPage);

    const wire: JobLevelListWire = {
      data: pageData.map(jobLevelToWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return jobLevelListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = jobLevelNextId;
    jobLevelNextId += 1;
    const stamp = new Date().toISOString();
    const row: StoredJobLevel = {
      id,
      company_id: input.company_id ?? 1,
      name: input.name,
      sort_order: input.sort_order ?? undefined,
      created_at: stamp,
      updated_at: stamp,
    };
    jobLevelStore = [row, ...jobLevelStore];
    return jobLevelDecoder.decode(structuredClone(jobLevelToWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = jobLevelFindOrThrow(id);

    const updated: StoredJobLevel = {
      ...row,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.sort_order !== undefined ? { sort_order: input.sort_order ?? undefined } : {}),
      updated_at: new Date().toISOString(),
    };
    jobLevelStore = jobLevelStore.map((item) => (item.id === id ? updated : item));
    return jobLevelDecoder.decode(structuredClone(jobLevelToWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    jobLevelFindOrThrow(id);
    jobLevelStore = jobLevelStore.filter((item) => item.id !== id);
  },
};

// ─── CostCenter ───────────────────────────────────────────────────────────────

interface StoredCostCenter {
  id: number;
  company_id: number;
  name: string;
  code?: string | undefined;
  is_active?: boolean | undefined;
  created_at: string;
  updated_at: string;
}

/** Mirrors `OrganizationSeeder.php`'s cost-center rows exactly. */
const SEED_COST_CENTERS: StoredCostCenter[] = [
  { id: 1, company_id: 1, name: 'Sales Cost Center', code: 'CC-SALES', is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 2, company_id: 1, name: 'Operations Cost Center', code: 'CC-OPS', is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 3, company_id: 1, name: 'IT Cost Center', code: 'CC-IT', is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 4, company_id: 1, name: 'Finance Cost Center', code: 'CC-FIN', is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 5, company_id: 1, name: 'HR Cost Center', code: 'CC-HR', is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 6, company_id: 1, name: 'Marketing Cost Center', code: 'CC-MKT', is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 7, company_id: 1, name: 'Legal Cost Center', code: 'CC-LEGAL', is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 8, company_id: 1, name: 'Admin Cost Center', code: 'CC-ADMIN', is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
];

let costCenterStore: StoredCostCenter[] = SEED_COST_CENTERS.map((c) => ({ ...c }));
let costCenterNextId = 900;

export function resetMockCostCenters(): void {
  costCenterStore = SEED_COST_CENTERS.map((c) => ({ ...c }));
  costCenterNextId = 900;
}

function costCenterFindOrThrow(id: number): StoredCostCenter {
  const row = costCenterStore.find((item) => item.id === id);
  if (!row) throw new ApiError('http', `CostCenter ${id} not found`, { status: 404 });
  return row;
}

function costCenterToWire(row: StoredCostCenter): CostCenterWire {
  return costCenterDecoder.decode({ ...row });
}

export const mockCostCenterApi: CostCenterApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const filtered = costCenterStore.filter((row) => {
      if (params.companyId !== undefined && row.company_id !== params.companyId) return false;
      if (params.isActive !== undefined && row.is_active !== params.isActive) return false;
      return true;
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const pageData = filtered.slice(start, start + perPage);

    const wire: CostCenterListWire = {
      data: pageData.map(costCenterToWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return costCenterListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = costCenterNextId;
    costCenterNextId += 1;
    const stamp = new Date().toISOString();
    const row: StoredCostCenter = {
      id,
      company_id: input.company_id ?? 1,
      name: input.name,
      code: input.code ?? undefined,
      is_active: input.is_active ?? true,
      created_at: stamp,
      updated_at: stamp,
    };
    costCenterStore = [row, ...costCenterStore];
    return costCenterDecoder.decode(structuredClone(costCenterToWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = costCenterFindOrThrow(id);

    const updated: StoredCostCenter = {
      ...row,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code ?? undefined } : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active ?? undefined } : {}),
      updated_at: new Date().toISOString(),
    };
    costCenterStore = costCenterStore.map((item) => (item.id === id ? updated : item));
    return costCenterDecoder.decode(structuredClone(costCenterToWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    costCenterFindOrThrow(id);
    costCenterStore = costCenterStore.filter((item) => item.id !== id);
  },
};

// ─── JobPosition ──────────────────────────────────────────────────────────────

interface StoredJobPosition {
  id: number;
  uuid: string;
  company_id: number;
  department_id?: number | undefined;
  title: string;
  title_ar?: string | undefined;
  code?: string | undefined;
  job_grade_id?: number | undefined;
  job_level_id?: number | undefined;
  description?: string | undefined;
  requirements?: string | undefined;
  headcount?: number | undefined;
  is_active?: boolean | undefined;
  created_at: string;
  updated_at: string;
}

const SEED_JOB_POSITIONS: StoredJobPosition[] = [
  { id: 1, uuid: 'jp000000-0000-4000-8000-000000000001', company_id: 1, department_id: 1, title: 'Sales Manager', title_ar: 'مدير المبيعات', code: 'SM-001', headcount: 1, is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 2, uuid: 'jp000000-0000-4000-8000-000000000002', company_id: 1, department_id: 1, title: 'Sales Executive', title_ar: 'مندوب مبيعات', code: 'SE-001', headcount: 5, is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 3, uuid: 'jp000000-0000-4000-8000-000000000003', company_id: 1, department_id: 2, title: 'Operations Manager', title_ar: 'مدير العمليات', code: 'OM-001', headcount: 1, is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 4, uuid: 'jp000000-0000-4000-8000-000000000004', company_id: 1, department_id: 2, title: 'Logistics Coordinator', code: 'LC-001', headcount: 3, is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 5, uuid: 'jp000000-0000-4000-8000-000000000005', company_id: 1, department_id: 3, title: 'Finance Manager', title_ar: 'مدير المالية', code: 'FM-001', headcount: 1, is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 6, uuid: 'jp000000-0000-4000-8000-000000000006', company_id: 1, department_id: 3, title: 'Accountant', title_ar: 'محاسب', code: 'ACC-001', headcount: 4, is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 7, uuid: 'jp000000-0000-4000-8000-000000000007', company_id: 1, department_id: 4, title: 'IT Manager', title_ar: 'مدير تقنية المعلومات', code: 'ITM-001', headcount: 1, is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 8, uuid: 'jp000000-0000-4000-8000-000000000008', company_id: 1, department_id: 4, title: 'Software Engineer', title_ar: 'مهندس برمجيات', code: 'SWE-001', headcount: 6, is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 9, uuid: 'jp000000-0000-4000-8000-000000000009', company_id: 1, department_id: 5, title: 'HR Manager', title_ar: 'مدير الموارد البشرية', code: 'HRM-001', headcount: 1, is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 10, uuid: 'jp000000-0000-4000-8000-000000000010', company_id: 1, department_id: 5, title: 'HR Specialist', code: 'HRS-001', headcount: 2, is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 11, uuid: 'jp000000-0000-4000-8000-000000000011', company_id: 1, department_id: 6, title: 'Marketing Manager', title_ar: 'مدير التسويق', code: 'MM-001', headcount: 1, is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 12, uuid: 'jp000000-0000-4000-8000-000000000012', company_id: 1, department_id: 6, title: 'Content Specialist', code: 'CS-001', headcount: 2, is_active: false, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 13, uuid: 'jp000000-0000-4000-8000-000000000013', company_id: 1, department_id: 7, title: 'Legal Counsel', title_ar: 'مستشار قانوني', code: 'LC-002', headcount: 1, is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 14, uuid: 'jp000000-0000-4000-8000-000000000014', company_id: 1, department_id: 8, title: 'Office Manager', title_ar: 'مدير المكتب', code: 'OFFM-001', headcount: 1, is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 15, uuid: 'jp000000-0000-4000-8000-000000000015', company_id: 1, title: 'General Consultant', code: 'GC-001', headcount: 2, is_active: true, created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
];

let jobPositionStore: StoredJobPosition[] = SEED_JOB_POSITIONS.map((jp) => ({ ...jp }));
let jobPositionNextId = 400;

export function resetMockJobPositions(): void {
  jobPositionStore = SEED_JOB_POSITIONS.map((jp) => ({ ...jp }));
  jobPositionNextId = 400;
}

function jobPositionFindOrThrow(id: number): StoredJobPosition {
  const row = jobPositionStore.find((item) => item.id === id);
  if (!row) throw new ApiError('http', `JobPosition ${id} not found`, { status: 404 });
  return row;
}

function jobPositionToWire(row: StoredJobPosition): JobPositionWire {
  const company = companyStore.find((c) => c.id === row.company_id);
  const department = SEED_DEPARTMENTS.find((d) => d.id === row.department_id);
  const jobGrade = jobGradeStore.find((g) => g.id === row.job_grade_id);
  const jobLevel = jobLevelStore.find((l) => l.id === row.job_level_id);

  return jobPositionDecoder.decode({
    ...row,
    company: company ? { id: company.id, name: company.name } : undefined,
    department: department ? { id: department.id, name: department.name } : undefined,
    jobGrade: jobGrade ? { id: jobGrade.id, name: jobGrade.name } : undefined,
    jobLevel: jobLevel ? { id: jobLevel.id, name: jobLevel.name } : undefined,
  });
}

export const mockJobPositionApi: JobPositionApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const search = params.search?.trim().toLowerCase();
    const filtered = jobPositionStore.filter((row) => {
      if (params.companyId !== undefined && row.company_id !== params.companyId) return false;
      if (params.departmentId !== undefined && row.department_id !== params.departmentId) return false;
      if (params.jobGradeId !== undefined && row.job_grade_id !== params.jobGradeId) return false;
      if (params.jobLevelId !== undefined && row.job_level_id !== params.jobLevelId) return false;
      if (params.isActive !== undefined && row.is_active !== params.isActive) return false;
      if (!search) return true;
      return (
        row.title.toLowerCase().includes(search) ||
        (row.code ?? '').toLowerCase().includes(search) ||
        (row.title_ar ?? '').toLowerCase().includes(search)
      );
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const pageData = filtered.slice(start, start + perPage);

    const wire: JobPositionListWire = {
      data: pageData.map(jobPositionToWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return jobPositionListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = jobPositionNextId;
    jobPositionNextId += 1;
    const stamp = new Date().toISOString();
    const row: StoredJobPosition = {
      id,
      uuid: `jp000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
      company_id: input.company_id ?? 1,
      department_id: input.department_id ?? undefined,
      title: input.title,
      title_ar: input.title_ar ?? undefined,
      code: input.code ?? undefined,
      job_grade_id: input.job_grade_id ?? undefined,
      job_level_id: input.job_level_id ?? undefined,
      description: input.description ?? undefined,
      requirements: input.requirements ?? undefined,
      headcount: input.headcount ?? undefined,
      is_active: input.is_active ?? true,
      created_at: stamp,
      updated_at: stamp,
    };
    jobPositionStore = [row, ...jobPositionStore];
    return jobPositionDecoder.decode(structuredClone(jobPositionToWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = jobPositionFindOrThrow(id);

    const updated: StoredJobPosition = {
      ...row,
      ...(input.company_id !== undefined ? { company_id: input.company_id } : {}),
      ...(input.department_id !== undefined ? { department_id: input.department_id ?? undefined } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.title_ar !== undefined ? { title_ar: input.title_ar ?? undefined } : {}),
      ...(input.code !== undefined ? { code: input.code ?? undefined } : {}),
      ...(input.job_grade_id !== undefined ? { job_grade_id: input.job_grade_id ?? undefined } : {}),
      ...(input.job_level_id !== undefined ? { job_level_id: input.job_level_id ?? undefined } : {}),
      ...(input.description !== undefined ? { description: input.description ?? undefined } : {}),
      ...(input.requirements !== undefined ? { requirements: input.requirements ?? undefined } : {}),
      ...(input.headcount !== undefined ? { headcount: input.headcount ?? undefined } : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active ?? undefined } : {}),
      updated_at: new Date().toISOString(),
    };
    jobPositionStore = jobPositionStore.map((item) => (item.id === id ? updated : item));
    return jobPositionDecoder.decode(structuredClone(jobPositionToWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    jobPositionFindOrThrow(id);
    jobPositionStore = jobPositionStore.filter((item) => item.id !== id);
  },
};
