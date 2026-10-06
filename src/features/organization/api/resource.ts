import type { FetchContext, QueryKey } from '@/lib/query';
import type {
  DepartmentListWire,
  DepartmentWire,
  CompanyListWire,
  CompanyWire,
  BranchListWire,
  BranchWire,
  JobPositionListWire,
  JobPositionWire,
} from './schema';

/**
 * The Organization module's remote resource contract.
 *
 * PRIMARY resource: Department — full CRUD.
 * New full CRUD resources: Company, Branch, JobPosition.
 *
 * Components never call this directly — they go through the query hooks in
 * `queries.ts`. Two implementations satisfy each Api interface: `http*Api`
 * (real Laravel endpoints) and `mock*Api` (in-process). Mirrors the
 * Employees feature's exact `api/` pattern.
 */

// ─── Department ───────────────────────────────────────────────────────────────

export interface DepartmentListParams {
  page?: number;
  perPage?: number;
  search?: string | undefined;
  isActive?: boolean | undefined;
}

/** Shape of `StoreDepartmentRequest`'s validated fields (confirmed from backend). */
export interface DepartmentInput {
  company_id: number;
  parent_id?: number | null;
  name: string;
  code?: string | null;
  head_employee_id?: number | null;
  /** cost_center_id is intentionally omitted — cost-centers resource not yet built. */
  level?: number | null;
  path?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
}

/** `UpdateDepartmentRequest` wraps the same fields in `sometimes` — any subset is valid. */
export type DepartmentUpdateInput = Partial<DepartmentInput>;

export interface DepartmentApi {
  list(context: FetchContext, params: DepartmentListParams): Promise<DepartmentListWire>;
  create(context: FetchContext, input: DepartmentInput): Promise<DepartmentWire>;
  update(context: FetchContext, id: number, input: DepartmentUpdateInput): Promise<DepartmentWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

/** Cache keys. Every department read hangs off `all` so invalidation after a write is total. */
export const departmentKeys = {
  all: ['departments'] as const satisfies QueryKey,
  list: (params: DepartmentListParams) => ['departments', 'list', params] as const satisfies QueryKey,
};

// ─── Company ─────────────────────────────────────────────────────────────────

export interface CompanyListParams {
  page?: number;
  perPage?: number;
  search?: string | undefined;
  isActive?: boolean | undefined;
}

/** Shape of `StoreCompanyRequest`'s validated fields (confirmed from backend). */
export interface CompanyInput {
  name: string;
  name_ar?: string | null;
  legal_name?: string | null;
  registration_number?: string | null;
  tax_number?: string | null;
  /** Plain text URL/path — no file upload (same precedent as Documents' file_path). */
  logo?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  country_code: string;
  currency_code: string;
  timezone?: string | null;
  fiscal_year_start?: number | null;
  /** work_week is a nullable array — omitted from form (no simple scalar). */
  /** settings is a nullable array — omitted from form. */
  is_active?: boolean | null;
}

export type CompanyUpdateInput = Partial<CompanyInput>;

export interface CompanyApi {
  list(context: FetchContext, params: CompanyListParams): Promise<CompanyListWire>;
  create(context: FetchContext, input: CompanyInput): Promise<CompanyWire>;
  update(context: FetchContext, id: number, input: CompanyUpdateInput): Promise<CompanyWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

export const companyKeys = {
  all: ['companies'] as const satisfies QueryKey,
  list: (params: CompanyListParams) => ['companies', 'list', params] as const satisfies QueryKey,
};

// ─── Branch ──────────────────────────────────────────────────────────────────

export interface BranchListParams {
  page?: number;
  perPage?: number;
  search?: string | undefined;
  companyId?: number | undefined;
  isActive?: boolean | undefined;
}

/** Shape of `StoreBranchRequest`'s validated fields (confirmed from backend). */
export interface BranchInput {
  company_id: number;
  name: string;
  code?: string | null;
  address?: string | null;
  city?: string | null;
  country_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geofence_radius?: number | null;
  phone?: string | null;
  is_headquarters?: boolean | null;
  is_active?: boolean | null;
}

export type BranchUpdateInput = Partial<BranchInput>;

export interface BranchApi {
  list(context: FetchContext, params: BranchListParams): Promise<BranchListWire>;
  create(context: FetchContext, input: BranchInput): Promise<BranchWire>;
  update(context: FetchContext, id: number, input: BranchUpdateInput): Promise<BranchWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

export const branchKeys = {
  all: ['branches'] as const satisfies QueryKey,
  list: (params: BranchListParams) => ['branches', 'list', params] as const satisfies QueryKey,
};

// ─── JobPosition ──────────────────────────────────────────────────────────────

export interface JobPositionListParams {
  page?: number;
  perPage?: number;
  search?: string | undefined;
  companyId?: number | undefined;
  departmentId?: number | undefined;
  isActive?: boolean | undefined;
}

/** Shape of `StoreJobPositionRequest`'s validated fields (confirmed from backend). */
export interface JobPositionInput {
  company_id: number;
  department_id?: number | null;
  title: string;
  title_ar?: string | null;
  code?: string | null;
  /** job_grade_id omitted — JobGrade resource not yet built. */
  /** job_level_id omitted — JobLevel resource not yet built. */
  description?: string | null;
  requirements?: string | null;
  headcount?: number | null;
  is_active?: boolean | null;
}

export type JobPositionUpdateInput = Partial<JobPositionInput>;

export interface JobPositionApi {
  list(context: FetchContext, params: JobPositionListParams): Promise<JobPositionListWire>;
  create(context: FetchContext, input: JobPositionInput): Promise<JobPositionWire>;
  update(context: FetchContext, id: number, input: JobPositionUpdateInput): Promise<JobPositionWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

export const jobPositionKeys = {
  all: ['job-positions'] as const satisfies QueryKey,
  list: (params: JobPositionListParams) => ['job-positions', 'list', params] as const satisfies QueryKey,
};
