import { array, bool, num, object, optional, str, isoDate, literalUnion } from '@/lib/api/decode';

/**
 * Wire schemas for the Attendance module, matching the real Laravel contract
 * exactly: field names are DB columns verbatim (snake_case) and the `index`
 * envelope is the app's custom `{ data, meta }` pager.
 *
 * `employee` relation is optional — only present when `include=employee` was
 * passed. `check_in`/`check_out` are optional because absent/leave records have
 * no times.
 */

export const attendanceStatusDecoder = literalUnion([
  'present',
  'absent',
  'leave',
  'holiday',
  'weekend',
  'half_day',
] as const);

export const checkInMethodDecoder = literalUnion(['web', 'mobile', 'biometric', 'qr', 'manual'] as const);

const employeeRefDecoder = object({
  id: num(),
  employee_number: str(),
  first_name: str(),
  last_name: str(),
  photo: optional(str()),
});

export const attendanceDecoder = object({
  id: num(),
  employee_id: num(),
  work_schedule_id: num(),
  date: isoDate(),
  check_in: optional(str()),
  check_out: optional(str()),
  check_in_method: optional(checkInMethodDecoder),
  check_out_method: optional(checkInMethodDecoder),
  regular_hours: optional(str()),
  overtime_hours: optional(str()),
  late_minutes: optional(num()),
  early_leave_minutes: optional(num()),
  break_minutes: optional(num()),
  night_hours: optional(str()),
  status: attendanceStatusDecoder,
  notes: optional(str()),
  is_corrected: optional(bool()),
  corrected_by: optional(num()),
  created_at: optional(str()),
  employee: optional(employeeRefDecoder),
});

export type AttendanceWire = ReturnType<typeof attendanceDecoder.decode>;
export type AttendanceEmployeeRef = NonNullable<AttendanceWire['employee']>;

export const pageMetaDecoder = object({
  current_page: num(),
  per_page: num(),
  total: num(),
  last_page: num(),
});

export type PageMetaWire = ReturnType<typeof pageMetaDecoder.decode>;

export const attendanceListDecoder = object({
  data: array(attendanceDecoder),
  meta: pageMetaDecoder,
});

export type AttendanceListWire = ReturnType<typeof attendanceListDecoder.decode>;

export const attendanceEnvelopeDecoder = object({ data: attendanceDecoder });
export type AttendanceEnvelopeWire = ReturnType<typeof attendanceEnvelopeDecoder.decode>;
