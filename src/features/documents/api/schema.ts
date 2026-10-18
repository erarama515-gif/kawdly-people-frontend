import { array, bool, isoDate, literalUnion, num, object, optional, str } from '@/lib/api/decode';

/**
 * Wire schemas for the Documents module, matching the real Laravel contract
 * exactly: field names are DB columns verbatim (snake_case) and the `index`
 * envelope is the app's custom `{ data, meta }` pager.
 *
 * `employee` and `document_type` relations are optional — only present when
 * `include=employee,documentType` is passed (which the list endpoint does).
 * Eloquent's `relationsToArray()` always snake_cases the relation method
 * name for the JSON key, so the `documentType()` relation shows up on the
 * wire as `document_type`, never `documentType`.
 */

export const employeeDocumentStatusDecoder = literalUnion([
  'valid',
  'expired',
  'pending_renewal',
] as const);

export const documentTypeCategoryDecoder = literalUnion([
  'identification',
  'contract',
  'certificate',
  'license',
  'other',
] as const);

const employeeRefDecoder = object({
  id: num(),
  employee_number: str(),
  first_name: str(),
  last_name: str(),
  photo: optional(str()),
});

const documentTypeRefDecoder = object({
  id: num(),
  name: str(),
  category: optional(documentTypeCategoryDecoder),
});

export const employeeDocumentDecoder = object({
  id: num(),
  employee_id: num(),
  document_type_id: num(),
  title: str(),
  file_path: str(),
  file_name: str(),
  file_size: optional(num()),
  mime_type: optional(str()),
  issue_date: optional(isoDate()),
  expiry_date: optional(isoDate()),
  document_number: optional(str()),
  notes: optional(str()),
  status: optional(employeeDocumentStatusDecoder),
  created_at: optional(str()),
  updated_at: optional(str()),
  employee: optional(employeeRefDecoder),
  document_type: optional(documentTypeRefDecoder),
});

export type EmployeeDocumentWire = ReturnType<typeof employeeDocumentDecoder.decode>;
export type EmployeeDocumentEmployeeRef = NonNullable<EmployeeDocumentWire['employee']>;
export type EmployeeDocumentTypeRef = NonNullable<EmployeeDocumentWire['document_type']>;

export const pageMetaDecoder = object({
  current_page: num(),
  per_page: num(),
  total: num(),
  last_page: num(),
});

export type PageMetaWire = ReturnType<typeof pageMetaDecoder.decode>;

export const employeeDocumentListDecoder = object({
  data: array(employeeDocumentDecoder),
  meta: pageMetaDecoder,
});

export type EmployeeDocumentListWire = ReturnType<typeof employeeDocumentListDecoder.decode>;

export const employeeDocumentEnvelopeDecoder = object({ data: employeeDocumentDecoder });
export type EmployeeDocumentEnvelopeWire = ReturnType<typeof employeeDocumentEnvelopeDecoder.decode>;

// ─── DocumentType ──────────────────────────────────────────────────────────────

export const documentTypeDecoder = object({
  id: num(),
  company_id: optional(num()),
  name: str(),
  category: optional(documentTypeCategoryDecoder),
  has_expiry: optional(bool()),
  is_required: optional(bool()),
  sort_order: optional(num()),
  created_at: optional(str()),
  updated_at: optional(str()),
});

export type DocumentTypeWire = ReturnType<typeof documentTypeDecoder.decode>;

export const documentTypeListDecoder = object({
  data: array(documentTypeDecoder),
  meta: pageMetaDecoder,
});

export type DocumentTypeListWire = ReturnType<typeof documentTypeListDecoder.decode>;

// ─── DocumentTemplate (count only) ────────────────────────────────────────────

export const documentTemplateCountDecoder = object({
  meta: pageMetaDecoder,
});
