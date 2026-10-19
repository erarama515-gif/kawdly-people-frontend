import { useQuery } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import { array, num, object, optional, str } from '@/lib/api/decode';

// ── Wire decoders ─────────────────────────────────────────────────────────────

const leaveBalanceItemDecoder = object({
  leave_type_id:   num(),
  leave_type_name: str(),
  leave_type_code: optional(str()),
  color:           optional(str()),
  year:            num(),
  allocated:       num(),
  used:            num(),
  pending:         num(),
  carried_over:    num(),
  adjustment:      num(),
  remaining:       num(),
});

const balanceTotalsDecoder = object({
  allocated: num(),
  used:      num(),
  remaining: num(),
});

const balanceSummaryPayloadDecoder = object({
  employee_id: num(),
  year:        num(),
  balances:    array(leaveBalanceItemDecoder),
  totals:      balanceTotalsDecoder,
});

const balanceSummaryEnvelopeDecoder = object({
  data: balanceSummaryPayloadDecoder,
});

export type LeaveBalanceItem = ReturnType<typeof leaveBalanceItemDecoder.decode>;
export type LeaveBalanceSummary = ReturnType<typeof balanceSummaryPayloadDecoder.decode>;

// ── Cache key ─────────────────────────────────────────────────────────────────

const balanceKeys = {
  summary: (employeeId: number, year?: number) =>
    ['leaveBalances', 'summary', employeeId, year ?? 'current'] as const,
} as const;

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseLeaveBalanceResult {
  state: QueryState<LeaveBalanceSummary>;
}

/**
 * Fetches the leave-balance summary for one employee (current year by default).
 *
 * Hits `GET /api/v1/leave-balances/summary/{employeeId}` and decodes the
 * response through the typed decoder so any contract drift surfaces at the
 * boundary rather than silently breaking the UI.
 */
export function useLeaveBalance(
  employeeId: number,
  year?: number,
): UseLeaveBalanceResult {
  const { state } = useQuery<LeaveBalanceSummary>({
    queryKey: balanceKeys.summary(employeeId, year),
    queryFn: async ({ signal }) => {
      const query: Record<string, string | number> = {};
      if (year !== undefined) query['year'] = year;

      const { data } = await http(`/leave-balances/summary/${employeeId}`, {
        query,
        signal,
        schema: balanceSummaryEnvelopeDecoder,
      });

      if (!data) {
        throw new Error(`GET /leave-balances/summary/${employeeId} returned an empty body`);
      }

      return data.data;
    },
    staleTime: 30_000,
    enabled: employeeId > 0,
  });

  return { state };
}
