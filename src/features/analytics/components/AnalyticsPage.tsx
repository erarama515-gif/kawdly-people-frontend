import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { userFacingMessage } from '@/lib/api/errors';
import {
  useTotalActiveEmployees,
  useOpenPositions,
  useAllTimeAttrition,
  useDepartmentListForChart,
  useDeptEmployeeCount,
  useLatestPayrollRun,
} from '../hooks';
import { attritionRateColor } from '../data';
import type { DepartmentWire } from '../hooks';

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | undefined;   // undefined → show loading dash
  sub?: string;
  valueClassName?: string;
  error?: string | null;
}

function KpiCard({ label, value, sub, valueClassName, error }: KpiCardProps) {
  return (
    <Card className="flex flex-col gap-1 px-5 pb-4 pt-4">
      <span className="text-caption text-ink-muted">{label}</span>
      {error ? (
        <span className="text-caption text-coral">{error}</span>
      ) : (
        <span
          className={cn(
            'nums font-mono text-[32px] font-bold leading-[1.1] tracking-[-0.04em]',
            valueClassName ?? 'text-navy',
          )}
        >
          {value ?? '—'}
        </span>
      )}
      {sub && !error ? <span className="text-caption text-ink-faint">{sub}</span> : null}
    </Card>
  );
}

// ─── Department Distribution (horizontal bars) ────────────────────────────────

/**
 * One row in the department distribution chart.
 *
 * Each row is its own React component so it can call useDeptEmployeeCount at
 * the top level (satisfying rules-of-hooks). The parent renders one fixed
 * component instance per department — the hook call count is stable after the
 * department list loads.
 *
 * Bar width is the fraction of this department's headcount relative to total
 * active employees (the `totalEmployees` prop), so each bar shows "what share
 * of the workforce is in this department". This is more meaningful than
 * relative-to-max scaling and avoids needing to know all counts upfront.
 *
 * N+1 query note: each row issues one useEmployeeList({ departmentId, perPage:1 })
 * query. React Query deduplicates in-flight requests, so N rows fire N parallel
 * requests — acceptable for typical department counts (≤~15).
 */
function DeptBarRow({
  dept,
  totalEmployees,
  isLast,
}: {
  dept: DepartmentWire;
  totalEmployees: number | undefined;
  isLast: boolean;
}) {
  const { state } = useDeptEmployeeCount(dept.id);
  const count = state.data?.meta.total;

  // Bar width = this dept's count / total active employees, clamped to [0, 100].
  // Falls back to 0% while either count is loading.
  const barWidthPct =
    count !== undefined && totalEmployees !== undefined && totalEmployees > 0
      ? Math.min(100, (count / totalEmployees) * 100)
      : 0;

  return (
    <li className="flex items-center gap-3.5 px-5 py-2.5">
      <span className="w-[92px] shrink-0 text-body-sm font-medium text-ink">{dept.name}</span>
      <span
        className="flex h-[12px] flex-1 overflow-hidden rounded-[1px] bg-surface"
        aria-hidden="true"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to right, #E3E7EC 0, #E3E7EC 1px, #F4F5F7 1px, #F4F5F7 10px)',
        }}
      >
        <span
          className={cn(
            'h-full transition-[width] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
            isLast ? 'bg-coral' : 'bg-navy',
          )}
          style={{ width: `${barWidthPct}%` }}
        />
      </span>
      <span className="nums w-[40px] shrink-0 text-end font-mono text-[15px] font-bold tracking-[-0.04em] text-ink">
        {count !== undefined ? count : '—'}
      </span>
    </li>
  );
}

function DepartmentDistributionCard({ totalEmployees }: { totalEmployees: number | undefined }) {
  const { t } = useTranslation();
  const { state: deptState } = useDepartmentListForChart();

  const departments = deptState.data?.data ?? [];

  if (deptState.error) {
    return (
      <Card className="flex flex-col">
        <div className="border-b border-divider px-5 py-3.5">
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-ink">{t('analytics.byDepartment')}</h2>
        </div>
        <div className="px-5 py-6 text-body-sm text-coral">
          {userFacingMessage(deptState.error)}
        </div>
      </Card>
    );
  }

  if (deptState.status === 'pending' && departments.length === 0) {
    return (
      <Card className="flex flex-col">
        <div className="border-b border-divider px-5 py-3.5">
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-ink">{t('analytics.byDepartment')}</h2>
        </div>
        <div className="px-5 py-6 text-body-sm text-ink-muted">{t('common.loading')}</div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col">
      <div className="border-b border-divider px-5 py-3.5">
        <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-ink">{t('analytics.byDepartment')}</h2>
        <p className="mt-0.5 text-caption text-ink-muted">{t('analytics.headcountDistribution')}</p>
      </div>
      <ul className="flex flex-col divide-y divide-divider">
        {departments.length === 0 ? (
          <li className="px-5 py-6 text-body-sm text-ink-faint">{t('analytics.noDepartments')}</li>
        ) : (
          departments.map((dept, idx) => (
            <DeptBarRow
              key={dept.id}
              dept={dept}
              totalEmployees={totalEmployees}
              isLast={idx === departments.length - 1}
            />
          ))
        )}
      </ul>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const { t } = useTranslation();

  // ── KPI data ─────────────────────────────────────────────────────────────────

  const { state: activeEmpState } = useTotalActiveEmployees();
  const { state: openPosState } = useOpenPositions();
  const { isLoading: attritionLoading, error: attritionError, rate: attritionRate } = useAllTimeAttrition();
  const { state: payrollState } = useLatestPayrollRun();

  // Total active employees (also used as denominator for department bar chart)
  const totalEmployees = activeEmpState.data?.meta.total;
  const totalEmployeesError = activeEmpState.error ? userFacingMessage(activeEmpState.error) : null;

  // Open positions
  const openPositions = openPosState.data?.meta.total;
  const openPositionsError = openPosState.error ? userFacingMessage(openPosState.error) : null;

  // All-time attrition rate (terminated + resigned / total ever).
  // NOT a trailing-12-month rate — EmployeeListParams has no date filter, so
  // all counts are all-time totals. Labeled accordingly in the UI.
  void attritionLoading; // used only to confirm loading state is tracked; dash handles the visual
  const attritionDisplay = attritionRate !== undefined ? `${attritionRate}%` : undefined;
  const attritionErrorMsg = attritionError ? userFacingMessage(attritionError) : null;

  // Latest payroll run — we show total_net (cash disbursed to employees).
  // total_net chosen over total_gross: it represents money actually paid out.
  // Label says "Latest Payroll Run" not "this month" because PayrollRunListParams
  // has no period filter; we cannot confirm the record is for the current month.
  const latestRun = payrollState.data?.data[0];
  const payrollNetRaw = latestRun?.total_net;
  // Format in SAR millions (divide by 1,000,000), 2 decimal places
  const payrollDisplay =
    payrollNetRaw !== undefined
      ? `${(payrollNetRaw / 1_000_000).toFixed(2)}M SAR`
      : undefined;
  const payrollPeriodLabel =
    latestRun !== undefined
      ? `${t('analytics.sub.latestRun')} — ${new Date(latestRun.period_year, latestRun.period_month - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`
      : t('analytics.sub.latestRun');
  const payrollError = payrollState.error ? userFacingMessage(payrollState.error) : null;

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t('analytics.title')}
        actions={
          <button
            type="button"
            className={cn(
              'rounded-[3px] border-[1.5px] border-navy bg-navy px-4 py-2 text-[13px] font-semibold text-on-navy',
              'transition-colors hover:bg-navy-deep',
            )}
          >
            {t('analytics.exportReport')}
          </button>
        }
      />

      {/* KPI Strip
          Kept: totalEmployees (active only), openPositions, allTimeAttrition,
                payrollCost (latest run total_net).
          Omitted:
            newHires      — EmployeeListParams has no joining_date date-range filter;
                            cannot scope to "this month" server-side. Bounded-page client
                            fallback rejected: an undercounted number without a visible
                            caveat is worse than omission at the CEO-summary level.
            absenceRate   — AttendanceListParams has no date-range filter; fetching all
                            records unbounded is required. Same rationale as the
                            overdueTasks omission in onboarding/api/queries.ts.
            overtimeCost  — requires summing PayslipWire.overtime_amount across an
                            unbounded payslip set; no aggregate endpoint exists.
      */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label={t('analytics.kpi.totalEmployees')}
          value={totalEmployees !== undefined ? totalEmployees.toLocaleString() : undefined}
          sub={t('analytics.sub.asOfToday')}
          error={totalEmployeesError}
        />
        <KpiCard
          label={t('analytics.kpi.openPositions')}
          value={openPositions !== undefined ? openPositions.toLocaleString() : undefined}
          sub={t('analytics.sub.openListings')}
          error={openPositionsError}
        />
        <KpiCard
          label={t('analytics.kpi.allTimeAttrition')}
          value={attritionDisplay}
          sub={t('analytics.sub.allTimeAttritionNote')}
          valueClassName={attritionRate !== undefined ? attritionRateColor(attritionRate) : 'text-navy'}
          error={attritionErrorMsg}
        />
        <KpiCard
          label={t('analytics.kpi.payrollCost')}
          value={payrollDisplay}
          sub={payrollError ? undefined : payrollPeriodLabel}
          error={payrollError}
        />
      </div>

      {/* Department distribution chart.
          Bar width = dept headcount / total active employees (share-of-workforce metric).
          N+1 per-dept queries are acceptable — see hooks.ts for the rationale.

          Headcount Trend chart omitted: requires historical headcount snapshots or a
          joining_date range filter on EmployeeListParams — neither exists.
      */}
      <div className="mb-6">
        <DepartmentDistributionCard totalEmployees={totalEmployees} />
      </div>

      {/*
        Turnover Analysis card omitted: turnoverByDepartment requires termination-date
        scoping per department. No date-range filter exists on EmployeeListParams.
        The KPI strip shows all-time attrition (terminated+resigned / total ever)
        as an honest substitute, labeled as "All-time" to avoid implying a
        trailing-12-month scope.
      */}

      {/* Bottom spacer */}
      <div className="h-10" aria-hidden="true" />
    </div>
  );
}
