import type { FetchContext, QueryKey } from '@/lib/query';
import type { AttendanceListWire, AttendanceWire } from './schema';

/**
 * The Attendance module's remote resource contract.
 *
 * Components never call this directly — they go through the query hooks in
 * `queries.ts`. Two implementations satisfy it: `httpAttendanceApi` (real
 * Laravel endpoints under `/api/v1/attendances`) and `mockAttendanceApi`
 * (in-process, the default until a backend is configured). Mirrors the
 * Employees feature's exact `api/` pattern.
 */

/**
 * Real backend values from `StoreAttendanceRequest`:
 *   present | absent | leave | holiday | weekend | half_day | late
 *
 * 'late' is a first-class status: the seeder writes it and the shipped data
 * carries 254 such rows. A record can ALSO be 'present' with
 * `late_minutes > 0` — the two are not mutually exclusive.
 */
export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'holiday' | 'weekend' | 'half_day' | 'late';

export type CheckInMethod = 'web' | 'mobile' | 'biometric' | 'qr' | 'manual';

export interface AttendanceListParams {
  page?: number;
  perPage?: number;
  search?: string | undefined;
  status?: AttendanceStatus | undefined;
  employeeId?: number | undefined;
  /** Inclusive range filter on `date`, mapped to `date_from`/`date_to` on the wire. */
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

/** Shape of `StoreAttendanceRequest`'s validated fields. */
export interface AttendanceInput {
  employee_id: number;
  date: string;
  work_schedule_id: number;
  check_in?: string | null;
  check_out?: string | null;
  check_in_method?: CheckInMethod | null;
  check_out_method?: CheckInMethod | null;
  regular_hours?: number | null;
  overtime_hours?: number | null;
  late_minutes?: number | null;
  early_leave_minutes?: number | null;
  break_minutes?: number | null;
  night_hours?: number | null;
  status: AttendanceStatus;
  notes?: string | null;
  is_corrected?: boolean | null;
  corrected_by?: number | null;
}

/** `UpdateAttendanceRequest` wraps the same fields in `sometimes` — any subset is valid. */
export type AttendanceUpdateInput = Partial<AttendanceInput>;

export interface AttendanceApi {
  list(context: FetchContext, params: AttendanceListParams): Promise<AttendanceListWire>;
  create(context: FetchContext, input: AttendanceInput): Promise<AttendanceWire>;
  update(context: FetchContext, id: number, input: AttendanceUpdateInput): Promise<AttendanceWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

/** Cache keys. Every attendance read hangs off `all` so invalidation after a write is total. */
export const attendanceKeys = {
  all: ['attendances'] as const satisfies QueryKey,
  list: (params: AttendanceListParams) => ['attendances', 'list', params] as const satisfies QueryKey,
};
