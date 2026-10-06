import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/form';
import { userFacingMessage } from '@/lib/api/errors';
import {
  usePayrollRunList,
  useDeletePayrollRun,
  usePayslipList,
  useDeletePayslip,
} from '../api/queries';
import type {
  PayrollRunListParams,
  PayrollRunStatus,
  PayslipListParams,
  PayslipStatus,
} from '../api/resource';
import { PAYROLL_RUN_PIPELINE } from '../api/resource';
import type { PayrollRunWire, PayslipWire } from '../api/schema';
import { PayrollRunFormDialog } from './PayrollRunFormDialog';
import { PayslipFormDialog } from './PayslipFormDialog';

/**
 * Payroll module live-data page — two independently-paged resources.
 *
 * Section 1: PayrollRun — paginated table with Add/Edit/Delete + pipeline stepper.
 *   - period_month (int) + period_year (int) formatted client-side.
 *   - 7-value status enum: draft|calculating|calculated|reviewing|approved|posted|paid.
 *   - /calculate and /approve actions SKIPPED — no auth context yet (same as Loans /approve).
 *
 * Section 2: Payslip — table scoped to the currently-selected PayrollRun.
 *   - Payslip index endpoint supports ?payroll_run_id= filter (verified from $filterable).
 *   - Employee name resolved via the `employee` relation (same convention as Attendance/Leave).
 *   - `total_deductions` is the real column (old mock used `deductions`).
 *   - `status` is draft|finalized|paid (old mock had 'processed' — dropped).
 */

const RUN_PER_PAGE = 10;
const PAYSLIP_PER_PAGE = 10;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPeriod(month: number, year: number): string {
  return `${new Date(year, month - 1).toLocaleDateString('en-GB', { month: 'long' })} ${year}`;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function initialsOf(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// ─── Status badges ────────────────────────────────────────────────────────────

const RUN_STATUS_STYLES: Record<PayrollRunStatus, string> = {
  draft:       'bg-gray-100 text-gray-600',
  calculating: 'bg-sky-50 text-sky-700',
  calculated:  'bg-blue-50 text-blue-700',
  reviewing:   'bg-amber-50 text-amber-700',
  approved:    'bg-violet-50 text-violet-700',
  posted:      'bg-emerald-50 text-emerald-700',
  paid:        'bg-emerald-100 text-emerald-800',
};

const PAYSLIP_STATUS_STYLES: Record<PayslipStatus, string> = {
  draft:     'bg-gray-100 text-gray-600',
  finalized: 'bg-sky-50 text-sky-700',
  paid:      'bg-emerald-50 text-emerald-700',
};

function RunStatusBadge({ status }: { status: PayrollRunStatus | undefined }) {
  const { t } = useTranslation();
  if (!status) return null;
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', RUN_STATUS_STYLES[status])}>
      {t(`payroll.runStatusOptions.${status}`)}
    </span>
  );
}

function PayslipStatusBadge({ status }: { status: PayslipStatus | undefined }) {
  const { t } = useTranslation();
  if (!status) return null;
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', PAYSLIP_STATUS_STYLES[status])}>
      {t(`payroll.payslipStatusOptions.${status}`)}
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: number | undefined; accent?: boolean }) {
  return (
    <Card className="flex flex-col gap-1 px-5 pb-4 pt-4">
      <span className="text-caption text-ink-muted">{label}</span>
      <span
        className={cn(
          'nums font-mono text-[32px] font-bold leading-[1.1] tracking-[-0.04em]',
          accent ? 'text-coral' : 'text-navy',
        )}
      >
        {value !== undefined ? value.toLocaleString() : '—'}
      </span>
    </Card>
  );
}

// ─── Row Actions ──────────────────────────────────────────────────────────────

function RowActions({ onEdit, onDelete, editLabel, deleteLabel }: {
  onEdit: () => void;
  onDelete: () => void;
  editLabel: string;
  deleteLabel: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" className="h-7 w-7 px-0" aria-label={editLabel} onClick={onEdit}>
        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        className="h-7 w-7 px-0 hover:!text-coral"
        aria-label={deleteLabel}
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      </Button>
    </div>
  );
}

// ─── Pipeline Stepper ────────────────────────────────────────────────────────

function PipelineStepper({ status }: { status: PayrollRunStatus | undefined }) {
  const { t } = useTranslation();
  const currentIndex = status ? PAYROLL_RUN_PIPELINE.indexOf(status) : -1;

  return (
    <div className="flex items-center gap-0">
      {PAYROLL_RUN_PIPELINE.map((step, idx) => {
        const isDone    = idx < currentIndex;
        const isCurrent = idx === currentIndex;
        const isLast    = idx === PAYROLL_RUN_PIPELINE.length - 1;

        return (
          <div key={step} className="flex min-w-0 flex-1 items-center">
            <div className="flex flex-1 flex-col items-center gap-1">
              <div
                className={cn(
                  'h-2 w-2 rounded-full',
                  isDone    ? 'bg-emerald-400' :
                  isCurrent ? 'bg-coral' :
                               'bg-on-navy/20',
                )}
              />
              <span
                className={cn(
                  'text-[9px] font-semibold whitespace-nowrap',
                  isCurrent ? 'text-coral' :
                  isDone    ? 'text-on-navy/70' :
                               'text-on-navy/30',
                )}
              >
                {t(`payroll.runStatusOptions.${step}`)}
              </span>
            </div>
            {!isLast && (
              <div
                className={cn(
                  'h-[1px] flex-1',
                  idx < currentIndex ? 'bg-emerald-400' : 'bg-on-navy/20',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PayrollPage() {
  const { t } = useTranslation();

  // ── PayrollRun state ────
  const [runPage, setRunPage] = useState(1);
  const [runStatusFilter, setRunStatusFilter] = useState<PayrollRunStatus | 'all'>('all');
  const [runFormOpen, setRunFormOpen] = useState(false);
  const [editRun, setEditRun] = useState<PayrollRunWire | undefined>(undefined);
  const [deleteRun, setDeleteRun] = useState<PayrollRunWire | undefined>(undefined);
  /** The run whose payslips are shown in section 2. */
  const [selectedRunId, setSelectedRunId] = useState<number | undefined>(undefined);

  const runParams = useMemo<PayrollRunListParams>(
    () => ({
      page: runPage,
      perPage: RUN_PER_PAGE,
      status: runStatusFilter === 'all' ? undefined : runStatusFilter,
    }),
    [runPage, runStatusFilter],
  );
  const { state: runState, refetch: refetchRuns } = usePayrollRunList(runParams);
  // Cheap stat queries — each reads only `meta.total`.
  const { state: totalRunState }    = usePayrollRunList({ page: 1, perPage: 1 });
  const { state: draftRunState }    = usePayrollRunList({ page: 1, perPage: 1, status: 'draft' });
  const { state: reviewingRunState} = usePayrollRunList({ page: 1, perPage: 1, status: 'reviewing' });

  const deleteRunMutation = useDeletePayrollRun(runParams);

  const runs    = runState.data?.data ?? [];
  const runMeta = runState.data?.meta;

  // ── Payslip state ────
  const [payslipPage, setPayslipPage] = useState(1);
  const [payslipStatusFilter, setPayslipStatusFilter] = useState<PayslipStatus | 'all'>('all');
  const [payslipFormOpen, setPayslipFormOpen] = useState(false);
  const [editPayslip, setEditPayslip] = useState<PayslipWire | undefined>(undefined);
  const [deletePayslip, setDeletePayslip] = useState<PayslipWire | undefined>(undefined);

  const payslipParams = useMemo<PayslipListParams>(
    () => ({
      page: payslipPage,
      perPage: PAYSLIP_PER_PAGE,
      payroll_run_id: selectedRunId,
      status: payslipStatusFilter === 'all' ? undefined : payslipStatusFilter,
    }),
    [payslipPage, selectedRunId, payslipStatusFilter],
  );
  const { state: payslipState, refetch: refetchPayslips } = usePayslipList(payslipParams);

  const deletePayslipMutation = useDeletePayslip(payslipParams);

  const payslips     = payslipState.data?.data ?? [];
  const payslipMeta  = payslipState.data?.meta;

  // ── PayrollRun actions ────

  function openAddRun() {
    setEditRun(undefined);
    setRunFormOpen(true);
  }

  function openEditRun(run: PayrollRunWire) {
    setEditRun(run);
    setRunFormOpen(true);
  }

  async function confirmDeleteRun() {
    if (!deleteRun) return;
    const result = await deleteRunMutation.mutate(deleteRun.id);
    if (result !== undefined || deleteRunMutation.error === undefined) setDeleteRun(undefined);
  }

  function handleRunStatusFilterChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setRunStatusFilter(val === 'all' ? 'all' : (val as PayrollRunStatus));
    setRunPage(1);
  }

  // ── Payslip actions ────

  function openAddPayslip() {
    setEditPayslip(undefined);
    setPayslipFormOpen(true);
  }

  function openEditPayslip(ps: PayslipWire) {
    setEditPayslip(ps);
    setPayslipFormOpen(true);
  }

  async function confirmDeletePayslip() {
    if (!deletePayslip) return;
    const result = await deletePayslipMutation.mutate(deletePayslip.id);
    if (result !== undefined || deletePayslipMutation.error === undefined) setDeletePayslip(undefined);
  }

  function handlePayslipStatusFilterChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setPayslipStatusFilter(val === 'all' ? 'all' : (val as PayslipStatus));
    setPayslipPage(1);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t('payroll.title')}
        actions={
          <Button variant="primary" onClick={openAddRun}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            {t('payroll.run.add')}
          </Button>
        }
      />

      {/* ── Payroll Run stat strip ─────────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t('payroll.run.stat.total')}    value={totalRunState.data?.meta.total}     />
        <StatCard label={t('payroll.run.stat.draft')}    value={draftRunState.data?.meta.total}    accent />
        <StatCard label={t('payroll.run.stat.reviewing')} value={reviewingRunState.data?.meta.total} />
      </div>

      {/* ═══ Section 1: Payroll Runs ═══════════════════════════════════════════ */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-body font-semibold text-ink">{t('payroll.run.sectionTitle')}</h2>
        <Select
          className="h-8 w-44 text-[12px]"
          value={runStatusFilter}
          onChange={handleRunStatusFilterChange}
          aria-label={t('payroll.run.filterByStatus')}
        >
          <option value="all">{t('payroll.run.allStatuses')}</option>
          {(['draft', 'calculating', 'calculated', 'reviewing', 'approved', 'posted', 'paid'] as PayrollRunStatus[]).map((s) => (
            <option key={s} value={s}>
              {t(`payroll.runStatusOptions.${s}`)}
            </option>
          ))}
        </Select>
      </div>

      {runState.error ? (
        <p className="mb-4 text-body-sm text-coral">{userFacingMessage(runState.error)}</p>
      ) : null}

      {/* Desktop table */}
      <Card className="mb-4 hidden overflow-hidden lg:block">
        <div className="grid grid-cols-[minmax(140px,2fr)_80px_80px_100px_100px_100px_120px_auto] border-b border-divider px-5 py-2.5">
          {(['period', 'status', 'gross', 'deductions', 'net', 'employees', 'locked', ''] as const).map((col, i) => (
            <span key={i} className="text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
              {col ? t(`payroll.run.table.${col}`) : ''}
            </span>
          ))}
        </div>

        {runs.length === 0 && !runState.loading ? (
          <p className="px-5 py-6 text-center text-body-sm text-ink-muted">{t('payroll.run.empty')}</p>
        ) : null}

        {runs.map((run) => {
          const isSelected = run.id === selectedRunId;
          return (
            <div
              key={run.id}
              className={cn(
                'grid grid-cols-[minmax(140px,2fr)_80px_80px_100px_100px_100px_120px_auto] items-center border-b border-divider px-5 py-3 last:border-b-0',
                isSelected ? 'bg-navy/5' : 'hover:bg-page',
                'cursor-pointer',
              )}
              onClick={() => setSelectedRunId(isSelected ? undefined : run.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedRunId(isSelected ? undefined : run.id); }}
              aria-pressed={isSelected}
              aria-label={`${t('payroll.run.selectRun')} ${formatPeriod(run.period_month, run.period_year)}`}
            >
              <span className="text-body-sm font-semibold text-ink">
                {formatPeriod(run.period_month, run.period_year)}
              </span>
              <RunStatusBadge status={run.status} />
              <span className="nums font-mono text-body-sm text-ink">
                {run.total_gross !== undefined ? formatCurrency(run.total_gross) : '—'}
              </span>
              <span className="nums font-mono text-body-sm text-coral">
                {run.total_deductions !== undefined ? formatCurrency(run.total_deductions) : '—'}
              </span>
              <span className="nums font-mono text-body-sm font-bold text-navy">
                {run.total_net !== undefined ? formatCurrency(run.total_net) : '—'}
              </span>
              <span className="nums font-mono text-body-sm text-ink-muted">
                {run.employee_count !== undefined ? run.employee_count.toLocaleString() : '—'}
              </span>
              <span className="text-body-sm text-ink-muted">
                {run.is_locked ? t('common.yes') : t('common.no')}
              </span>
              <div onClick={(e) => e.stopPropagation()}>
                <RowActions
                  onEdit={() => openEditRun(run)}
                  onDelete={() => setDeleteRun(run)}
                  editLabel={t('payroll.run.editAction')}
                  deleteLabel={t('payroll.run.deleteAction')}
                />
              </div>
            </div>
          );
        })}
      </Card>

      {/* Mobile run cards */}
      <div className="mb-4 flex flex-col gap-3 lg:hidden">
        {runs.map((run) => {
          const isSelected = run.id === selectedRunId;
          return (
            <Card
              key={run.id}
              className={cn('flex flex-col gap-3 p-4', isSelected && 'ring-2 ring-navy/30')}
              onClick={() => setSelectedRunId(isSelected ? undefined : run.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedRunId(isSelected ? undefined : run.id); }}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-body-sm font-semibold text-ink">
                  {formatPeriod(run.period_month, run.period_year)}
                </p>
                <RunStatusBadge status={run.status} />
              </div>

              {/* Pipeline stepper on dark strip */}
              {run.status ? (
                <div className="rounded bg-navy px-3 py-2.5 text-on-navy">
                  <PipelineStepper status={run.status} />
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-2 border-t border-divider pt-2 text-center">
                <div>
                  <p className="text-caption text-ink-faint">{t('payroll.run.table.gross')}</p>
                  <p className="nums font-mono text-[12px] text-ink">
                    {run.total_gross !== undefined ? formatCurrency(run.total_gross) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-caption text-ink-faint">{t('payroll.run.table.net')}</p>
                  <p className="nums font-mono text-[12px] font-bold text-navy">
                    {run.total_net !== undefined ? formatCurrency(run.total_net) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-caption text-ink-faint">{t('payroll.run.table.employees')}</p>
                  <p className="nums font-mono text-[12px] text-ink">
                    {run.employee_count !== undefined ? run.employee_count.toLocaleString() : '—'}
                  </p>
                </div>
              </div>

              <div
                className="flex justify-end border-t border-divider pt-2"
                onClick={(e) => e.stopPropagation()}
              >
                <RowActions
                  onEdit={() => openEditRun(run)}
                  onDelete={() => setDeleteRun(run)}
                  editLabel={t('payroll.run.editAction')}
                  deleteLabel={t('payroll.run.deleteAction')}
                />
              </div>
            </Card>
          );
        })}
      </div>

      {runMeta && runMeta.last_page > 1 ? (
        <div className="mb-8">
          <Pagination
            currentPage={runMeta.current_page}
            lastPage={runMeta.last_page}
            total={runMeta.total}
            perPage={runMeta.per_page}
            onPageChange={setRunPage}
          />
        </div>
      ) : (
        <div className="mb-8" />
      )}

      {/* ═══ Section 2: Payslips (scoped to selected run) ═════════════════════ */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-body font-semibold text-ink">{t('payroll.payslip.sectionTitle')}</h2>
          {selectedRunId ? (
            <span className="rounded-full bg-navy/10 px-2.5 py-0.5 text-[11px] font-semibold text-navy">
              {(() => {
                const run = runs.find((r) => r.id === selectedRunId);
                return run ? formatPeriod(run.period_month, run.period_year) : `#${selectedRunId}`;
              })()}
            </span>
          ) : (
            <span className="text-caption text-ink-muted">{t('payroll.payslip.selectRunHint')}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select
            className="h-8 w-36 text-[12px]"
            value={payslipStatusFilter}
            onChange={handlePayslipStatusFilterChange}
            aria-label={t('payroll.payslip.filterByStatus')}
          >
            <option value="all">{t('payroll.payslip.allStatuses')}</option>
            {(['draft', 'finalized', 'paid'] as PayslipStatus[]).map((s) => (
              <option key={s} value={s}>
                {t(`payroll.payslipStatusOptions.${s}`)}
              </option>
            ))}
          </Select>
          {selectedRunId ? (
            <Button variant="primary" onClick={openAddPayslip}>
              <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              {t('payroll.payslip.add')}
            </Button>
          ) : null}
        </div>
      </div>

      {payslipState.error ? (
        <p className="mb-4 text-body-sm text-coral">{userFacingMessage(payslipState.error)}</p>
      ) : null}

      {/* Desktop payslip table */}
      <Card className="hidden overflow-hidden lg:block">
        <div className="grid grid-cols-[minmax(160px,2fr)_90px_90px_90px_90px_90px_80px_auto] border-b border-divider px-5 py-2.5">
          {(['employee', 'basic', 'gross', 'earnings', 'deductions', 'net', 'status', ''] as const).map((col, i) => (
            <span key={i} className="text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
              {col ? t(`payroll.payslip.table.${col}`) : ''}
            </span>
          ))}
        </div>

        {!selectedRunId ? (
          <p className="px-5 py-6 text-center text-body-sm text-ink-muted">{t('payroll.payslip.selectRunHint')}</p>
        ) : payslips.length === 0 && !payslipState.loading ? (
          <p className="px-5 py-6 text-center text-body-sm text-ink-muted">{t('payroll.payslip.empty')}</p>
        ) : null}

        {payslips.map((ps) => {
          const emp = ps.employee;
          const firstName = emp?.first_name ?? '';
          const lastName  = emp?.last_name ?? '';
          const initials  = emp ? initialsOf(firstName, lastName) : '?';
          const fullName  = emp ? `${firstName} ${lastName}` : `#${ps.employee_id}`;

          return (
            <div
              key={ps.id}
              className="grid grid-cols-[minmax(160px,2fr)_90px_90px_90px_90px_90px_80px_auto] items-center border-b border-divider px-5 py-3 last:border-b-0 hover:bg-page"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar initials={initials} photo={emp?.photo} size={32} />
                <span className="truncate text-body-sm font-semibold text-ink">{fullName}</span>
              </div>
              <span className="nums font-mono text-body-sm text-ink">{ps.basic_salary.toLocaleString()}</span>
              <span className="nums font-mono text-body-sm text-ink">{ps.gross_salary.toLocaleString()}</span>
              <span className="nums font-mono text-body-sm text-ink">{ps.total_earnings.toLocaleString()}</span>
              <span className="nums font-mono text-body-sm text-coral">{ps.total_deductions.toLocaleString()}</span>
              <span className="nums font-mono text-body-sm font-bold text-navy">{ps.net_salary.toLocaleString()}</span>
              <PayslipStatusBadge status={ps.status} />
              <RowActions
                onEdit={() => openEditPayslip(ps)}
                onDelete={() => setDeletePayslip(ps)}
                editLabel={t('payroll.payslip.editAction')}
                deleteLabel={t('payroll.payslip.deleteAction')}
              />
            </div>
          );
        })}
      </Card>

      {/* Mobile payslip cards */}
      <div className="flex flex-col gap-3 lg:hidden">
        {!selectedRunId ? (
          <p className="text-center text-body-sm text-ink-muted">{t('payroll.payslip.selectRunHint')}</p>
        ) : null}
        {payslips.map((ps) => {
          const emp       = ps.employee;
          const firstName = emp?.first_name ?? '';
          const lastName  = emp?.last_name ?? '';
          const initials  = emp ? initialsOf(firstName, lastName) : '?';
          const fullName  = emp ? `${firstName} ${lastName}` : `#${ps.employee_id}`;

          return (
            <Card key={ps.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar initials={initials} photo={emp?.photo} size={36} />
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-ink">{fullName}</p>
                    <p className="truncate text-caption text-ink-muted">
                      {emp?.employee_number ?? ''}
                    </p>
                  </div>
                </div>
                <PayslipStatusBadge status={ps.status} />
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-divider pt-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-caption text-ink-faint">{t('payroll.payslip.table.basic')}</span>
                  <span className="nums font-mono text-[12px] text-ink">{ps.basic_salary.toLocaleString()}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-caption text-ink-faint">{t('payroll.payslip.table.gross')}</span>
                  <span className="nums font-mono text-[12px] text-ink">{ps.gross_salary.toLocaleString()}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-caption text-ink-faint">{t('payroll.payslip.table.deductions')}</span>
                  <span className="nums font-mono text-[12px] text-coral">{ps.total_deductions.toLocaleString()}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-caption text-ink-faint">{t('payroll.payslip.table.net')}</span>
                  <span className="nums font-mono text-[12px] font-bold text-navy">{ps.net_salary.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-end border-t border-divider pt-2">
                <RowActions
                  onEdit={() => openEditPayslip(ps)}
                  onDelete={() => setDeletePayslip(ps)}
                  editLabel={t('payroll.payslip.editAction')}
                  deleteLabel={t('payroll.payslip.deleteAction')}
                />
              </div>
            </Card>
          );
        })}
      </div>

      {payslipMeta && payslipMeta.last_page > 1 ? (
        <div className="mt-4">
          <Pagination
            currentPage={payslipMeta.current_page}
            lastPage={payslipMeta.last_page}
            total={payslipMeta.total}
            perPage={payslipMeta.per_page}
            onPageChange={setPayslipPage}
          />
        </div>
      ) : null}

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      <PayrollRunFormDialog
        open={runFormOpen}
        onOpenChange={setRunFormOpen}
        run={editRun}
      />

      {selectedRunId !== undefined ? (
        <PayslipFormDialog
          open={payslipFormOpen}
          onOpenChange={setPayslipFormOpen}
          payrollRunId={selectedRunId}
          payslip={editPayslip}
        />
      ) : null}

      <ConfirmDialog
        open={deleteRun !== undefined}
        onOpenChange={(open) => { if (!open) setDeleteRun(undefined); }}
        title={t('payroll.run.deleteTitle')}
        description={
          deleteRun
            ? t('payroll.run.deleteDescription', {
                period: formatPeriod(deleteRun.period_month, deleteRun.period_year),
              })
            : ''
        }
        confirmLabel={t('common.delete')}
        onConfirm={confirmDeleteRun}
        isLoading={deleteRunMutation.isPending}
      />

      <ConfirmDialog
        open={deletePayslip !== undefined}
        onOpenChange={(open) => { if (!open) setDeletePayslip(undefined); }}
        title={t('payroll.payslip.deleteTitle')}
        description={
          deletePayslip
            ? t('payroll.payslip.deleteDescription', {
                name: deletePayslip.employee
                  ? `${deletePayslip.employee.first_name} ${deletePayslip.employee.last_name}`
                  : `#${deletePayslip.employee_id}`,
              })
            : ''
        }
        confirmLabel={t('common.delete')}
        onConfirm={confirmDeletePayslip}
        isLoading={deletePayslipMutation.isPending}
      />

      {/* Log load errors for developers when not displayed inline */}
      {runState.error && !runState.loading ? (
        <p className="mt-2 text-caption text-ink-faint">
          {t('payroll.run.loadFailed')}
          <button className="ml-1 underline" onClick={refetchRuns}>{t('common.retry')}</button>
        </p>
      ) : null}
      {payslipState.error && !payslipState.loading ? (
        <p className="mt-2 text-caption text-ink-faint">
          {t('payroll.payslip.loadFailed')}
          <button className="ml-1 underline" onClick={refetchPayslips}>{t('common.retry')}</button>
        </p>
      ) : null}
    </div>
  );
}
