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
  company_id: number;
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
  gender?: EmployeeGender | null;
  marital_status?: EmployeeMaritalStatus | null;
  joining_date: string;
  employment_type: EmploymentType;
  work_location: WorkLocation;
  status?: EmployeeStatus;
}

/** `UpdateEmployeeRequest` wraps the same fields in `sometimes` — any subset is valid. */
export type EmployeeUpdateInput = Partial<EmployeeInput>;

export interface EmployeeApi {
  list(context: FetchContext, params: EmployeeListParams): Promise<EmployeeListWire>;
  create(context: FetchContext, input: EmployeeInput): Promise<EmployeeWire>;
  update(context: FetchContext, id: number, input: EmployeeUpdateInput): Promise<EmployeeWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

/** Cache keys. Every employees read hangs off `all` so invalidation after a write is total. */
export const employeeKeys = {
  all: ['employees'] as const satisfies QueryKey,
  list: (params: EmployeeListParams) => ['employees', 'list', params] as const satisfies QueryKey,
};
