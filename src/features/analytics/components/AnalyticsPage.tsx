import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { SkeletonTable } from '@/components/ui/SkeletonTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { ExportButton } from '@/components/ui/ExportButton';
import type { ExportColumn } from '@/components/ui/ExportButton';
import { userFacingMessage } from '@/lib/api/errors';
import {
  useTotalActiveEmployees,
  useOpenPositions,
  useAllTimeAttrition,
  useDepartmentHeadcounts,
  useLatestPayrollRun,
} from '../hooks';
import { attritionRateColor } from '../data';
import type { DepartmentHeadcount } from '../hooks';
import { HeadcountTrendChart } from './HeadcountTrendChart';
import { DepartmentDistributionChart } from './DepartmentDistributionChart';
import { TurnoverRateChart } from './TurnoverRateChart';
import { LeaveUtilizationChart } from './LeaveUtilizationChart';

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | undefined;   // undefined → show loading dash
  sub?: string | undefined;
  valueClassName?: string | undefined;
  error?: string | null | undefined;
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
 * Bar width is the fraction of this department's headcount relative to total
 * active employees, so each bar shows "what share of the workforce is in
 * this department".
 */
function DeptBarRow({
  dept,
  totalActive,
  isLast,
}: {
  dept: DepartmentHeadcount;
  totalActive: number;
  isLast: boolean;
}) {
  const barWidthPct =
    totalActive > 0 ? Math.min(100, (dept.headcount / totalActive) * 100) : 0;

  return (
    <li className="flex items-center gap-3.5 px-5 py-2.5">
      <span className="w-[92px] shrink-0 text-body-sm font-medium text-ink">
        {dept.department_name}
      </span>
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
        {dept.headcount}
      </span>
    </li>
  );
}

function DepartmentDistributionCard() {
  const { t } = useTranslation();
  const { state: headcountState } = useDepartmentHeadcounts();

  if (headcountState.error) {
    return (
      <Card className="flex flex-col">
        <div className="border-b border-divider px-5 py-3.5">
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-ink">{t('analytics.byDepartment')}</h2>
        </div>
        <div className="px-5 py-6 text-body-sm text-coral">
          {userFacingMessage(headcountState.error)}
        </div>
      </Card>
    );
  }

  if (headcountState.status === 'pending' || !headcountState.data) {
    return (
      <Card className="flex flex-col">
        <div className="border-b border-divider px-5 py-3.5">
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-ink">{t('analytics.byDepartment')}</h2>
        </div>
        <div className="px-5 py-3">
          <SkeletonTable rows={6} columns={3} />
        </div>
      </Card>
    );
  }

  const departments = headcountState.data.data;
  const totalActive = headcountState.data.total_active;

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
              key={dept.department_id}
              dept={dept}
              totalActive={totalActive}
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
  // Same cache key as `DepartmentDistributionCard` below — this is a cache
  // hit, not a second network request, and gives the export button the
  // department breakdown without prop-drilling into that component.
  const { state: headcountState } = useDepartmentHeadcounts();

  // Total active employees
  const totalEmployees = activeEmpState.data?.meta.total;
  const totalEmployeesError = activeEmpState.error ? userFacingMessage(activeEmpState.error) : null;

  // Open positions
  const openPositions = openPosState.data?.meta.total;
  const openPositionsError = openPosState.error ? userFacingMessage(openPosState.error) : null;

  // All-time attrition rate
  void attritionLoading;
  const attritionDisplay = attritionRate !== undefined ? `${attritionRate}%` : undefined;
  const attritionErrorMsg = attritionError ? userFacingMessage(attritionError) : null;

  // Latest payroll run
  const latestRun = payrollState.data?.data[0];
  const payrollNetRaw = latestRun?.total_net;
  const payrollDisplay =
    payrollNetRaw !== undefined
      ? `${(payrollNetRaw / 1_000_000).toFixed(2)}M SAR`
      : undefined;
  const payrollPeriodLabel =
    latestRun !== undefined
      ? `${t('analytics.sub.latestRun')} — ${new Date(latestRun.period_year, latestRun.period_month - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`
      : t('analytics.sub.latestRun');
  const payrollError = payrollState.error ? userFacingMessage(payrollState.error) : null;

  // ── Export Report — a metric/value snapshot of everything on this page,
  // built only from values already fetched above (never fabricated). ────────
  const exportColumns: ExportColumn[] = [
    { key: 'metric', label: t('analytics.export.metric') },
    { key: 'value', label: t('analytics.export.value') },
  ];

  const exportRows = useMemo(() => {
    const rows: Record<string, unknown>[] = [
      { metric: t('analytics.kpi.totalEmployees'), value: totalEmployees?.toLocaleString() ?? '—' },
      { metric: t('analytics.kpi.openPositions'), value: openPositions?.toLocaleString() ?? '—' },
      { metric: t('analytics.kpi.allTimeAttrition'), value: attritionDisplay ?? '—' },
      { metric: t('analytics.kpi.payrollCost'), value: payrollDisplay ?? '—' },
    ];
    for (const dept of headcountState.data?.data ?? []) {
      rows.push({
        metric: t('analytics.export.departmentHeadcount', { department: dept.department_name }),
        value: dept.headcount.toLocaleString(),
      });
    }
    return rows;
  }, [t, totalEmployees, openPositions, attritionDisplay, payrollDisplay, headcountState.data]);

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t('analytics.title')}
        actions={
          <ExportButton data={exportRows} columns={exportColumns} filename="hr-analytics-report" />
        }
      />

      {/* KPI Strip */}
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

      {/* Department distribution chart — single-query endpoint, no N+1 */}
      <div className="mb-6">
        <DepartmentDistributionCard />
      </div>

      {/* ── Recharts analytics charts — 2×2 grid ─────────────────────────── */}
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HeadcountTrendChart />
        <DepartmentDistributionChart />
        <TurnoverRateChart />
        <LeaveUtilizationChart />
      </div>

      {/* Bottom spacer */}
      <div className="h-10" aria-hidden="true" />
    </div>
  );
}
