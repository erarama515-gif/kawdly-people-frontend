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
  JobGradeListWire,
  JobGradeWire,
  JobLevelListWire,
  JobLevelWire,
  CostCenterListWire,
  CostCenterWire,
} from './schema';

/**
 * The Organization module's remote resource contract.
 *
 * PRIMARY resource: Department — full CRUD.
 * Full CRUD resources: Company, Branch, JobPosition, JobGrade, JobLevel,
 * CostCenter.
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
  /** Injected by the backend's auth middleware; omit from form payloads. */
  company_id?: number;
  parent_id?: number | null;
  name: string;
  code?: string | null;
  head_employee_id?: number | null;
  cost_center_id?: number | null;
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
  /** Injected by the backend's auth middleware; omit from form payloads. */
  company_id?: number;
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
  jobGradeId?: number | undefined;
  jobLevelId?: number | undefined;
  isActive?: boolean | undefined;
}

/** Shape of `StoreJobPositionRequest`'s validated fields (confirmed from backend). */
export interface JobPositionInput {
  /** Injected by the backend's auth middleware; omit from form payloads. */
  company_id?: number;
  department_id?: number | null;
  title: string;
  title_ar?: string | null;
  code?: string | null;
  job_grade_id?: number | null;
  job_level_id?: number | null;
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

// ─── JobGrade ───────────────────────────────────────────────────────────────

export interface JobGradeListParams {
  page?: number;
  perPage?: number;
  companyId?: number | undefined;
}

/** Shape of `StoreJobGradeRequest`'s validated fields (confirmed from backend). */
export interface JobGradeInput {
  /** Injected by the backend's auth middleware; omit from form payloads. */
  company_id?: number;
  name: string;
  code?: string | null;
  min_salary?: number | null;
  mid_salary?: number | null;
  max_salary?: number | null;
  sort_order?: number | null;
}

export type JobGradeUpdateInput = Partial<JobGradeInput>;

export interface JobGradeApi {
  list(context: FetchContext, params: JobGradeListParams): Promise<JobGradeListWire>;
  create(context: FetchContext, input: JobGradeInput): Promise<JobGradeWire>;
  update(context: FetchContext, id: number, input: JobGradeUpdateInput): Promise<JobGradeWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

export const jobGradeKeys = {
  all: ['job-grades'] as const satisfies QueryKey,
  list: (params: JobGradeListParams) => ['job-grades', 'list', params] as const satisfies QueryKey,
};

// ─── JobLevel ───────────────────────────────────────────────────────────────

export interface JobLevelListParams {
  page?: number;
  perPage?: number;
  companyId?: number | undefined;
}

/** Shape of `StoreJobLevelRequest`'s validated fields (confirmed from backend). */
export interface JobLevelInput {
  /** Injected by the backend's auth middleware; omit from form payloads. */
  company_id?: number;
  name: string;
  sort_order?: number | null;
}

export type JobLevelUpdateInput = Partial<JobLevelInput>;

export interface JobLevelApi {
  list(context: FetchContext, params: JobLevelListParams): Promise<JobLevelListWire>;
  create(context: FetchContext, input: JobLevelInput): Promise<JobLevelWire>;
  update(context: FetchContext, id: number, input: JobLevelUpdateInput): Promise<JobLevelWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

export const jobLevelKeys = {
  all: ['job-levels'] as const satisfies QueryKey,
  list: (params: JobLevelListParams) => ['job-levels', 'list', params] as const satisfies QueryKey,
};

// ─── CostCenter ───────────────────────────────────────────────────────────────

export interface CostCenterListParams {
  page?: number;
  perPage?: number;
  companyId?: number | undefined;
  isActive?: boolean | undefined;
}

/** Shape of `StoreCostCenterRequest`'s validated fields (confirmed from backend). */
export interface CostCenterInput {
  /** Injected by the backend's auth middleware; omit from form payloads. */
  company_id?: number;
  name: string;
  code?: string | null;
  is_active?: boolean | null;
}

export type CostCenterUpdateInput = Partial<CostCenterInput>;

export interface CostCenterApi {
  list(context: FetchContext, params: CostCenterListParams): Promise<CostCenterListWire>;
  create(context: FetchContext, input: CostCenterInput): Promise<CostCenterWire>;
  update(context: FetchContext, id: number, input: CostCenterUpdateInput): Promise<CostCenterWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

export const costCenterKeys = {
  all: ['cost-centers'] as const satisfies QueryKey,
  list: (params: CostCenterListParams) => ['cost-centers', 'list', params] as const satisfies QueryKey,
};
