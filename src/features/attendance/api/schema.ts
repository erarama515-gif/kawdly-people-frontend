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
  'late',
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

/**
 * Work schedule as returned by GET /work-schedules. Only the fields the
 * attendance form needs are decoded; the resource carries the full shift
 * definition but the picker just needs an id and a human-readable name.
 */
export const workScheduleDecoder = object({
  id: num(),
  name: str(),
  type: optional(str()),
  start_time: optional(str()),
  end_time: optional(str()),
  is_active: optional(bool()),
  is_default: optional(bool()),
});

export type WorkScheduleWire = ReturnType<typeof workScheduleDecoder.decode>;

export const workScheduleListDecoder = object({
  data: array(workScheduleDecoder),
  meta: optional(pageMetaDecoder),
});

export type WorkScheduleListWire = ReturnType<typeof workScheduleListDecoder.decode>;
