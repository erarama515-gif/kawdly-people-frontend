import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useCan } from '@/hooks/useCan';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { SkeletonTable } from '@/components/ui/SkeletonTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/components/ui/Toast';
import { userFacingMessage } from '@/lib/api/errors';
import { useApproveLoan, useDeleteLoan, useLoanList } from '../api/queries';
import type { LoanListParams, LoanStatus, LoanType } from '../api/resource';
import type { LoanWire } from '../api/schema';
import { LoanFormDialog } from './LoanFormDialog';

/**
 * Loans module live-data page. Mirrors `AttendancePage` conventions:
 * - `useLoanList` for data
 * - Add/Edit via `LoanFormDialog`
 * - Delete via `ConfirmDialog` + optimistic `useDeleteLoan`
 * - Approve (pending → active) via `ConfirmDialog` + `useApproveLoan`, gated
 *   behind `payroll.loan_approval.approve` (the matrix's dedicated "Loan
 *   Approval" permission, distinct from base loan CRUD)
 * - `Pagination` for page controls
 * - Debounced search (employee name)
 * - Status filter chips (real backend values: pending/active/completed/cancelled —
 *   NO "defaulted", that was a fabricated UI-only status)
 * - Stat cards each backed by a cheap `perPage:1` filtered query (total / active / pending)
 */

const PER_PAGE = 10;

const STATUS_CLASSES: Record<LoanStatus, string> = {
  active:    'bg-emerald-50 text-emerald-700',
  completed: 'bg-surface text-ink-muted border border-divider',
  pending:   'bg-amber-50 text-amber-700',
  cancelled: 'bg-red-50 text-red-700',
};

const TYPE_CLASSES: Record<LoanType, string> = {
  loan:    'bg-navy/10 text-navy',
  advance: 'bg-orange-50 text-orange-700',
};

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

function initialsOf(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// ─── Installment Progress Bar ────────────────────────────────────────────────

function InstallmentProgress({
  paid,
  total,
}: {
  paid: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-page">
        <div
          className={cn('h-full rounded-full transition-[width]', pct === 100 ? 'bg-emerald-500' : 'bg-navy')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="nums w-8 shrink-0 text-end font-mono text-[11px] text-ink-muted">{pct}%</span>
    </div>
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

// ─── Status / Type Badges ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: LoanStatus | undefined }) {
  const { t } = useTranslation();
  if (!status) return null;
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', STATUS_CLASSES[status])}>
      {t(`loans.status.${status}`)}
    </span>
  );
}

function TypeBadge({ type }: { type: LoanType }) {
  const { t } = useTranslation();
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', TYPE_CLASSES[type])}>
      {t(`loans.form.typeOptions.${type}`)}
    </span>
  );
}

// ─── Row Actions ──────────────────────────────────────────────────────────────

function RowActions({
  onEdit,
  onDelete,
  onApprove,
}: {
  onEdit: () => void;
  onDelete: () => void;
  onApprove?: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      {onApprove ? (
        <Button
          variant="ghost"
          className="h-7 w-7 px-0 hover:!text-emerald-600"
          aria-label={t('loans.approveAction')}
          onClick={onApprove}
        >
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      ) : null}
      <Button variant="ghost" className="h-7 w-7 px-0" aria-label={t('loans.editAction')} onClick={onEdit}>
        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        className="h-7 w-7 px-0 hover:!text-coral"
        aria-label={t('loans.deleteAction')}
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      </Button>
    </div>
  );
}

// ─── Filter Chips ─────────────────────────────────────────────────────────────

const FILTER_OPTIONS: Array<{ key: string; value: LoanStatus | 'all' }> = [
  { key: 'all',       value: 'all'       },
  { key: 'pending',   value: 'pending'   },
  { key: 'active',    value: 'active'    },
  { key: 'completed', value: 'completed' },
  { key: 'cancelled', value: 'cancelled' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function LoansPage() {
  const { t } = useTranslation();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LoanStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LoanWire | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<LoanWire | undefined>(undefined);
  const [approveTarget, setApproveTarget] = useState<LoanWire | undefined>(undefined);

  const canApprove = useCan('loan', 'approve');

  // Debounce the free-text search so every keystroke doesn't fire a request.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // A new search/filter invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const params = useMemo<LoanListParams>(
    () => ({
      page,
      perPage: PER_PAGE,
      search: search || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    [page, search, statusFilter],
  );

  const { state, refetch } = useLoanList(params);

  // Cheap stat queries — each reads only `meta.total`, never fabricates numbers.
  const { state: totalState }     = useLoanList({ page: 1, perPage: 1 });
  const { state: activeState }    = useLoanList({ page: 1, perPage: 1, status: 'active' });
  const { state: pendingState }   = useLoanList({ page: 1, perPage: 1, status: 'pending' });

  const deleteMutation = useDeleteLoan(params);
  const approveMutation = useApproveLoan();

  const records = state.data?.data ?? [];
  const meta    = state.data?.meta;

  function openAddForm() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function openEditForm(loan: LoanWire) {
    setEditTarget(loan);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await deleteMutation.mutate(deleteTarget.id);
    if (result !== undefined || deleteMutation.error === undefined) setDeleteTarget(undefined);
  }

  async function confirmApprove() {
    if (!approveTarget) return;
    const result = await approveMutation.mutate(approveTarget.id);
    if (result !== undefined) {
      toast.success('loans.approveSuccess');
      setApproveTarget(undefined);
    } else {
      toast.error(userFacingMessage(approveMutation.error) || 'loans.approveFailed');
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t('loans.title')}
        actions={
          <Button variant="primary" onClick={openAddForm}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            {t('loans.addLoan')}
          </Button>
        }
      />

      {/* Stat strip — honest count-based cards backed by real queries */}
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t('loans.stat.totalLoans')}   value={totalState.data?.meta.total}   />
        <StatCard label={t('loans.stat.activeLoans')}  value={activeState.data?.meta.total}  accent />
        <StatCard label={t('loans.stat.pendingLoans')} value={pendingState.data?.meta.total} />
      </div>

      {/* Toolbar: search + filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <label className="relative flex items-center">
          <span className="pointer-events-none absolute start-3 text-ink-faint">
            <Search className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <input
            type="search"
            placeholder={t('loans.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={cn(
              'h-9 rounded-full border border-hairline bg-surface ps-8 pe-4 text-[13px] text-ink placeholder:text-ink-faint',
              'focus:outline-none focus:ring-1 focus:ring-navy/40',
              'w-52',
            )}
          />
        </label>

        {/* Status filter chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors',
                statusFilter === opt.value
                  ? 'border-navy bg-navy text-on-navy'
                  : 'border-hairline bg-surface text-ink-muted hover:border-navy/40 hover:text-ink',
              )}
            >
              {opt.value === 'all' ? t('loans.filter.all') : t(`loans.status.${opt.value}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Showing count */}
      {meta ? (
        <p className="mb-2 text-body-sm text-ink-muted">
          {t('loans.showing', { count: meta.total })}
        </p>
      ) : null}

      {/* Load failure */}
      {state.error ? (
        <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>{userFacingMessage(state.error) || t('loans.loadFailed')}</span>
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {/* Initial load */}
      {state.status === 'pending' && records.length === 0 ? (
        <SkeletonTable />
      ) : null}

      {/* Empty state */}
      {state.status !== 'pending' && records.length === 0 && (
        <Card className="px-5 py-10 text-center text-body-sm text-ink-muted">{t('loans.emptySearch')}</Card>
      )}

      {records.length > 0 && (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden lg:block">
            {/* Header */}
            <div className="border-b border-divider px-5 py-3">
              <div className="grid grid-cols-[minmax(180px,2fr)_80px_110px_110px_minmax(120px,1.5fr)_100px_100px_auto] gap-4">
                {(['employee', 'type', 'amount', 'installment', 'progress', 'remaining', 'status'] as const).map((col) => (
                  <span key={col} className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                    {t(`loans.table.${col}`)}
                  </span>
                ))}
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('loans.table.actions')}
                </span>
              </div>
            </div>

            {records.map((loan, idx) => (
              <div
                key={loan.id}
                className={cn(
                  'grid grid-cols-[minmax(180px,2fr)_80px_110px_110px_minmax(120px,1.5fr)_100px_100px_auto] items-center gap-4 px-5 py-3',
                  idx < records.length - 1 && 'border-b border-divider',
                  'transition-colors hover:bg-surface/60',
                )}
              >
                {/* Employee */}
                <div className="flex min-w-0 items-center gap-2.5">
                  {loan.employee ? (
                    <Avatar
                      initials={initialsOf(loan.employee.first_name, loan.employee.last_name)}
                      photo={loan.employee.photo}
                      size={32}
                    />
                  ) : (
                    <Avatar initials="??" size={32} />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-ink">
                      {loan.employee
                        ? `${loan.employee.first_name} ${loan.employee.last_name}`
                        : `#${loan.employee_id}`}
                    </p>
                    <p className="truncate text-caption text-ink-muted">
                      {loan.employee?.employee_number ?? ''} · {formatDate(loan.start_date)}
                    </p>
                  </div>
                </div>

                {/* Type */}
                <TypeBadge type={loan.type} />

                {/* Amount */}
                <span className="nums font-mono text-body-sm font-semibold text-ink">
                  {loan.amount.toLocaleString()}
                </span>

                {/* Installment */}
                <span className="nums font-mono text-body-sm text-ink-muted">
                  {loan.installment_amount.toLocaleString()} {t('loans.perMonth')}
                </span>

                {/* Progress */}
                <div className="flex flex-col gap-1 pe-4">
                  <InstallmentProgress
                    paid={loan.paid_installments ?? 0}
                    total={loan.total_installments}
                  />
                  <span className="nums font-mono text-[10px] text-ink-faint">
                    {t('loans.installments', {
                      paid: loan.paid_installments ?? 0,
                      total: loan.total_installments,
                    })}
                  </span>
                </div>

                {/* Remaining */}
                <span
                  className={cn(
                    'nums font-mono text-body-sm',
                    loan.remaining_amount > 0 ? 'font-semibold text-navy' : 'text-ink-faint',
                  )}
                >
                  {loan.remaining_amount > 0 ? loan.remaining_amount.toLocaleString() : '—'}
                </span>

                {/* Status */}
                <StatusBadge status={loan.status} />

                {/* Actions */}
                <RowActions
                  onEdit={() => openEditForm(loan)}
                  onDelete={() => setDeleteTarget(loan)}
                  onApprove={canApprove && loan.status === 'pending' ? () => setApproveTarget(loan) : undefined}
                />
              </div>
            ))}
          </Card>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 lg:hidden">
            {records.map((loan) => (
              <Card key={loan.id} className="flex flex-col gap-3 p-4">
                {/* Identity + status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {loan.employee ? (
                      <Avatar
                        initials={initialsOf(loan.employee.first_name, loan.employee.last_name)}
                        photo={loan.employee.photo}
                        size={36}
                      />
                    ) : (
                      <Avatar initials="??" size={36} />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-body-sm font-semibold text-ink">
                        {loan.employee
                          ? `${loan.employee.first_name} ${loan.employee.last_name}`
                          : `#${loan.employee_id}`}
                      </p>
                      <p className="truncate text-caption text-ink-muted">
                        {loan.employee?.employee_number ?? ''} · {formatDate(loan.start_date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusBadge status={loan.status} />
                    <RowActions
                      onEdit={() => openEditForm(loan)}
                      onDelete={() => setDeleteTarget(loan)}
                      onApprove={canApprove && loan.status === 'pending' ? () => setApproveTarget(loan) : undefined}
                    />
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3 border-t border-divider pt-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('loans.table.type')}</span>
                    <TypeBadge type={loan.type} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('loans.table.amount')}</span>
                    <span className="nums font-mono text-[12px] font-semibold text-ink">
                      {loan.amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('loans.table.installment')}</span>
                    <span className="nums font-mono text-[12px] text-ink">
                      {loan.installment_amount.toLocaleString()} {t('loans.perMonth')}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('loans.table.remaining')}</span>
                    <span
                      className={cn(
                        'nums font-mono text-[12px]',
                        loan.remaining_amount > 0 ? 'font-semibold text-navy' : 'text-ink-faint',
                      )}
                    >
                      {loan.remaining_amount > 0 ? loan.remaining_amount.toLocaleString() : '—'}
                    </span>
                  </div>

                  {/* Progress bar — full width */}
                  <div className="col-span-2 flex flex-col gap-1">
                    <span className="text-caption text-ink-faint">{t('loans.table.progress')}</span>
                    <InstallmentProgress
                      paid={loan.paid_installments ?? 0}
                      total={loan.total_installments}
                    />
                    <span className="nums font-mono text-[10px] text-ink-faint">
                      {t('loans.installments', {
                        paid: loan.paid_installments ?? 0,
                        total: loan.total_installments,
                      })}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {meta ? (
            <Pagination
              currentPage={meta.current_page}
              lastPage={meta.last_page}
              total={meta.total}
              perPage={meta.per_page}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}

      <LoanFormDialog open={formOpen} onOpenChange={setFormOpen} loan={editTarget} />

      <ConfirmDialog
        open={deleteTarget !== undefined}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t('loans.deleteConfirm.title')}
        description={
          deleteTarget
            ? t('loans.deleteConfirm.description', {
                name: deleteTarget.employee
                  ? `${deleteTarget.employee.first_name} ${deleteTarget.employee.last_name}`
                  : `#${deleteTarget.employee_id}`,
              })
            : undefined
        }
        isLoading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
      />

      <ConfirmDialog
        open={approveTarget !== undefined}
        onOpenChange={(open) => !open && setApproveTarget(undefined)}
        title={t('loans.approveConfirm.title')}
        description={
          approveTarget
            ? t('loans.approveConfirm.description', {
                name: approveTarget.employee
                  ? `${approveTarget.employee.first_name} ${approveTarget.employee.last_name}`
                  : `#${approveTarget.employee_id}`,
              })
            : undefined
        }
        isLoading={approveMutation.isPending}
        onConfirm={() => void confirmApprove()}
      />
    </div>
  );
}
