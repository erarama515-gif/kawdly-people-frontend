import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, CheckSquare, Download, Pencil, Plus, Search, Square, Trash2 } from 'lucide-react';
import { ExportButton } from '@/components/ui/ExportButton';
import type { ExportColumn } from '@/components/ui/ExportButton';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { SkeletonTable } from '@/components/ui/SkeletonTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { BulkActionBar } from '@/components/ui/BulkActionBar';
import { Pagination } from '@/components/ui/Pagination';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { useSort, sortData } from '@/hooks/useSort';
import { useBulkSelect } from '@/hooks/useBulkSelect';
import { userFacingMessage } from '@/lib/api/errors';
import { exportToExcel } from '@/lib/export';
import { formatAmount } from '@/lib/salary';
import { useHasPermission } from '@/auth/session';
import { toast } from '@/components/ui/Toast';
import { useContractList, useDeleteContract, useTerminateContract } from '../api/queries';
import type { ContractListParams, ContractStatus } from '../api/resource';
import type { ContractWire } from '../api/schema';
import { ContractFormDialog } from './ContractFormDialog';

/**
 * The Contracts module's live-data page, built in the same pattern as
 * `EmployeesPage`: `useContractList`, Add/Edit via `ContractFormDialog`,
 * delete via `ConfirmDialog` + optimistic `useDeleteContract`, and page
 * controls via the shared `Pagination`.
 */

const PER_PAGE = 10;

const STATUS_CLASSES: Record<ContractStatus, string> = {
  draft: 'bg-surface text-ink-muted border border-divider',
  active: 'bg-emerald-50 text-emerald-700',
  expired: 'bg-red-50 text-red-700',
  terminated: 'bg-surface text-ink-muted border border-divider',
};

const TYPE_CLASSES: Record<string, string> = {
  initial: 'bg-surface text-ink-muted border border-divider',
  renewal: 'bg-sky-50 text-sky-700',
  amendment: 'bg-violet-50 text-violet-700',
};

function initialsOf(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent, warning }: { label: string; value: number | undefined; accent?: boolean; warning?: boolean }) {
  return (
    <Card className="flex flex-col gap-1 px-5 pb-4 pt-4">
      <span className="text-caption text-ink-muted">{label}</span>
      <span
        className={cn(
          'nums font-mono text-[32px] font-bold leading-[1.1] tracking-[-0.04em]',
          accent ? 'text-coral' : warning ? 'text-orange-600' : 'text-navy',
        )}
      >
        {value !== undefined ? value.toLocaleString() : '—'}
      </span>
    </Card>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ContractStatus }) {
  const { t } = useTranslation();
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', STATUS_CLASSES[status])}>
      {t(`contracts.status.${status}`)}
    </span>
  );
}

// ─── Row actions ──────────────────────────────────────────────────────────────

interface RowActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  onTerminate?: (() => void) | undefined;
  canEdit?: boolean;
  canDelete?: boolean;
}

function RowActions({
  onEdit,
  onDelete,
  onTerminate,
  canEdit = true,
  canDelete = true,
}: RowActionsProps) {
  const { t } = useTranslation();
  if (!canEdit && !canDelete && !onTerminate) return null;
  return (
    <div className="flex items-center gap-1">
      {onTerminate ? (
        <Button
          variant="ghost"
          className="h-7 w-7 px-0 hover:!text-amber-600"
          aria-label={t('contracts.terminateAction')}
          onClick={onTerminate}
        >
          <Ban className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      ) : null}
      {canEdit && (
        <Button variant="ghost" className="h-7 w-7 px-0" aria-label={t('contracts.editAction')} onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      )}
      {canDelete && (
        <Button
          variant="ghost"
          className="h-7 w-7 px-0 hover:!text-coral"
          aria-label={t('contracts.deleteAction')}
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

// ─── Filter Chips ─────────────────────────────────────────────────────────────

const FILTER_OPTIONS: Array<{ key: string; value: ContractStatus | 'all' }> = [
  { key: 'all', value: 'all' },
  { key: 'active', value: 'active' },
  { key: 'expired', value: 'expired' },
  { key: 'draft', value: 'draft' },
  { key: 'terminated', value: 'terminated' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ContractsPage() {
  const { t } = useTranslation();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ContractWire | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<ContractWire | undefined>(undefined);
  const [terminateTarget, setTerminateTarget] = useState<ContractWire | undefined>(undefined);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Debounce the free-text search so every keystroke doesn't fire a request.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // A new search/filter invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const params = useMemo<ContractListParams>(
    () => ({
      page,
      perPage: PER_PAGE,
      search: search || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    [page, search, statusFilter],
  );

  const { state, refetch } = useContractList(params);
  // Stat cards — each is a cheap perPage:1 call reading only meta.total.
  const { state: totalState } = useContractList({ page: 1, perPage: 1 });
  const { state: activeState } = useContractList({ page: 1, perPage: 1, status: 'active' });
  const { state: expiredState } = useContractList({ page: 1, perPage: 1, status: 'expired' });
  const { state: draftState } = useContractList({ page: 1, perPage: 1, status: 'draft' });

  const deleteMutation = useDeleteContract(params);
  const terminateMutation = useTerminateContract();
  const canTerminate = useHasPermission('contract.contract.edit');
  const canCreate = useHasPermission('contract.contract.create');
  const canEdit = useHasPermission('contract.contract.edit');
  const canDelete = useHasPermission('contract.contract.delete');

  // Client-side sorting
  type ContractSortCol = 'employee' | 'type' | 'startDate' | 'endDate' | 'salary' | 'status';
  const { sort, toggle: toggleSort } = useSort<ContractSortCol>();
  const SORT_ACCESSORS: Record<ContractSortCol, (c: ContractWire) => string | number | undefined> = {
    employee: (c) => `${c.employee?.first_name ?? ''} ${c.employee?.last_name ?? ''}`,
    type:      (c) => c.type,
    startDate: (c) => c.start_date,
    endDate:   (c) => c.end_date ?? '',
    salary:    (c) => c.basic_salary,
    status:    (c) => c.status,
  };
  const rawContracts = state.data?.data ?? [];
  const contracts = sortData(rawContracts, sort, SORT_ACCESSORS);
  const meta = state.data?.meta;

  // ── Bulk selection ──────────────────────────────────────────────────────────
  const bulk = useBulkSelect(contracts);

  const exportColumns: ExportColumn[] = [
    { key: 'employee', label: t('contracts.table.employee') },
    { key: 'type', label: t('contracts.table.type') },
    { key: 'startDate', label: t('contracts.table.startDate') },
    { key: 'endDate', label: t('contracts.table.endDate') },
    { key: 'salary', label: t('contracts.table.salary') },
    { key: 'status', label: t('contracts.table.status') },
  ];

  const exportData = contracts.map((c) => ({
    employee: `${c.employee?.first_name ?? ''} ${c.employee?.last_name ?? ''}`.trim() || `#${c.id}`,
    type: t(`contracts.type.${c.type}`),
    startDate: formatDate(c.start_date),
    endDate: c.end_date ? formatDate(c.end_date) : '',
    salary: formatAmount(c.basic_salary),
    status: t(`contracts.status.${c.status}`),
  }));

  function openAddForm() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function openEditForm(contract: ContractWire) {
    setEditTarget(contract);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await deleteMutation.mutate(deleteTarget.id);
    if (result !== undefined || deleteMutation.error === undefined) setDeleteTarget(undefined);
  }

  async function confirmTerminate() {
    if (!terminateTarget) return;
    const result = await terminateMutation.mutate({ id: terminateTarget.id });
    if (result !== undefined) {
      toast.success('contracts.terminateSuccess');
      setTerminateTarget(undefined);
    } else {
      toast.error(userFacingMessage(terminateMutation.error) || 'contracts.terminateFailed');
    }
  }

  function handleBulkExport() {
    const selectedRows = exportData.filter((_, idx) => bulk.isSelected(contracts[idx]!.id));
    exportToExcel(selectedRows as Record<string, unknown>[], exportColumns, 'contracts-selected');
  }

  async function handleBulkDelete() {
    setIsBulkDeleting(true);
    const ids = Array.from(bulk.selectedIds);
    for (const id of ids) {
      await deleteMutation.mutate(id);
    }
    bulk.deselectAll();
    setIsBulkDeleting(false);
    setBulkDeleteOpen(false);
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t('contracts.title')}
        actions={
          <div className="flex items-center gap-2">
            <ExportButton data={exportData} columns={exportColumns} filename="contracts" />
            {canCreate && (
              <Button variant="primary" onClick={openAddForm}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                {t('contracts.addContract')}
              </Button>
            )}
          </div>
        }
      />

      {/* Stat strip */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t('contracts.stat.total')} value={totalState.data?.meta.total} />
        <StatCard label={t('contracts.stat.active')} value={activeState.data?.meta.total} accent />
        <StatCard label={t('contracts.stat.expired')} value={expiredState.data?.meta.total} warning />
        <StatCard label={t('contracts.stat.draft')} value={draftState.data?.meta.total} />
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
            placeholder={t('contracts.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={cn(
              'h-9 rounded-full border border-hairline bg-surface ps-8 pe-4 text-[13px] text-ink placeholder:text-ink-faint',
              'focus:outline-none focus:ring-1 focus:ring-navy/40',
              'w-52',
            )}
          />
        </label>

        {/* Status filters */}
        <div className="flex items-center gap-1.5">
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
              {t(`contracts.filter.${opt.key}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Load failure */}
      {state.error ? (
        <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>{state.error ? userFacingMessage(state.error) || t('contracts.loadFailed') : t('contracts.loadFailed')}</span>
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {/* Initial load */}
      {state.status === 'pending' && contracts.length === 0 ? (
        <SkeletonTable />
      ) : null}

      {/* Empty state */}
      {state.status !== 'pending' && contracts.length === 0 && (
        <Card className="px-5 py-10 text-center text-body-sm text-ink-muted">{t('contracts.emptySearch')}</Card>
      )}

      {contracts.length > 0 && (
        <>
          {/* Contracts table — desktop/tablet-landscape */}
          <Card className="hidden lg:block">
            {/* Header */}
            <div className="border-b border-divider px-5 py-3">
              <div className="grid grid-cols-[auto_2.5fr_1fr_1fr_1fr_1.5fr_1fr_auto] gap-4">
                {/* Select-all checkbox */}
                <button
                  type="button"
                  aria-label={bulk.isAllSelected ? t('common.deselectAll') : t('common.selected', { count: contracts.length })}
                  onClick={() => (bulk.isAllSelected ? bulk.deselectAll() : bulk.selectAll())}
                  className="flex items-center text-ink-faint hover:text-navy transition-colors"
                >
                  {bulk.isAllSelected ? (
                    <CheckSquare className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <Square className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  )}
                </button>
                {(['employee', 'type', 'startDate', 'endDate', 'salary', 'status'] as const).map((col) => (
                  <SortableHeader key={col} column={col} label={t(`contracts.table.${col}`)} sort={sort} onSort={toggleSort} />
                ))}
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('contracts.table.actions')}
                </span>
              </div>
            </div>

            {contracts.map((contract, idx) => {
              const emp = contract.employee;
              const firstName = emp?.first_name ?? '';
              const lastName = emp?.last_name ?? '';
              const initials = initialsOf(firstName, lastName);

              return (
                <div
                  key={contract.id}
                  className={cn(
                    'grid grid-cols-[auto_2.5fr_1fr_1fr_1fr_1.5fr_1fr_auto] items-center gap-4 px-5 py-3',
                    idx < contracts.length - 1 && 'border-b border-divider',
                    'hover:bg-surface/60 transition-colors',
                    bulk.isSelected(contract.id) && 'bg-navy/5',
                  )}
                >
                  {/* Row checkbox */}
                  <button
                    type="button"
                    aria-label={bulk.isSelected(contract.id) ? t('common.deselectAll') : t('common.selected', { count: 1 })}
                    onClick={() => bulk.toggle(contract.id)}
                    className="flex items-center text-ink-faint hover:text-navy transition-colors"
                  >
                    {bulk.isSelected(contract.id) ? (
                      <CheckSquare className="h-4 w-4 text-navy" strokeWidth={1.75} aria-hidden="true" />
                    ) : (
                      <Square className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    )}
                  </button>

                  {/* Employee */}
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar initials={initials} photo={emp?.photo} size={32} />
                    <div className="min-w-0">
                      <p className="truncate text-body-sm font-semibold text-ink">
                        {firstName} {lastName}
                      </p>
                      <p className="truncate text-caption text-ink-muted">
                        {emp?.employee_number ?? '—'}
                      </p>
                    </div>
                  </div>

                  {/* Type */}
                  <span
                    className={cn(
                      'self-start rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                      TYPE_CLASSES[contract.type] ?? 'bg-surface text-ink-muted border border-divider',
                    )}
                  >
                    {t(`contracts.type.${contract.type}`)}
                  </span>

                  {/* Start date */}
                  <span className="nums font-mono text-[12px] text-ink-muted">
                    {formatDate(contract.start_date)}
                  </span>

                  {/* End date */}
                  <span className="nums font-mono text-[12px] text-ink-muted">
                    {contract.end_date ? formatDate(contract.end_date) : '—'}
                  </span>

                  {/* Basic salary */}
                  <span className="nums font-mono text-[12px] text-ink-muted">
                    {formatAmount(contract.basic_salary)}
                  </span>

                  {/* Status */}
                  <StatusBadge status={contract.status} />

                  {/* Actions */}
                  <RowActions
                    onEdit={() => openEditForm(contract)}
                    onDelete={() => setDeleteTarget(contract)}
                    onTerminate={
                      canTerminate && contract.status !== 'terminated'
                        ? () => setTerminateTarget(contract)
                        : undefined
                    }
                    canEdit={canEdit}
                    canDelete={canDelete}
                  />
                </div>
              );
            })}
          </Card>

          {/* Contract cards — mobile/tablet-portrait */}
          <div className="flex flex-col gap-3 lg:hidden">
            {contracts.map((contract) => {
              const emp = contract.employee;
              const firstName = emp?.first_name ?? '';
              const lastName = emp?.last_name ?? '';
              const initials = initialsOf(firstName, lastName);

              return (
                <Card
                  key={contract.id}
                  className={cn('flex flex-col gap-3 p-4', bulk.isSelected(contract.id) && 'ring-1 ring-navy/30')}
                >
                  {/* Identity + status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {/* Checkbox */}
                      <button
                        type="button"
                        aria-label={bulk.isSelected(contract.id) ? t('common.deselectAll') : t('common.selected', { count: 1 })}
                        onClick={() => bulk.toggle(contract.id)}
                        className="shrink-0 text-ink-faint hover:text-navy transition-colors"
                      >
                        {bulk.isSelected(contract.id) ? (
                          <CheckSquare className="h-4 w-4 text-navy" strokeWidth={1.75} aria-hidden="true" />
                        ) : (
                          <Square className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                        )}
                      </button>
                      <Avatar initials={initials} photo={emp?.photo} size={32} />
                      <div className="min-w-0">
                        <p className="truncate text-body-sm font-semibold text-ink">
                          {firstName} {lastName}
                        </p>
                        <p className="truncate text-caption text-ink-muted">
                          {emp?.employee_number ?? '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <StatusBadge status={contract.status} />
                      <RowActions
                        onEdit={() => openEditForm(contract)}
                        onDelete={() => setDeleteTarget(contract)}
                        onTerminate={
                          canTerminate && contract.status !== 'terminated'
                            ? () => setTerminateTarget(contract)
                            : undefined
                        }
                        canEdit={canEdit}
                        canDelete={canDelete}
                      />
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-3 border-t border-divider pt-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-caption text-ink-faint">{t('contracts.table.type')}</span>
                      <span
                        className={cn(
                          'self-start rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                          TYPE_CLASSES[contract.type] ?? 'bg-surface text-ink-muted border border-divider',
                        )}
                      >
                        {t(`contracts.type.${contract.type}`)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-caption text-ink-faint">{t('contracts.table.salary')}</span>
                      <span className="nums font-mono text-[12px] text-ink">
                        {formatAmount(contract.basic_salary)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-caption text-ink-faint">{t('contracts.table.startDate')}</span>
                      <span className="nums font-mono text-[12px] text-ink">
                        {formatDate(contract.start_date)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-caption text-ink-faint">{t('contracts.table.endDate')}</span>
                      <span className="nums font-mono text-[12px] text-ink">
                        {contract.end_date ? formatDate(contract.end_date) : '—'}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
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

      <ContractFormDialog open={formOpen} onOpenChange={setFormOpen} contract={editTarget} />

      {/* Single-row delete dialog */}
      <ConfirmDialog
        open={deleteTarget !== undefined}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t('contracts.deleteConfirm.title')}
        description={
          deleteTarget
            ? t('contracts.deleteConfirm.description', {
                name: `${deleteTarget.employee?.first_name ?? ''} ${deleteTarget.employee?.last_name ?? ''}`.trim() || `#${deleteTarget.id}`,
              })
            : undefined
        }
        isLoading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
      />

      {/* Terminate contract dialog */}
      <ConfirmDialog
        open={terminateTarget !== undefined}
        onOpenChange={(open) => !open && setTerminateTarget(undefined)}
        title={t('contracts.terminateConfirm.title')}
        description={
          terminateTarget
            ? t('contracts.terminateConfirm.description', {
                name: `${terminateTarget.employee?.first_name ?? ''} ${terminateTarget.employee?.last_name ?? ''}`.trim() || `#${terminateTarget.id}`,
              })
            : undefined
        }
        isLoading={terminateMutation.isPending}
        onConfirm={() => void confirmTerminate()}
      />

      {/* Bulk delete confirm dialog */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => !open && setBulkDeleteOpen(false)}
        title={t('common.bulkDeleteConfirm.title')}
        description={t('common.bulkDeleteConfirm.description', { count: bulk.selectedCount })}
        isLoading={isBulkDeleting}
        onConfirm={() => void handleBulkDelete()}
      />

      {/* Bulk action bar */}
      <BulkActionBar
        selectedCount={bulk.selectedCount}
        onDeselectAll={bulk.deselectAll}
        actions={[
          {
            label: t('common.exportSelected'),
            icon: Download,
            onClick: handleBulkExport,
          },
          ...(canDelete
            ? [
                {
                  label: t('common.deleteSelected'),
                  icon: Trash2,
                  onClick: () => setBulkDeleteOpen(true),
                  variant: 'danger' as const,
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
