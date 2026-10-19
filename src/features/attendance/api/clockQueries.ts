import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryKey } from '@/lib/query';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import { object, bool, optional, str, num } from '@/lib/api/decode';

/**
 * Clock-in / Clock-out / My-status hooks.
 *
 * Wire schema for GET /api/v1/attendances/my-status:
 *   { data: { clocked_in, clocked_out, check_in?, check_out?,
 *             elapsed_minutes, attendance_id? } }
 */

// ---------------------------------------------------------------------------
// Decoders
// ---------------------------------------------------------------------------

const myStatusDecoder = object({
  data: object({
    clocked_in: bool(),
    clocked_out: bool(),
    check_in: optional(str()),
    check_out: optional(str()),
    elapsed_minutes: num(),
    attendance_id: optional(num()),
  }),
});

export type MyStatusData = ReturnType<typeof myStatusDecoder.decode>['data'];

// A minimal attendance record is returned by clock-in and clock-out.
const clockResponseDecoder = object({
  data: object({
    id: num(),
    employee_id: num(),
    date: str(),
    check_in: optional(str()),
    check_out: optional(str()),
    status: str(),
    regular_hours: optional(str()),
  }),
});

export type ClockResponseData = ReturnType<typeof clockResponseDecoder.decode>['data'];

// ---------------------------------------------------------------------------
// Cache keys
// ---------------------------------------------------------------------------

export const clockKeys = {
  status: ['attendances', 'my-status'] as const satisfies QueryKey,
};

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/**
 * Polls the server every 60 s to keep the elapsed-time reading fresh.
 * Components should supplement this with a client-side interval for
 * the live clock display rather than hammering the server per second.
 */
export function useMyClockStatus() {
  return useQuery<MyStatusData>({
    queryKey: clockKeys.status,
    queryFn: async ({ signal }) => {
      const { data } = await http('/attendances/my-status', {
        signal,
        schema: myStatusDecoder,
      });
      if (!data) throw new Error('GET /attendances/my-status returned empty body');
      return data.data;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

/** Clocks the current user in, then invalidates the status cache. */
export function useClockIn() {
  const client = useQueryClient();

  return useMutation<void, ClockResponseData>({
    mutationFn: async (_input, { signal }) => {
      const { data } = await http('/attendances/clock-in', {
        method: 'POST',
        signal,
        schema: clockResponseDecoder,
      });
      if (!data) throw new Error('POST /attendances/clock-in returned empty body');
      return data.data;
    },
    onSuccess: () => {
      void client.invalidate({ predicate: (key) => key[0] === 'attendances' });
    },
  });
}

/** Clocks the current user out, then invalidates the status cache. */
export function useClockOut() {
  const client = useQueryClient();

  return useMutation<void, ClockResponseData>({
    mutationFn: async (_input, { signal }) => {
      const { data } = await http('/attendances/clock-out', {
        method: 'POST',
        signal,
        schema: clockResponseDecoder,
      });
      if (!data) throw new Error('POST /attendances/clock-out returned empty body');
      return data.data;
    },
    onSuccess: () => {
      void client.invalidate({ predicate: (key) => key[0] === 'attendances' });
    },
  });
}
