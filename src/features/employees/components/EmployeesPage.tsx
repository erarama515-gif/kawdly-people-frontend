import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { userFacingMessage } from '@/lib/api/errors';
import { useDeleteEmployee, useEmployeeList } from '../api/queries';
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

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" className="h-7 w-7 px-0" aria-label={t('employees.editAction')} onClick={onEdit}>
        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        className="h-7 w-7 px-0 hover:!text-coral"
        aria-label={t('employees.deleteAction')}
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      </Button>
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

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeWire | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeWire | undefined>(undefined);

  // Debounce the free-text search so every keystroke doesn't fire a request.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // A new search/filter invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const params = useMemo<EmployeeListParams>(
    () => ({
      page,
      perPage: PER_PAGE,
      search: search || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    [page, search, statusFilter],
  );

  const { state, refetch } = useEmployeeList(params);
  const { state: totalState } = useEmployeeList({ page: 1, perPage: 1 });
  const { state: activeState } = useEmployeeList({ page: 1, perPage: 1, status: 'active' });
  const { state: onLeaveState } = useEmployeeList({ page: 1, perPage: 1, status: 'on_leave' });

  const deleteMutation = useDeleteEmployee(params);

  const employees = state.data?.data ?? [];
  const meta = state.data?.meta;

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

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t('employees.title')}
        actions={
          <Button variant="primary" onClick={openAddForm}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            {t('employees.addEmployee')}
          </Button>
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
          <span className="pointer-events-none absolute left-3 text-ink-faint">
            <Search className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <input
            type="search"
            placeholder={t('employees.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={cn(
              'h-9 rounded-full border border-hairline bg-surface pl-8 pr-4 text-[13px] text-ink placeholder:text-ink-faint',
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
        <Card className="px-5 py-10 text-center text-body-sm text-ink-muted">{t('common.loading')}</Card>
      ) : null}

      {/* Empty state (shared across both layouts) */}
      {state.status !== 'pending' && employees.length === 0 && (
        <Card className="px-5 py-10 text-center text-body-sm text-ink-muted">{t('employees.emptySearch')}</Card>
      )}

      {employees.length > 0 && (
        <>
          {/* Employees table — desktop/tablet-landscape */}
          <Card className="hidden lg:block">
            {/* Header */}
            <div className="border-b border-divider px-5 py-3">
              <div className="grid grid-cols-[2.5fr_1fr_1.5fr_1.5fr_1fr_1fr_auto] gap-4">
                {(['employee', 'id', 'department', 'position', 'status', 'joined'] as const).map((col) => (
                  <span key={col} className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                    {t(`employees.table.${col}`)}
                  </span>
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
                  'grid grid-cols-[2.5fr_1fr_1.5fr_1.5fr_1fr_1fr_auto] items-center gap-4 px-5 py-3',
                  idx < employees.length - 1 && 'border-b border-divider',
                  'hover:bg-surface/60 transition-colors',
                )}
              >
                {/* Employee name + email */}
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar initials={initialsOf(emp.first_name, emp.last_name)} photo={emp.photo} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-ink">
                      {emp.first_name} {emp.last_name}
                    </p>
                    <p className="truncate text-caption text-ink-muted">{emp.email ?? '—'}</p>
                  </div>
                </div>

                {/* Employee number */}
                <span className="nums font-mono text-[12px] text-ink-muted">{emp.employee_number}</span>

                {/* Department */}
                <span className="truncate text-body-sm text-ink">{emp.department?.name ?? '—'}</span>

                {/* Position */}
                <span className="truncate text-body-sm text-ink-muted">{emp.jobPosition?.title ?? '—'}</span>

                {/* Status */}
                <StatusBadge status={emp.status} />

                {/* Joining date */}
                <span className="nums font-mono text-[12px] text-ink-muted">{formatJoined(emp.joining_date)}</span>

                {/* Actions */}
                <RowActions onEdit={() => openEditForm(emp)} onDelete={() => setDeleteTarget(emp)} />
              </div>
            ))}
          </Card>

          {/* Employee cards — mobile/tablet-portrait */}
          <div className="flex flex-col gap-3 lg:hidden">
            {employees.map((emp) => (
              <Card key={emp.id} className="flex flex-col gap-3 p-4">
                {/* Identity + status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar initials={initialsOf(emp.first_name, emp.last_name)} photo={emp.photo} size={32} />
                    <div className="min-w-0">
                      <p className="truncate text-body-sm font-semibold text-ink">
                        {emp.first_name} {emp.last_name}
                      </p>
                      <p className="truncate text-caption text-ink-muted">{emp.email ?? '—'}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusBadge status={emp.status} />
                    <RowActions onEdit={() => openEditForm(emp)} onDelete={() => setDeleteTarget(emp)} />
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
                    <span className="truncate text-body-sm text-ink">{emp.department?.name ?? '—'}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('employees.table.position')}</span>
                    <span className="truncate text-body-sm text-ink">{emp.jobPosition?.title ?? '—'}</span>
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
    </div>
  );
}
