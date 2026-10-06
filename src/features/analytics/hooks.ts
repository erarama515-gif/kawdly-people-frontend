/**
 * Analytics data composition layer.
 *
 * This file composes live query hooks from other features into the shapes
 * AnalyticsPage needs. It does NOT add new backend endpoints — every number
 * shown on the Analytics page is derived from existing, already-wired list
 * endpoints. See the block comment above each hook for the derivation rationale.
 *
 * OMISSION REGISTER (stats that cannot be honestly computed):
 *
 *   newHires (KPI card) — EmployeeListParams has no joining_date date-range
 *     filter, so "hired this month" cannot be scoped server-side. The
 *     bounded-page client-side fallback (perPage:200) was considered but
 *     rejected here because the Analytics page targets CEO-level overview, and
 *     a potentially-undercounted number without a clear caveat inline is worse
 *     than the absence of the card. Revisit when a date-range filter is added.
 *
 *   headcountTrend (line/bar chart) — requires historical headcount snapshots
 *     or a hire-date range filter. Neither exists. Omitted.
 *
 *   turnoverByDepartment (chart) — requires termination-date scoping per
 *     department. No date-range filter exists. Omitted.
 *
 *   absenceRate (KPI card) — AttendanceListParams has no date-range filter at
 *     all; fetching all records to count absences would be unbounded. Omitted,
 *     same precedent as onboarding/api/queries.ts overdueTasks omission.
 *
 *   overtimeCost (KPI card) — requires summing PayslipWire.overtime_amount
 *     across an unbounded set of payslips. Omitted.
 */

import { useEmployeeList } from '@/features/employees/api/queries';
import { useJobPostingList } from '@/features/recruitment/api/queries';
import { useDepartmentList } from '@/features/organization/api/queries';
import { usePayrollRunList } from '@/features/payroll/api/queries';
import type { DepartmentWire } from '@/features/organization/api/schema';

// ─── Total Active Employees ────────────────────────────────────────────────────

/**
 * Honest count of active employees via a perPage:1 query — reads meta.total
 * only. Using status:'active' (not all statuses) as the more meaningful
 * CEO-level headline: it excludes suspended/terminated/resigned staff who are
 * no longer operational.
 */
export function useTotalActiveEmployees() {
  return useEmployeeList({ status: 'active', perPage: 1 });
}

// ─── Open Positions ────────────────────────────────────────────────────────────

/**
 * Honest count of open job postings. status:'open' is a client-synthesised
 * filter (is_published=true + expires_at null or future) handled by the mock
 * and real API alike. perPage:1 so only meta.total is loaded.
 */
export function useOpenPositions() {
  return useJobPostingList({ status: 'open', perPage: 1 });
}

// ─── All-time Attrition ────────────────────────────────────────────────────────

/**
 * All-time attrition rate = (terminated + resigned) / (active + terminated +
 * resigned) * 100, rounded to one decimal place.
 *
 * This is NOT a trailing-12-month turnover rate — EmployeeListParams has no
 * date-range filter, so we cannot scope to a period. We compute it over all
 * records ever created and label it "All-time attrition" in the UI.
 *
 * Each status requires a single perPage:1 query — three total. This mirrors
 * the existing codebase's "perPage:1 honest count" idiom.
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

// ─── Department Distribution ───────────────────────────────────────────────────

/**
 * Per-department employee counts for the headcount distribution bar chart.
 *
 * Implementation uses N+1 queries: one useDepartmentList call to get all
 * departments (perPage:100), then one useEmployeeList({departmentId, perPage:1})
 * per department to read meta.total. This is acceptable because:
 *   (a) department counts are typically under ~15, keeping request volume low;
 *   (b) it mirrors the "perPage:1 honest count" idiom used throughout
 *       OrganizationPage and OnboardingPage stat cards;
 *   (c) results are cached by React Query so repeated renders are free.
 * If department counts grow, replace with a dedicated aggregate endpoint.
 */

/** Returns all departments fetched in a single bounded call. */
export function useDepartmentListForChart() {
  return useDepartmentList({ perPage: 100 });
}

/**
 * One per-department employee count hook. MUST be called with a stable dept id
 * and name — the caller (component) is responsible for rendering one
 * DeptBarRow per department so React's rules-of-hooks are satisfied.
 */
export function useDeptEmployeeCount(deptId: number) {
  return useEmployeeList({ departmentId: deptId, perPage: 1 });
}

// ─── Latest Payroll Run ────────────────────────────────────────────────────────

/**
 * Fetches the most recent PayrollRun (perPage:1, no period filter since
 * PayrollRunListParams exposes only status and page/perPage — no sort option
 * or period_month/period_year filter). We read total_net from the first record.
 *
 * We use total_net (take-home) rather than total_gross because:
 *   - net is the cash actually disbursed — more meaningful as a cost-to-disburse
 *     figure on a CEO summary;
 *   - total_gross is still visible as a secondary sub-label.
 *
 * The label in the UI says "Latest Payroll Run" — NOT "this month" — because
 * we cannot reliably confirm the record belongs to the current calendar month
 * without a period filter.
 */
export function useLatestPayrollRun() {
  return usePayrollRunList({ perPage: 1 });
}

// ─── Re-exported shape helpers ─────────────────────────────────────────────────

export type { DepartmentWire };
