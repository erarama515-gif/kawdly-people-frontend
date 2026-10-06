import { array, bool, num, object, optional, str } from '@/lib/api/decode';

/**
 * Wire schemas for the Organization module.
 *
 * PRIMARY: Department — full CRUD shape confirmed from:
 *   - backend/app/Modules/Organization/Models/Department.php
 *   - backend/app/Modules/Organization/Requests/StoreDepartmentRequest.php
 *   - backend/app/Modules/Organization/Controllers/DepartmentController.php
 *
 * FULL CRUD: Company, Branch, JobPosition — complete wire shapes including
 *   all scalar fields and eager-loaded relations.
 */

// ─── Shared page meta ─────────────────────────────────────────────────────────

export const pageMetaDecoder = object({
  current_page: num(),
  per_page: num(),
  total: num(),
  last_page: num(),
});

export type PageMetaWire = ReturnType<typeof pageMetaDecoder.decode>;

// ─── Department ───────────────────────────────────────────────────────────────

/**
 * The `head` relation corresponds to `head_employee_id` and is the connected
 * Employee record (via Department::head()). We request it with include=head.
 * The controller lists `head` in its $includable array.
 */
const headRefDecoder = object({
  id: num(),
  employee_number: str(),
  first_name: str(),
  last_name: str(),
  photo: optional(str()),
});

export const departmentDecoder = object({
  id: num(),
  uuid: optional(str()),
  company_id: num(),
  parent_id: optional(num()),
  name: str(),
  code: optional(str()),
  head_employee_id: optional(num()),
  level: optional(num()),
  path: optional(str()),
  sort_order: optional(num()),
  is_active: optional(bool()),
  created_at: optional(str()),
  updated_at: optional(str()),
  /** Eager-loaded relation — present only when include=head is sent. */
  head: optional(headRefDecoder),
});

export type DepartmentWire = ReturnType<typeof departmentDecoder.decode>;
export type DepartmentHeadRef = NonNullable<DepartmentWire['head']>;

export const departmentListDecoder = object({
  data: array(departmentDecoder),
  meta: pageMetaDecoder,
});

export type DepartmentListWire = ReturnType<typeof departmentListDecoder.decode>;

export const departmentEnvelopeDecoder = object({ data: departmentDecoder });
export type DepartmentEnvelopeWire = ReturnType<typeof departmentEnvelopeDecoder.decode>;

// ─── Company ─────────────────────────────────────────────────────────────────

export const companyDecoder = object({
  id: num(),
  uuid: optional(str()),
  name: str(),
  name_ar: optional(str()),
  legal_name: optional(str()),
  registration_number: optional(str()),
  tax_number: optional(str()),
  logo: optional(str()),
  email: optional(str()),
  phone: optional(str()),
  website: optional(str()),
  address: optional(str()),
  city: optional(str()),
  country_code: str(),
  currency_code: str(),
  timezone: optional(str()),
  fiscal_year_start: optional(num()),
  is_active: optional(bool()),
  created_at: optional(str()),
  updated_at: optional(str()),
});

export type CompanyWire = ReturnType<typeof companyDecoder.decode>;

export const companyListDecoder = object({
  data: array(companyDecoder),
  meta: pageMetaDecoder,
});

export type CompanyListWire = ReturnType<typeof companyListDecoder.decode>;

export const companyEnvelopeDecoder = object({ data: companyDecoder });
export type CompanyEnvelopeWire = ReturnType<typeof companyEnvelopeDecoder.decode>;

/**
 * Minimal company reference — used as the eager-loaded `company` relation on
 * Branch and JobPosition. Only id + name are needed for display.
 */
export const companyRefDecoder = object({
  id: num(),
  name: str(),
});

export type CompanyRefWire = ReturnType<typeof companyRefDecoder.decode>;

// ─── Branch ──────────────────────────────────────────────────────────────────

export const branchDecoder = object({
  id: num(),
  uuid: optional(str()),
  company_id: num(),
  name: str(),
  code: optional(str()),
  address: optional(str()),
  city: optional(str()),
  country_code: optional(str()),
  latitude: optional(num()),
  longitude: optional(num()),
  geofence_radius: optional(num()),
  phone: optional(str()),
  is_headquarters: optional(bool()),
  is_active: optional(bool()),
  created_at: optional(str()),
  updated_at: optional(str()),
  /** Eager-loaded relation — present only when include=company is sent. */
  company: optional(companyRefDecoder),
});

export type BranchWire = ReturnType<typeof branchDecoder.decode>;

export const branchListDecoder = object({
  data: array(branchDecoder),
  meta: pageMetaDecoder,
});

export type BranchListWire = ReturnType<typeof branchListDecoder.decode>;

export const branchEnvelopeDecoder = object({ data: branchDecoder });
export type BranchEnvelopeWire = ReturnType<typeof branchEnvelopeDecoder.decode>;

// ─── JobPosition ──────────────────────────────────────────────────────────────

/**
 * Minimal department reference — used as the eager-loaded `department` relation on
 * JobPosition. Only id + name are needed for display.
 */
export const departmentRefDecoder = object({
  id: num(),
  name: str(),
});

export type DepartmentRefWire = ReturnType<typeof departmentRefDecoder.decode>;

export const jobPositionDecoder = object({
  id: num(),
  uuid: optional(str()),
  company_id: num(),
  department_id: optional(num()),
  title: str(),
  title_ar: optional(str()),
  code: optional(str()),
  description: optional(str()),
  requirements: optional(str()),
  headcount: optional(num()),
  is_active: optional(bool()),
  created_at: optional(str()),
  updated_at: optional(str()),
  /** Eager-loaded relations — present when include=company,department is sent. */
  company: optional(companyRefDecoder),
  department: optional(departmentRefDecoder),
});

export type JobPositionWire = ReturnType<typeof jobPositionDecoder.decode>;

export const jobPositionListDecoder = object({
  data: array(jobPositionDecoder),
  meta: pageMetaDecoder,
});

export type JobPositionListWire = ReturnType<typeof jobPositionListDecoder.decode>;

export const jobPositionEnvelopeDecoder = object({ data: jobPositionDecoder });
export type JobPositionEnvelopeWire = ReturnType<typeof jobPositionEnvelopeDecoder.decode>;
