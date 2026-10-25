import { array, isoDate, literalUnion, num, object, optional, str } from '@/lib/api/decode';

/**
 * Wire schemas for the Contracts module, matching the real Laravel contract
 * exactly: field names are the DB columns verbatim (snake_case), and the
 * `index` envelope is the app's custom `{ data, meta }` pager.
 *
 * `employee` is optional because it is only present when the request asked
 * for `include=employee` — mirrors how `EmployeeWire` nests `department`/
 * `jobPosition`.
 */

export const contractTypeDecoder = literalUnion(['initial', 'renewal', 'amendment'] as const);
export const contractStatusDecoder = literalUnion(['draft', 'active', 'expired', 'terminated'] as const);

const employeeRefDecoder = object({
  id: num(),
  employee_number: str(),
  first_name: str(),
  last_name: str(),
  photo: optional(str()),
});

export const contractDecoder = object({
  id: num(),
  uuid: str(),
  employee_id: num(),
  type: contractTypeDecoder,
  start_date: isoDate(),
  end_date: optional(isoDate()),
  probation_months: optional(num()),
  /**
   * Stripped by `filter.sensitive` for anyone without `employee.salary.view`
   * (hr_officer, recruiter, department_manager...). Optional here so the list
   * still decodes for them - the UI renders a dash instead of crashing (A2.3).
   */
  basic_salary: optional(num()),
  terms: optional(str()),
  status: contractStatusDecoder,
  signed_at: optional(str()),
  attachment: optional(str()),
  parent_contract_id: optional(num()),
  created_by: num(),
  created_at: optional(str()),
  updated_at: optional(str()),
  /** Eager-loaded via `include=employee`. */
  employee: optional(employeeRefDecoder),
});

export type ContractWire = ReturnType<typeof contractDecoder.decode>;

export const pageMetaDecoder = object({
  current_page: num(),
  per_page: num(),
  total: num(),
  last_page: num(),
});

export type PageMetaWire = ReturnType<typeof pageMetaDecoder.decode>;

export const contractListDecoder = object({
  data: array(contractDecoder),
  meta: pageMetaDecoder,
});

export type ContractListWire = ReturnType<typeof contractListDecoder.decode>;

export const contractEnvelopeDecoder = object({ data: contractDecoder });
export type ContractEnvelopeWire = ReturnType<typeof contractEnvelopeDecoder.decode>;
