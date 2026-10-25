import { array, bool, num, object, optional, str, isoDate, literalUnion, union } from '@/lib/api/decode';
import type { AttendanceStatus } from './resource';

/**
 * Wire schemas for the Attendance module, matching the real Laravel contract
 * exactly: field names are DB columns verbatim (snake_case) and the `index`
 * envelope is the app's custom `{ data, meta }` pager.
 *
 * `employee` relation is optional — only present when `include=employee` was
 * passed. `check_in`/`check_out` are optional because absent/leave records have
 * no times.
 */

export const KNOWN_ATTENDANCE_STATUSES = [
  'present',
  'absent',
  'leave',
  'holiday',
  'weekend',
  'half_day',
  'late',
] as const;

/** Statuses the UI knows how to label and colour. */
export const attendanceStatusDecoder = literalUnion(KNOWN_ATTENDANCE_STATUSES);

export function isKnownAttendanceStatus(value: string): value is AttendanceStatus {
  return (KNOWN_ATTENDANCE_STATUSES as readonly string[]).includes(value);
}

/**
 * Lenient decoder used when *reading* records (A2.4).
 *
 * A status is a plain varchar on the server, so a future value (say
 * `remote_work`) used to make the whole attendance page fail to decode - an
 * unknown value in one row blanked the list for everyone. Reads now accept any
 * string and the UI renders it verbatim with a neutral badge; the form still
 * writes only the known set.
 */
export const attendanceStatusWireDecoder = union(attendanceStatusDecoder, str());

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
  status: attendanceStatusWireDecoder,
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
