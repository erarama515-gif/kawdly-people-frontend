import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CheckSquare, Download, Pencil, Plus, Search, Square, Trash2 } from 'lucide-react';
import { ExportButton } from '@/components/ui/ExportButton';
import type { ExportColumn } from '@/components/ui/ExportButton';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { SkeletonTable } from '@/components/ui/SkeletonTable';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { BulkActionBar } from '@/components/ui/BulkActionBar';
import { Pagination } from '@/components/ui/Pagination';
import { useSort } from '@/hooks/useSort';
import { useBulkSelect } from '@/hooks/useBulkSelect';
import { userFacingMessage } from '@/lib/api/errors';
import { exportToExcel } from '@/lib/export';
import { useLocalizeEntity } from '@/lib/localizeEntity';
import { useDeleteEmployee, useEmployeeList } from '../api/queries';
import { useCan } from '@/hooks/useCan';
import type { EmployeeListParams } from '../api/resource';
import type { EmployeeStatus } from '../api/resource';
import type { EmployeeWire } from '../api/schema';
import { EmployeeFormDialog } from './EmployeeFormDialog';

/**
 * The Employees module's reference implementation: a live-data table backed
 * by `useEmployeeList`, Add/Edit via `EmployeeFormDialog`, delete via a
 * `ConfirmDialog` + optimistic `useDeleteEmployee`, and page controls via the
 * shared `Pagination`. Every other feature page's interactive pass should
 * read like this file.
 */

const PER_PAGE = 10;

const STATUS_CLASSES: Record<EmployeeStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  on_leave: 'bg-sky-50 text-sky-700',
  suspended: 'bg-amber-50 text-amber-700',
  terminated: 'bg-red-50 text-red-700',
  resigned: 'bg-slate-100 text-slate-600',
};

function initialsOf(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatJoined(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: EmployeeStatus }) {
  const { t } = useTranslation();
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', STATUS_CLASSES[status])}>
      {t(`employees.status.${status}`)}
    </span>
  );
}

// ─── Row actions ──────────────────────────────────────────────────────────────

function RowActions({
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: {
  onEdit: () => void;
  onDelete: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const { t } = useTranslation();
  if (!canEdit && !canDelete) return null;
  return (
    <div className="flex items-center gap-1">
      {canEdit && (
        <Button variant="ghost" className="h-7 w-7 px-0" aria-label={t('employees.editAction')} onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      )}
      {canDelete && (
        <Button
          variant="ghost"
          className="h-7 w-7 px-0 hover:!text-coral"
          aria-label={t('employees.deleteAction')}
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

// ─── Filter Chips ─────────────────────────────────────────────────────────────

const FILTER_OPTIONS: Array<{ key: string; value: EmployeeStatus | 'all' }> = [
  { key: 'all', value: 'all' },
  { key: 'active', value: 'active' },
  { key: 'onLeave', value: 'on_leave' },
  { key: 'suspended', value: 'suspended' },
  { key: 'terminated', value: 'terminated' },
  { key: 'resigned', value: 'resigned' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function EmployeesPage() {
  const { t } = useTranslation();
  const localize = useLocalizeEntity();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeWire | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeWire | undefined>(undefined);
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

  // Server-side sorting (A5.1)
  type EmpSortCol = 'employee' | 'id' | 'department' | 'position' | 'status' | 'joined';
  const { sort, toggle: toggleSort } = useSort<EmpSortCol>();

  const serverSortField = useMemo(() => {
    if (!sort.column) return undefined;
    switch (sort.column) {
      case 'employee': return 'first_name';
      case 'id': return 'employee_number';
      case 'joined': return 'joining_date';
      case 'status': return 'status';
      default: return undefined;
    }
  }, [sort.column]);

  const params = useMemo<EmployeeListParams>(
    () => ({
      page,
      perPage: PER_PAGE,
      search: search || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      sort: serverSortField,
      direction: sort.column ? sort.direction : undefined,
    }),
    [page, search, statusFilter, serverSortField, sort.direction, sort.column],
  );

  const { state, refetch } = useEmployeeList(params);
  const { state: totalState } = useEmployeeList({ page: 1, perPage: 1 });
  const { state: activeState } = useEmployeeList({ page: 1, perPage: 1, status: 'active' });
  const { state: onLeaveState } = useEmployeeList({ page: 1, perPage: 1, status: 'on_leave' });

  const deleteMutation = useDeleteEmployee(params);
  const canCreate = useCan('employee', 'create');
  const canEdit = useCan('employee', 'edit');
  const canDelete = useCan('employee', 'delete');

  const rawEmployees = state.data?.data ?? [];
  const employees = rawEmployees;
  const meta = state.data?.meta;

  /**
   * Which empty state to show. "No employees match your search" was rendered
   * unconditionally, so a fresh install — the common case since T6.5 made the
   * first launch land on an empty database — blamed a search the user had never
   * run.
   *
   * `totalState` is the unfiltered head count already fetched for the stat
   * strip, so the real distinction costs no extra request: when the company has
   * no employees at all, saying "none match" would be wrong even if a filter
   * happens to be active.
   */
  const hasQuery = search !== '' || statusFilter !== 'all';
  const isUnfiltered = !hasQuery || totalState.data?.meta.total === 0;

  // ── Bulk selection ──────────────────────────────────────────────────────────
  const bulk = useBulkSelect(employees);

  const exportColumns: ExportColumn[] = [
    { key: 'name', label: t('employees.table.employee') },
    { key: 'employee_number', label: t('employees.table.id') },
    { key: 'department', label: t('employees.table.department') },
    { key: 'position', label: t('employees.table.position') },
    { key: 'status', label: t('employees.table.status') },
    { key: 'joining_date', label: t('employees.table.joined') },
  ];

  const exportData = employees.map((emp) => ({
    name: `${emp.first_name} ${emp.last_name}`,
    employee_number: emp.employee_number,
    department: localize(emp.department?.name) || '',
    position: localize(emp.job_position?.title) || '',
    status: t(`employees.status.${emp.status}`),
    joining_date: formatJoined(emp.joining_date),
  }));

  function openAddForm() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function openEditForm(employee: EmployeeWire) {
    setEditTarget(employee);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await deleteMutation.mutate(deleteTarget.id);
    if (result !== undefined || deleteMutation.error === undefined) setDeleteTarget(undefined);
  }

  function handleBulkExport() {
    const selectedRows = exportData.filter((_, idx) => bulk.isSelected(employees[idx]!.id));
    exportToExcel(selectedRows as Record<string, unknown>[], exportColumns, 'employees-selected');
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
        title={t('employees.title')}
        actions={
          <div className="flex items-center gap-2">
            <ExportButton data={exportData} columns={exportColumns} filename="employees" />
            {canCreate && (
              <Button variant="primary" onClick={openAddForm}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                {t('employees.addEmployee')}
              </Button>
            )}
          </div>
        }
      />

      {/* Stat strip */}
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t('employees.stat.totalEmployees')} value={totalState.data?.meta.total} />
        <StatCard label={t('employees.stat.active')} value={activeState.data?.meta.total} accent />
        <StatCard label={t('employees.stat.onLeave')} value={onLeaveState.data?.meta.total} />
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
            placeholder={t('employees.searchPlaceholder')}
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
              {t(`employees.filter.${opt.key}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Load failure (keeps any stale rows visible alongside the error, per QueryState's contract) */}
      {state.error ? (
        <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>{state.error ? userFacingMessage(state.error) || t('employees.loadFailed') : t('employees.loadFailed')}</span>
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {/* Initial load */}
      {state.status === 'pending' && employees.length === 0 ? (
        <SkeletonTable />
      ) : null}

      {/* Empty state (shared across both layouts) */}
      {state.status !== 'pending' && employees.length === 0 && (
        <Card className="flex flex-col items-center gap-3 px-5 py-10 text-center">
          <span className="text-body-sm text-ink-muted" data-testid="employees-empty">
            {isUnfiltered ? t('employees.emptyNoEmployees') : t('employees.emptySearch')}
          </span>
          {isUnfiltered ? (
            <>
              <span className="text-caption text-ink-faint">{t('employees.emptyNoEmployeesHint')}</span>
              {canCreate && (
                <Button variant="primary" onClick={openAddForm}>
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                  {t('employees.emptyAddFirst')}
                </Button>
              )}
            </>
          ) : null}
        </Card>
      )}

      {employees.length > 0 && (
        <>
          {/* Employees table — desktop/tablet-landscape */}
          <Card className="hidden lg:block">
            {/* Header */}
            <div className="border-b border-divider px-5 py-3">
              <div className="grid grid-cols-[auto_2.5fr_1fr_1.5fr_1.5fr_1fr_1fr_auto] gap-4">
                {/* Select-all checkbox */}
                <button
                  type="button"
                  aria-label={bulk.isAllSelected ? t('common.deselectAll') : t('common.selected', { count: employees.length })}
                  onClick={() => (bulk.isAllSelected ? bulk.deselectAll() : bulk.selectAll())}
                  className="flex items-center text-ink-faint hover:text-navy transition-colors"
                >
                  {bulk.isAllSelected ? (
                    <CheckSquare className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <Square className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  )}
                </button>
                {(['employee', 'id', 'department', 'position', 'status', 'joined'] as const).map((col) => (
                  <SortableHeader key={col} column={col} label={t(`employees.table.${col}`)} sort={sort} onSort={toggleSort} />
                ))}
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('employees.table.actions')}
                </span>
              </div>
            </div>

            {employees.map((emp, idx) => (
              <div
                key={emp.id}
                className={cn(
                  'grid grid-cols-[auto_2.5fr_1fr_1.5fr_1.5fr_1fr_1fr_auto] items-center gap-4 px-5 py-3',
                  idx < employees.length - 1 && 'border-b border-divider',
                  'hover:bg-surface/60 transition-colors',
                  bulk.isSelected(emp.id) && 'bg-navy/5',
                )}
              >
                {/* Row checkbox */}
                <button
                  type="button"
                  aria-label={bulk.isSelected(emp.id) ? t('common.deselectAll') : t('common.selected', { count: 1 })}
                  onClick={() => bulk.toggle(emp.id)}
                  className="flex items-center text-ink-faint hover:text-navy transition-colors"
                >
                  {bulk.isSelected(emp.id) ? (
                    <CheckSquare className="h-4 w-4 text-navy" strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <Square className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  )}
                </button>

                {/* Employee name + email — clicking the name navigates to the profile */}
                <Link
                  to={`/people/employees/${emp.id}`}
                  className="flex min-w-0 items-center gap-3 group"
                >
                  <Avatar initials={initialsOf(emp.first_name, emp.last_name)} photo={emp.photo} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-ink group-hover:text-navy transition-colors">
                      {emp.first_name} {emp.last_name}
                    </p>
                    <p className="truncate text-caption text-ink-muted">{emp.email ?? '—'}</p>
                  </div>
                </Link>

                {/* Employee number */}
                <span className="nums font-mono text-[12px] text-ink-muted">{emp.employee_number}</span>

                {/* Department */}
                <span className="truncate text-body-sm text-ink">{localize(emp.department?.name) || '—'}</span>

                {/* Position */}
                <span className="truncate text-body-sm text-ink-muted">{localize(emp.job_position?.title) || '—'}</span>

                {/* Status */}
                <StatusBadge status={emp.status} />

                {/* Joining date */}
                <span className="nums font-mono text-[12px] text-ink-muted">{formatJoined(emp.joining_date)}</span>

                {/* Actions */}
                <RowActions
                  onEdit={() => openEditForm(emp)}
                  onDelete={() => setDeleteTarget(emp)}
                  canEdit={canEdit}
                  canDelete={canDelete}
                />
              </div>
            ))}
          </Card>

          {/* Employee cards — mobile/tablet-portrait */}
          <div className="flex flex-col gap-3 lg:hidden">
            {employees.map((emp) => (
              <Card
                key={emp.id}
                className={cn('flex flex-col gap-3 p-4', bulk.isSelected(emp.id) && 'ring-1 ring-navy/30')}
              >
                {/* Identity + status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {/* Checkbox */}
                    <button
                      type="button"
                      aria-label={bulk.isSelected(emp.id) ? t('common.deselectAll') : t('common.selected', { count: 1 })}
                      onClick={() => bulk.toggle(emp.id)}
                      className="shrink-0 text-ink-faint hover:text-navy transition-colors"
                    >
                      {bulk.isSelected(emp.id) ? (
                        <CheckSquare className="h-4 w-4 text-navy" strokeWidth={1.75} aria-hidden="true" />
                      ) : (
                        <Square className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                      )}
                    </button>
                    <Link
                      to={`/people/employees/${emp.id}`}
                      className="flex min-w-0 items-center gap-3 group"
                    >
                      <Avatar initials={initialsOf(emp.first_name, emp.last_name)} photo={emp.photo} size={32} />
                      <div className="min-w-0">
                        <p className="truncate text-body-sm font-semibold text-ink group-hover:text-navy transition-colors">
                          {emp.first_name} {emp.last_name}
                        </p>
                        <p className="truncate text-caption text-ink-muted">{emp.email ?? '—'}</p>
                      </div>
                    </Link>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusBadge status={emp.status} />
                    <RowActions
                      onEdit={() => openEditForm(emp)}
                      onDelete={() => setDeleteTarget(emp)}
                      canEdit={canEdit}
                      canDelete={canDelete}
                    />
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3 border-t border-divider pt-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('employees.table.id')}</span>
                    <span className="nums font-mono text-[12px] text-ink">{emp.employee_number}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('employees.table.department')}</span>
                    <span className="truncate text-body-sm text-ink">{localize(emp.department?.name) || '—'}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('employees.table.position')}</span>
                    <span className="truncate text-body-sm text-ink">{localize(emp.job_position?.title) || '—'}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('employees.table.joined')}</span>
                    <span className="nums font-mono text-[12px] text-ink">{formatJoined(emp.joining_date)}</span>
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

      <EmployeeFormDialog open={formOpen} onOpenChange={setFormOpen} employee={editTarget} />

      {/* Single-row delete dialog */}
      <ConfirmDialog
        open={deleteTarget !== undefined}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t('employees.deleteConfirm.title')}
        description={
          deleteTarget ? t('employees.deleteConfirm.description', { name: `${deleteTarget.first_name} ${deleteTarget.last_name}` }) : undefined
        }
        isLoading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
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
