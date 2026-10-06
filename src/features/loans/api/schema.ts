import { array, isoDate, literalUnion, num, object, optional, str } from '@/lib/api/decode';

/**
 * Wire schemas for the Loans module, matching the real Laravel contract
 * exactly: field names are DB columns verbatim (snake_case), and the `index`
 * envelope is the app's custom `{ data, meta }` pager.
 *
 * `employee` relation is optional — only present when `include=employee` was
 * passed. The `Loan` model uses `HasUuid` so a `uuid` field appears on wire
 * responses. The model has NO soft deletes.
 */

export const loanTypeDecoder = literalUnion(['loan', 'advance'] as const);

export const loanStatusDecoder = literalUnion([
  'pending',
  'active',
  'completed',
  'cancelled',
] as const);

const employeeRefDecoder = object({
  id: num(),
  employee_number: str(),
  first_name: str(),
  last_name: str(),
  photo: optional(str()),
});

export const loanDecoder = object({
  id: num(),
  uuid: str(),
  employee_id: num(),
  type: loanTypeDecoder,
  amount: num(),
  installment_amount: num(),
  total_installments: num(),
  paid_installments: optional(num()),
  remaining_amount: num(),
  start_date: isoDate(),
  status: optional(loanStatusDecoder),
  reason: optional(str()),
  approved_by: optional(num()),
  approved_at: optional(str()),
  created_at: optional(str()),
  updated_at: optional(str()),
  /** Eager-loaded via `include=employee`. */
  employee: optional(employeeRefDecoder),
});

export type LoanWire = ReturnType<typeof loanDecoder.decode>;
export type LoanEmployeeRef = NonNullable<LoanWire['employee']>;

export const pageMetaDecoder = object({
  current_page: num(),
  per_page: num(),
  total: num(),
  last_page: num(),
});

export type PageMetaWire = ReturnType<typeof pageMetaDecoder.decode>;

export const loanListDecoder = object({
  data: array(loanDecoder),
  meta: pageMetaDecoder,
});

export type LoanListWire = ReturnType<typeof loanListDecoder.decode>;

export const loanEnvelopeDecoder = object({ data: loanDecoder });
export type LoanEnvelopeWire = ReturnType<typeof loanEnvelopeDecoder.decode>;
