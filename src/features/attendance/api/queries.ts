import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { attendanceApi, fetchWorkScheduleOptions } from './client';
import type { WorkScheduleOption } from './client';
import { attendanceKeys } from './resource';
import type { AttendanceInput, AttendanceListParams, AttendanceUpdateInput } from './resource';
import type { AttendanceListWire, AttendanceWire } from './schema';

/**
 * The Attendance module's data hooks — the only place components talk to the
 * API. Mirrors the Employees feature's `queries.ts`: each hook owns its cache
 * key and mutation strategy, and every mutation reconciles the cache itself
 * so `AttendancePage` never writes to the query store by hand.
 */

export interface AttendanceListData {
  state: QueryState<AttendanceListWire>;
  refetch: () => void;
}

export function useAttendanceList(params: AttendanceListParams): AttendanceListData {
  const { state, refetch } = useQuery<AttendanceListWire>({
    queryKey: attendanceKeys.list(params),
    queryFn: (context) => attendanceApi.list(context, params),
    staleTime: 15_000,
  });

  return { state, refetch };
}

/**
 * Work-schedule choices for the create/edit form. Cached for five minutes:
 * shift patterns change far less often than attendance records, and the list
 * is needed again every time the dialog opens.
 */
export function useWorkScheduleOptions(): QueryState<WorkScheduleOption[]> {
  const { state } = useQuery<WorkScheduleOption[]>({
    queryKey: ['work-schedules', 'options'],
    queryFn: (context) => fetchWorkScheduleOptions(context),
    staleTime: 5 * 60_000,
  });

  return state;
}

/** True for any cached key under this module, list or single-item alike. */
function isAttendanceKey(key: readonly unknown[]): boolean {
  return key[0] === 'attendances';
}

/** Creates an attendance record, then invalidates every cached list so the new row shows up wherever it belongs. */
export function useCreateAttendance() {
  const client = useQueryClient();

  return useMutation<AttendanceInput, AttendanceWire>({
    mutationFn: (input, { signal }) => attendanceApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isAttendanceKey });
    },
  });
}

export interface UpdateAttendanceInput extends AttendanceUpdateInput {
  id: number;
}

/** Updates an attendance record, then invalidates every cached list so edited fields show up immediately. */
export function useUpdateAttendance() {
  const client = useQueryClient();

  return useMutation<UpdateAttendanceInput, AttendanceWire>({
    mutationFn: ({ id, ...input }, { signal }) => attendanceApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isAttendanceKey });
    },
  });
}

/**
 * Deletes one attendance record. Optimistic: the row disappears from the current list
 * immediately so the table feels instant; a failure restores the previous
 * snapshot and refetches, so the ledger can never drift from the server.
 */
export function useDeleteAttendance(params: AttendanceListParams) {
  const client = useQueryClient();
  const key = attendanceKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => attendanceApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<AttendanceListWire>(key, (current) =>
        current
          ? {
              ...current,
              data: current.data.filter((record) => record.id !== id),
              meta: { ...current.meta, total: Math.max(0, current.meta.total - 1) },
            }
          : current,
      );
      return () => {
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate({ predicate: isAttendanceKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isAttendanceKey });
    },
  });
}
