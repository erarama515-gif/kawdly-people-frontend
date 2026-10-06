import { array, bool, literalUnion, num, object, optional, str } from '@/lib/api/decode';

/**
 * Wire schemas for the Compensation module, matching the real Laravel contracts
 * exactly (snake_case DB columns, `{ data, meta }` pager envelope).
 *
 * Two resources are decoded here:
 *   - SalaryStructure — `/api/v1/salary-structures`
 *   - SalaryComponent — `/api/v1/salary-components`
 */

// ─── Page meta (shared) ───────────────────────────────────────────────────────

export const pageMetaDecoder = object({
  current_page: num(),
  per_page: num(),
  total: num(),
  last_page: num(),
});

export type PageMetaWire = ReturnType<typeof pageMetaDecoder.decode>;

// ─── Salary Structure ─────────────────────────────────────────────────────────

export const salaryStructureDecoder = object({
  id: num(),
  company_id: num(),
  name: str(),
  description: optional(str()),
  is_default: optional(bool()),
  is_active: optional(bool()),
  created_at: optional(str()),
  updated_at: optional(str()),
});

export type SalaryStructureWire = ReturnType<typeof salaryStructureDecoder.decode>;

export const salaryStructureListDecoder = object({
  data: array(salaryStructureDecoder),
  meta: pageMetaDecoder,
});

export type SalaryStructureListWire = ReturnType<typeof salaryStructureListDecoder.decode>;

export const salaryStructureEnvelopeDecoder = object({ data: salaryStructureDecoder });
export type SalaryStructureEnvelopeWire = ReturnType<typeof salaryStructureEnvelopeDecoder.decode>;

// ─── Salary Component ─────────────────────────────────────────────────────────

export const salaryComponentTypeDecoder = literalUnion(['earning', 'deduction'] as const);
export const salaryComponentCalculationTypeDecoder = literalUnion([
  'fixed',
  'percentage',
  'formula',
] as const);

export const salaryComponentDecoder = object({
  id: num(),
  company_id: num(),
  salary_structure_id: num(),
  name: str(),
  code: optional(str()),
  type: salaryComponentTypeDecoder,
  calculation_type: salaryComponentCalculationTypeDecoder,
  percentage_of: optional(num()),
  default_amount: optional(num()),
  is_taxable: optional(bool()),
  is_variable: optional(bool()),
  sort_order: optional(num()),
  created_at: optional(str()),
  updated_at: optional(str()),
});

export type SalaryComponentWire = ReturnType<typeof salaryComponentDecoder.decode>;

export const salaryComponentListDecoder = object({
  data: array(salaryComponentDecoder),
  meta: pageMetaDecoder,
});

export type SalaryComponentListWire = ReturnType<typeof salaryComponentListDecoder.decode>;

export const salaryComponentEnvelopeDecoder = object({ data: salaryComponentDecoder });
export type SalaryComponentEnvelopeWire = ReturnType<typeof salaryComponentEnvelopeDecoder.decode>;
