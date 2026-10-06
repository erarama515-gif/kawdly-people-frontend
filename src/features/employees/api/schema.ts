import { array, isoDate, literalUnion, num, object, optional, passthrough, str } from '@/lib/api/decode';

/**
 * Wire schemas for the Employees module, matching the real Laravel contract
 * exactly: `BaseResource::toArray()` returns the raw Eloquent model, so field
 * names are the DB columns verbatim (snake_case, no computed fields) and the
 * `index` envelope is the app's custom `{ data, meta }` pager — not Laravel's
 * default paginator shape (no `links`/`from`/`to` keys).
 *
 * `department`/`jobPosition`/`branch` are optional because they are only
 * present when the request asked for `include=department,jobPosition,branch`
 * — Eloquent appends eager-loaded relations to `toArray()` under the exact
 * relation method name (camelCase for multi-word relations).
 */

export const genderDecoder = literalUnion(['male', 'female'] as const);
export const maritalStatusDecoder = literalUnion(['single', 'married', 'divorced', 'widowed'] as const);
export const employmentTypeDecoder = literalUnion(['full_time', 'part_time', 'contract', 'intern'] as const);
export const workLocationDecoder = literalUnion(['office', 'remote', 'hybrid'] as const);
export const employeeStatusDecoder = literalUnion([
  'active',
  'on_leave',
  'suspended',
  'terminated',
  'resigned',
] as const);

const departmentRefDecoder = object({ id: num(), name: str() });
const jobPositionRefDecoder = object({ id: num(), title: str() });
const branchRefDecoder = object({ id: num(), name: str() });

export const employeeDecoder = object({
  id: num(),
  uuid: str(),
  company_id: num(),
  employee_number: str(),
  first_name: str(),
  last_name: str(),
  first_name_ar: optional(str()),
  last_name_ar: optional(str()),
  email: optional(str()),
  personal_email: optional(str()),
  phone: optional(str()),
  photo: optional(str()),
  date_of_birth: optional(isoDate()),
  gender: optional(genderDecoder),
  nationality: optional(str()),
  national_id: optional(str()),
  passport_number: optional(str()),
  marital_status: optional(maritalStatusDecoder),
  address: optional(str()),
  city: optional(str()),
  country_code: optional(str()),
  branch_id: num(),
  department_id: num(),
  job_position_id: num(),
  job_grade_id: optional(num()),
  job_level_id: optional(num()),
  direct_manager_id: optional(num()),
  joining_date: isoDate(),
  probation_end_date: optional(isoDate()),
  employment_type: employmentTypeDecoder,
  work_location: workLocationDecoder,
  status: employeeStatusDecoder,
  termination_date: optional(isoDate()),
  termination_reason: optional(str()),
  user_id: optional(num()),
  custom_fields: optional(passthrough<Record<string, unknown>>('object')),
  created_at: optional(str()),
  updated_at: optional(str()),
  department: optional(departmentRefDecoder),
  jobPosition: optional(jobPositionRefDecoder),
  branch: optional(branchRefDecoder),
});

export type EmployeeWire = ReturnType<typeof employeeDecoder.decode>;

export const pageMetaDecoder = object({
  current_page: num(),
  per_page: num(),
  total: num(),
  last_page: num(),
});

export type PageMetaWire = ReturnType<typeof pageMetaDecoder.decode>;

export const employeeListDecoder = object({
  data: array(employeeDecoder),
  meta: pageMetaDecoder,
});

export type EmployeeListWire = ReturnType<typeof employeeListDecoder.decode>;

export const employeeEnvelopeDecoder = object({ data: employeeDecoder });
export type EmployeeEnvelopeWire = ReturnType<typeof employeeEnvelopeDecoder.decode>;
