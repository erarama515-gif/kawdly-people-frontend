import type { FetchContext, QueryKey } from '@/lib/query';
import type { EmployeeListWire, EmployeeWire } from './schema';

/**
 * The Employees module's remote resource contract.
 *
 * Components never call this directly — they go through the query hooks in
 * `queries.ts`. Two implementations satisfy it: `httpEmployeeApi` (real
 * Laravel endpoints under `/api/v1/employees`) and `mockEmployeeApi`
 * (in-process, the default until a backend is configured). Mirrors the
 * Dashboard feature's exact `api/` pattern.
 */

export type EmployeeGender = 'male' | 'female';
export type EmployeeMaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern';
export type WorkLocation = 'office' | 'remote' | 'hybrid';
export type EmployeeStatus = 'active' | 'on_leave' | 'suspended' | 'terminated' | 'resigned';

export interface EmployeeListParams {
  page?: number;
  perPage?: number;
  search?: string | undefined;
  status?: EmployeeStatus | undefined;
  departmentId?: number | undefined;
}

/** Shape of `StoreEmployeeRequest`'s validated fields. */
export interface EmployeeInput {
  /** Injected by the backend's auth middleware; omit from form payloads. */
  company_id?: number;
  branch_id: number;
  department_id: number;
  job_position_id: number;
  job_grade_id?: number | null;
  job_level_id?: number | null;
  employee_number: string;
  first_name: string;
  last_name: string;
  first_name_ar?: string | null;
  last_name_ar?: string | null;
  email?: string | null;
  phone?: string | null;
  /** Storage path returned by POST /api/v1/uploads. */
  photo?: string | null;
  gender?: EmployeeGender | null;
  marital_status?: EmployeeMaritalStatus | null;
  joining_date: string;
  employment_type: EmploymentType;
  work_location: WorkLocation;
  status?: EmployeeStatus;
}

/** `UpdateEmployeeRequest` wraps the same fields in `sometimes` — any subset is valid. */
export type EmployeeUpdateInput = Partial<EmployeeInput>;

/**
 * Lifecycle action payloads. These mirror the inline `$request->validate()`
 * rules in `EmployeeLifecycleController` verbatim (there are no dedicated
 * FormRequest classes on the backend for these five actions) — see
 * `routes/api/employee-lifecycle.php` for the route list.
 */
export interface EmployeePromoteInput {
  new_job_position_id?: number | null;
  new_job_grade_id?: number | null;
  new_job_level_id?: number | null;
  effective_date: string;
  reason?: string | null;
}

export interface EmployeeTransferInput {
  new_branch_id?: number | null;
  new_department_id?: number | null;
  new_direct_manager_id?: number | null;
  effective_date: string;
  reason?: string | null;
}

export interface EmployeeSuspendInput {
  reason: string;
  suspended_until?: string | null;
}

export interface EmployeeTerminateInput {
  termination_date: string;
  termination_reason: string;
  last_working_day?: string | null;
  notice_period_days?: number | null;
}

export interface EmployeeReinstateInput {
  reason: string;
}

export interface EmployeeApi {
  list(context: FetchContext, params: EmployeeListParams): Promise<EmployeeListWire>;
  show(context: FetchContext, id: number): Promise<EmployeeWire>;
  create(context: FetchContext, input: EmployeeInput): Promise<EmployeeWire>;
  update(context: FetchContext, id: number, input: EmployeeUpdateInput): Promise<EmployeeWire>;
  remove(context: FetchContext, id: number): Promise<void>;
  /** `POST /employees/{id}/promote` — updates position/grade/level. */
  promote(context: FetchContext, id: number, input: EmployeePromoteInput): Promise<EmployeeWire>;
  /** `POST /employees/{id}/transfer` — updates branch/department/manager. */
  transfer(context: FetchContext, id: number, input: EmployeeTransferInput): Promise<EmployeeWire>;
  /** `POST /employees/{id}/suspend` — sets status=suspended. */
  suspend(context: FetchContext, id: number, input: EmployeeSuspendInput): Promise<EmployeeWire>;
  /** `POST /employees/{id}/terminate` — sets status=terminated + termination fields. */
  terminate(context: FetchContext, id: number, input: EmployeeTerminateInput): Promise<EmployeeWire>;
  /** `POST /employees/{id}/reinstate` — sets status=active. */
  reinstate(context: FetchContext, id: number, input: EmployeeReinstateInput): Promise<EmployeeWire>;
}

/** Cache keys. Every employees read hangs off `all` so invalidation after a write is total. */
export const employeeKeys = {
  all: ['employees'] as const satisfies QueryKey,
  list: (params: EmployeeListParams) => ['employees', 'list', params] as const satisfies QueryKey,
  detail: (id: number) => ['employees', 'detail', id] as const satisfies QueryKey,
};
