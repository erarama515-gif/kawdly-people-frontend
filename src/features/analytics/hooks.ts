/**
 * Analytics data composition layer.
 *
 * This file composes live query hooks from other features and the dedicated
 * analytics endpoint into the shapes AnalyticsPage needs.
 *
 * SPRINT 1 CHANGE (task 1.5): Department headcounts now use the dedicated
 * `/api/v1/analytics/headcounts` endpoint which computes all department
 * counts in a single SQL GROUP BY — replacing the N+1 pattern of one
 * per-department employee list call.
 *
 * OMISSION REGISTER (stats that cannot be honestly computed):
 *
 *   newHires (KPI card) — EmployeeListParams has no joining_date date-range
 *     filter, so "hired this month" cannot be scoped server-side.
 *
 *   headcountTrend (line/bar chart) — requires historical headcount snapshots
 *     or a hire-date range filter. Neither exists. Omitted.
 *
 *   turnoverByDepartment (chart) — requires termination-date scoping per
 *     department. No date-range filter exists. Omitted.
 *
 *   absenceRate (KPI card) — AttendanceListParams has no date-range filter.
 *     Omitted.
 *
 *   overtimeCost (KPI card) — requires summing PayslipWire.overtime_amount
 *     across an unbounded set of payslips. Omitted.
 */

import { useQuery } from '@/lib/query';
import { useEmployeeList } from '@/features/employees/api/queries';
import { useJobPostingList } from '@/features/recruitment/api/queries';
import { usePayrollRunList } from '@/features/payroll/api/queries';
import { fetchHeadcounts } from './api/client';
import type { DepartmentHeadcount, HeadcountsResponse } from './api/client';

// ─── Total Active Employees ────────────────────────────────────────────────────

/**
 * Honest count of active employees via a perPage:1 query — reads meta.total
 * only. Using status:'active' (not all statuses) as the more meaningful
 * CEO-level headline.
 */
export function useTotalActiveEmployees() {
  return useEmployeeList({ status: 'active', perPage: 1 });
}

// ─── Open Positions ────────────────────────────────────────────────────────────

/**
 * Honest count of open job postings. perPage:1 so only meta.total is loaded.
 */
export function useOpenPositions() {
  return useJobPostingList({ status: 'open', perPage: 1 });
}

// ─── All-time Attrition ────────────────────────────────────────────────────────

/**
 * All-time attrition rate = (terminated + resigned) / (active + terminated +
 * resigned) * 100, rounded to one decimal place.
 */
export function useAllTimeAttrition() {
  const active = useEmployeeList({ status: 'active', perPage: 1 });
  const terminated = useEmployeeList({ status: 'terminated', perPage: 1 });
  const resigned = useEmployeeList({ status: 'resigned', perPage: 1 });

  const isLoading =
    active.state.status === 'pending' ||
    terminated.state.status === 'pending' ||
    resigned.state.status === 'pending';

  const error = active.state.error ?? terminated.state.error ?? resigned.state.error ?? null;

  let rate: number | undefined;
  if (
    active.state.data !== undefined &&
    terminated.state.data !== undefined &&
    resigned.state.data !== undefined
  ) {
    const a = active.state.data.meta.total;
    const t = terminated.state.data.meta.total;
    const r = resigned.state.data.meta.total;
    const denominator = a + t + r;
    rate = denominator > 0 ? Math.round(((t + r) / denominator) * 1000) / 10 : 0;
  }

  return { isLoading, error, rate };
}

// ─── Department Headcounts (single-query endpoint) ───────────────────────────

/**
 * Fetches pre-aggregated department headcounts from
 * GET /api/v1/analytics/headcounts.
 *
 * Returns { data: DepartmentHeadcount[], total_active: number } in a single
 * query — no N+1. The total_active field also serves as the denominator for
 * the bar chart's width calculations.
 */
export function useDepartmentHeadcounts() {
  return useQuery<HeadcountsResponse>({
    queryKey: ['analytics', 'headcounts'],
    queryFn: (ctx) => fetchHeadcounts(ctx.signal),
    staleTime: 30_000,
  });
}

// ─── Latest Payroll Run ────────────────────────────────────────────────────────

/**
 * Fetches the most recent PayrollRun (perPage:1). We read total_net from
 * the first record.
 */
export function useLatestPayrollRun() {
  return usePayrollRunList({ perPage: 1 });
}

// ─── Re-exported shape helpers ─────────────────────────────────────────────────

export type { DepartmentHeadcount };
