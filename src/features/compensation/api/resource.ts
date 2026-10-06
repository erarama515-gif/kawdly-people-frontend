import type { FetchContext, QueryKey } from '@/lib/query';
import type {
  SalaryStructureListWire,
  SalaryStructureWire,
  SalaryComponentListWire,
  SalaryComponentWire,
} from './schema';

/**
 * Compensation module resource contracts (two resources: SalaryStructure +
 * SalaryComponent). Mirrors Attendance/Contracts' exact `api/resource.ts`
 * pattern.
 *
 * Backend routes (backend/routes/api/payroll.php):
 *   GET|POST   /api/v1/salary-structures
 *   GET|PATCH|DELETE /api/v1/salary-structures/{id}
 *   GET|POST   /api/v1/salary-components
 *   GET|PATCH|DELETE /api/v1/salary-components/{id}
 *
 * `company_id` is hard-coded to `1` as a placeholder (same convention as
 * Employees' `company_id` and Contracts' `created_by`).
 */

// ─── Salary Structure ─────────────────────────────────────────────────────────

export interface SalaryStructureListParams {
  page?: number;
  perPage?: number;
  search?: string | undefined;
  isActive?: boolean | undefined;
}

/** Shape of `StoreSalaryStructureRequest`'s validated fields. */
export interface SalaryStructureInput {
  company_id: number;
  name: string;
  description?: string | null;
  is_default?: boolean | null;
  is_active?: boolean | null;
}

/** `UpdateSalaryStructureRequest` wraps fields in `sometimes` — any subset is valid. */
export type SalaryStructureUpdateInput = Partial<SalaryStructureInput>;

export interface SalaryStructureApi {
  list(context: FetchContext, params: SalaryStructureListParams): Promise<SalaryStructureListWire>;
  create(context: FetchContext, input: SalaryStructureInput): Promise<SalaryStructureWire>;
  update(context: FetchContext, id: number, input: SalaryStructureUpdateInput): Promise<SalaryStructureWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

export const salaryStructureKeys = {
  all: ['salary-structures'] as const satisfies QueryKey,
  list: (params: SalaryStructureListParams) =>
    ['salary-structures', 'list', params] as const satisfies QueryKey,
};

// ─── Salary Component ─────────────────────────────────────────────────────────

export type SalaryComponentType = 'earning' | 'deduction';
export type SalaryComponentCalculationType = 'fixed' | 'percentage' | 'formula';

export interface SalaryComponentListParams {
  page?: number;
  perPage?: number;
  search?: string | undefined;
  salary_structure_id?: number | undefined;
  type?: SalaryComponentType | undefined;
}

/** Shape of `StoreSalaryComponentRequest`'s validated fields. */
export interface SalaryComponentInput {
  company_id: number;
  salary_structure_id: number;
  name: string;
  code?: string | null;
  type: SalaryComponentType;
  calculation_type: SalaryComponentCalculationType;
  percentage_of?: number | null;
  default_amount?: number | null;
  is_taxable?: boolean | null;
  is_variable?: boolean | null;
  sort_order?: number | null;
}

/** `UpdateSalaryComponentRequest` wraps fields in `sometimes` — any subset is valid. */
export type SalaryComponentUpdateInput = Partial<SalaryComponentInput>;

export interface SalaryComponentApi {
  list(context: FetchContext, params: SalaryComponentListParams): Promise<SalaryComponentListWire>;
  create(context: FetchContext, input: SalaryComponentInput): Promise<SalaryComponentWire>;
  update(context: FetchContext, id: number, input: SalaryComponentUpdateInput): Promise<SalaryComponentWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

export const salaryComponentKeys = {
  all: ['salary-components'] as const satisfies QueryKey,
  list: (params: SalaryComponentListParams) =>
    ['salary-components', 'list', params] as const satisfies QueryKey,
};
