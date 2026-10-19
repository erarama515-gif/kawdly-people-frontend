import { array, bool, isoDate, literalUnion, num, object, optional, str } from '@/lib/api/decode';

/**
 * Wire schemas for the Leave module, matching the real Laravel contract
 * exactly. `BaseResource::toArray()` returns the raw Eloquent model so field
 * names are DB columns verbatim (snake_case). The index envelope uses the
 * app's custom `{ data, meta }` pager — same shape as Employees.
 *
 * `employee` and `leave_type` are optional because they are only present when
 * the request asked for `include=employee,leaveType` — Eloquent's
 * `relationsToArray()` always snake_cases the relation method name for the
 * JSON key, so the `leaveType()` relation shows up on the wire as
 * `leave_type`, never `leaveType`.
 */

export const leaveRequestStatusDecoder = literalUnion([
  'pending',
  'approved',
  'rejected',
  'cancelled',
] as const);

const employeeRefDecoder = object({
  id: num(),
  first_name: str(),
  last_name: str(),
  employee_number: str(),
  photo: optional(str()),
});

const leaveTypeRefDecoder = object({
  id: num(),
  name: str(),
  color: optional(str()),
});

export const leaveTypeDecoder = object({
  id: num(),
  name: str(),
  code: optional(str()),
  color: optional(str()),
  is_paid: optional(bool()),
  is_active: optional(bool()),
});

export type LeaveTypeWire = ReturnType<typeof leaveTypeDecoder.decode>;

export const leaveRequestDecoder = object({
  id: num(),
  uuid: optional(str()),
  employee_id: num(),
  leave_type_id: num(),
  start_date: isoDate(),
  end_date: isoDate(),
  days: str(),
  is_half_day: optional(bool()),
  half_day_period: optional(str()),
  reason: optional(str()),
  attachment: optional(str()),
  status: leaveRequestStatusDecoder,
  substitute_employee_id: optional(num()),
  rejection_reason: optional(str()),
  cancelled_at: optional(str()),
  created_at: optional(str()),
  updated_at: optional(str()),
  employee: optional(employeeRefDecoder),
  leave_type: optional(leaveTypeRefDecoder),
});

export type LeaveRequestWire = ReturnType<typeof leaveRequestDecoder.decode>;

export const pageMetaDecoder = object({
  current_page: num(),
  per_page: num(),
  total: num(),
  last_page: num(),
});

export type PageMetaWire = ReturnType<typeof pageMetaDecoder.decode>;

export const leaveRequestListDecoder = object({
  data: array(leaveRequestDecoder),
  meta: pageMetaDecoder,
});

export type LeaveRequestListWire = ReturnType<typeof leaveRequestListDecoder.decode>;

export const leaveRequestEnvelopeDecoder = object({ data: leaveRequestDecoder });
export type LeaveRequestEnvelopeWire = ReturnType<typeof leaveRequestEnvelopeDecoder.decode>;

export const leaveTypeListDecoder = object({
  data: array(leaveTypeDecoder),
  meta: pageMetaDecoder,
});
