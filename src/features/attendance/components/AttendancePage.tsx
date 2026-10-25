import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { ExportButton } from '@/components/ui/ExportButton';
import type { ExportColumn } from '@/components/ui/ExportButton';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { SkeletonTable } from '@/components/ui/SkeletonTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { useSort, sortData } from '@/hooks/useSort';
import { userFacingMessage } from '@/lib/api/errors';
import { useDeleteAttendance, useAttendanceList } from '../api/queries';
import { useCan } from '@/hooks/useCan';
import type { AttendanceListParams, AttendanceStatus } from '../api/resource';
import { isKnownAttendanceStatus } from '../api/schema';
import type { AttendanceWire } from '../api/schema';
import { AttendanceFormDialog } from './AttendanceFormDialog';
import { DateRangeFilter } from '@/components/ui/DateRangeFilter';
import type { DateRange } from '@/components/ui/DateRangeFilter';

/**
 * Attendance module live-data page. Mirrors `EmployeesPage` conventions:
 * - `useAttendanceList` for data
 * - Add/Edit via `AttendanceFormDialog`
 * - Delete via `ConfirmDialog` + optimistic `useDeleteAttendance`
 * - `Pagination` for page controls
 * - Debounced search (employee name)
 * - Status filter chips (real backend values: present/absent/leave/holiday/weekend/half_day/late)
 * - Stat cards backed by cheap `perPage:1` filtered queries (total/present/absent)
 *
 * NOTE: 'late' is a first-class status. The seeder has always written it and
 * the shipped data carries 254 such rows, so the backend accepts it
 * (StoreAttendanceRequest / UpdateAttendanceRequest / the correction
 * endpoint) and the decoder expects it. A record can ALSO be 'present' with
 * `late_minutes > 0` - that combination still renders as "Present (+Nm)".
 */

const PER_PAGE = 10;

// Real backend status values from StoreAttendanceRequest.
const STATUS_CLASSES: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-50 text-emerald-700',
  absent: 'bg-red-50 text-red-700',
  leave: 'bg-sky-50 text-sky-700',
  holiday: 'bg-violet-50 text-violet-700',
  weekend: 'bg-slate-100 text-slate-600',
  half_day: 'bg-teal-50 text-teal-700',
  late: 'bg-amber-50 text-amber-700',
};

/**
 * `status` is a varchar on the server, so a value the UI has never heard of is
 * expected rather than exceptional. Warn once per value (visible in QA) and
 * render it verbatim - an unknown status must never hide a row (A2.4).
 */
const warnedUnknownStatuses = new Set<string>();

function warnUnknownStatus(status: string): void {
  if (isKnownAttendanceStatus(status) || warnedUnknownStatuses.has(status)) return;
  warnedUnknownStatuses.add(status);
  console.warn(`[attendance] unknown status "${status}" - rendering it verbatim.`);
}

function formatTime(wireDateTime: string | undefined): string {
  if (!wireDateTime) return '—';
  // Wire format is `YYYY-MM-DD HH:mm:ss` or ISO
  const timePart = wireDateTime.includes('T')
    ? wireDateTime.split('T')[1]?.slice(0, 5)
    : wireDateTime.split(' ')[1]?.slice(0, 5);
  return timePart ?? '—';
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function initialsOf(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
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

function StatusBadge({ status, lateMinutes }: { status: string; lateMinutes?: number | undefined }) {
  const { t } = useTranslation();
  const known = isKnownAttendanceStatus(status);

  warnUnknownStatus(status);

  // "Late" is its own status; a 'present' record can still carry late
  // minutes, and both read better with the minutes next to the label.
  const label = !known
    ? status
    : status === 'late'
      ? `${t('attendance.status.late')}${lateMinutes && lateMinutes > 0 ? ` (+${lateMinutes}m)` : ''}`
      : status === 'present' && lateMinutes && lateMinutes > 0
        ? `${t('attendance.status.present')} (+${lateMinutes}m)`
        : t(`attendance.status.${status}`);

  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
        known ? STATUS_CLASSES[status] : 'bg-surface-hover text-ink-muted',
      )}
    >
      {label}
    </span>
  );
}

// ─── Row Actions ──────────────────────────────────────────────────────────────

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
        <Button variant="ghost" className="h-7 w-7 px-0" aria-label={t('attendance.editAction')} onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      )}
      {canDelete && (
        <Button
          variant="ghost"
          className="h-7 w-7 px-0 hover:!text-coral"
          aria-label={t('attendance.deleteAction')}
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

// ─── Filter Chips ─────────────────────────────────────────────────────────────

const FILTER_OPTIONS: Array<{ key: string; value: AttendanceStatus | 'all' }> = [
  { key: 'all', value: 'all' },
  { key: 'present', value: 'present' },
  { key: 'absent', value: 'absent' },
  { key: 'leave', value: 'leave' },
  { key: 'holiday', value: 'holiday' },
  { key: 'weekend', value: 'weekend' },
  { key: 'half_day', value: 'half_day' },
  { key: 'late', value: 'late' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AttendancePage() {
  const { t } = useTranslation();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | 'all'>('all');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AttendanceWire | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<AttendanceWire | undefined>(undefined);

  // Debounce the free-text search so every keystroke doesn't fire a request.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // A new search/filter invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, dateRange]);

  const params = useMemo<AttendanceListParams>(
    () => ({
      page,
      perPage: PER_PAGE,
      search: search || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      dateFrom: dateRange?.from,
      dateTo: dateRange?.to,
    }),
    [page, search, statusFilter, dateRange],
  );

  const { state, refetch } = useAttendanceList(params);
  // Cheap stat queries — each reads only `meta.total`, never fabricates numbers.
  const { state: totalState } = useAttendanceList({ page: 1, perPage: 1 });
  const { state: presentState } = useAttendanceList({ page: 1, perPage: 1, status: 'present' });
  const { state: absentState } = useAttendanceList({ page: 1, perPage: 1, status: 'absent' });

  const deleteMutation = useDeleteAttendance(params);
  const canCreate = useCan('attendance', 'create');
  const canEdit = useCan('attendance', 'edit');
  const canDelete = useCan('attendance', 'delete');

  // Client-side sorting
  type AttendanceSortCol = 'employee' | 'date' | 'checkIn' | 'checkOut' | 'hours' | 'late' | 'status';
  const { sort, toggle: toggleSort } = useSort<AttendanceSortCol>();
  const SORT_ACCESSORS: Record<AttendanceSortCol, (r: AttendanceWire) => string | number | undefined> = {
    employee: (r) => `${r.employee?.first_name ?? ''} ${r.employee?.last_name ?? ''}`,
    date:     (r) => r.date,
    checkIn:  (r) => r.check_in ?? '',
    checkOut: (r) => r.check_out ?? '',
    hours:    (r) => (r.regular_hours ? parseFloat(r.regular_hours) : 0),
    late:     (r) => r.late_minutes ?? 0,
    status:   (r) => r.status,
  };
  const rawRecords = state.data?.data ?? [];
  // Date range is now applied server-side via `params.dateFrom`/`dateTo` (see above).
  const records = sortData(rawRecords, sort, SORT_ACCESSORS);
  const meta = state.data?.meta;

  const exportColumns: ExportColumn[] = [
    { key: 'employee', label: t('attendance.table.employee') },
    { key: 'date', label: t('attendance.table.date') },
    { key: 'checkIn', label: t('attendance.table.checkIn') },
    { key: 'checkOut', label: t('attendance.table.checkOut') },
    { key: 'hours', label: t('attendance.table.hours') },
    { key: 'late', label: t('attendance.table.late') },
    { key: 'status', label: t('attendance.table.status') },
  ];

  const exportData = records.map((r) => ({
    employee: r.employee ? `${r.employee.first_name} ${r.employee.last_name}` : `#${r.employee_id}`,
    date: formatDate(r.date),
    checkIn: formatTime(r.check_in),
    checkOut: formatTime(r.check_out),
    hours: r.regular_hours ? parseFloat(r.regular_hours).toFixed(1) : '',
    late: r.late_minutes && r.late_minutes > 0 ? `${r.late_minutes}m` : '',
    status: t(`attendance.status.${r.status}`, { defaultValue: r.status }),
  }));

  function openAddForm() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function openEditForm(record: AttendanceWire) {
    setEditTarget(record);
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
        title={t('attendance.title')}
        actions={
          <div className="flex items-center gap-2">
            <ExportButton data={exportData} columns={exportColumns} filename="attendance" />
            {canCreate && (
              <Button variant="primary" onClick={openAddForm}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                {t('attendance.addRecord')}
              </Button>
            )}
          </div>
        }
      />

      {/* Stat strip */}
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t('attendance.stat.total')} value={totalState.data?.meta.total} />
        <StatCard label={t('attendance.stat.present')} value={presentState.data?.meta.total} accent />
        <StatCard label={t('attendance.stat.absent')} value={absentState.data?.meta.total} />
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
            placeholder={t('attendance.searchPlaceholder')}
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
              {opt.value === 'all' ? t('attendance.filter.all') : t(`attendance.status.${opt.value}`)}
            </button>
          ))}
        </div>

        {/* Date range filter */}
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* Load failure */}
      {state.error ? (
        <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>{state.error ? userFacingMessage(state.error) || t('attendance.loadFailed') : t('attendance.loadFailed')}</span>
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
        <Card className="px-5 py-10 text-center text-body-sm text-ink-muted">{t('attendance.emptySearch')}</Card>
      )}

      {records.length > 0 && (
        <>
          {/* Attendance table — desktop/tablet-landscape */}
          <Card className="hidden lg:block">
            {/* Header */}
            <div className="border-b border-divider px-5 py-3">
              <div className="grid grid-cols-[2fr_90px_110px_110px_70px_70px_110px_auto] gap-4">
                {(['employee', 'date', 'checkIn', 'checkOut', 'hours', 'late', 'status'] as const).map((col) => (
                  <SortableHeader key={col} column={col} label={t(`attendance.table.${col}`)} sort={sort} onSort={toggleSort} />
                ))}
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('attendance.table.actions')}
                </span>
              </div>
            </div>

            {records.map((rec, idx) => (
              <div
                key={rec.id}
                className={cn(
                  'grid grid-cols-[2fr_90px_110px_110px_70px_70px_110px_auto] items-center gap-4 px-5 py-3',
                  idx < records.length - 1 && 'border-b border-divider',
                  'hover:bg-surface/60 transition-colors',
                )}
              >
                {/* Employee */}
                <div className="flex min-w-0 items-center gap-3">
                  {rec.employee ? (
                    <Avatar
                      initials={initialsOf(rec.employee.first_name, rec.employee.last_name)}
                      photo={rec.employee.photo}
                      size={32}
                    />
                  ) : (
                    <Avatar initials="??" size={32} />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-ink">
                      {rec.employee ? `${rec.employee.first_name} ${rec.employee.last_name}` : `#${rec.employee_id}`}
                    </p>
                    <p className="truncate text-caption text-ink-muted">
                      {rec.employee?.employee_number ?? ''}
                    </p>
                  </div>
                </div>

                {/* Date */}
                <span className="nums font-mono text-[12px] text-ink-muted">{formatDate(rec.date)}</span>

                {/* Check In */}
                <span className={cn('nums font-mono text-body-sm', rec.check_in ? 'text-ink-muted' : 'text-ink-faint')}>
                  {formatTime(rec.check_in)}
                </span>

                {/* Check Out */}
                <span className={cn('nums font-mono text-body-sm', rec.check_out ? 'text-ink-muted' : 'text-ink-faint')}>
                  {formatTime(rec.check_out)}
                </span>

                {/* Regular hours (decimal string from backend) */}
                <span className={cn('nums font-mono text-body-sm font-medium', rec.regular_hours ? 'text-ink' : 'text-ink-faint')}>
                  {rec.regular_hours ? parseFloat(rec.regular_hours).toFixed(1) : '—'}
                </span>

                {/* Late minutes */}
                <span
                  className={cn(
                    'nums font-mono text-body-sm',
                    rec.late_minutes && rec.late_minutes > 0 ? 'text-amber-600 font-semibold' : 'text-ink-faint',
                  )}
                >
                  {rec.late_minutes && rec.late_minutes > 0 ? `${rec.late_minutes}m` : '—'}
                </span>

                {/* Status badge */}
                <StatusBadge status={rec.status} lateMinutes={rec.late_minutes} />

                {/* Actions */}
                <RowActions
                  onEdit={() => openEditForm(rec)}
                  onDelete={() => setDeleteTarget(rec)}
                  canEdit={canEdit}
                  canDelete={canDelete}
                />
              </div>
            ))}
          </Card>

          {/* Attendance cards — mobile/tablet-portrait */}
          <div className="flex flex-col gap-3 lg:hidden">
            {records.map((rec) => (
              <Card key={rec.id} className="flex flex-col gap-3 p-4">
                {/* Identity + status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {rec.employee ? (
                      <Avatar
                        initials={initialsOf(rec.employee.first_name, rec.employee.last_name)}
                        photo={rec.employee.photo}
                        size={32}
                      />
                    ) : (
                      <Avatar initials="??" size={32} />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-body-sm font-semibold text-ink">
                        {rec.employee ? `${rec.employee.first_name} ${rec.employee.last_name}` : `#${rec.employee_id}`}
                      </p>
                      <p className="truncate text-caption text-ink-muted">
                        {rec.employee?.employee_number ?? formatDate(rec.date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusBadge status={rec.status} lateMinutes={rec.late_minutes} />
                    <RowActions
                      onEdit={() => openEditForm(rec)}
                      onDelete={() => setDeleteTarget(rec)}
                      canEdit={canEdit}
                      canDelete={canDelete}
                    />
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3 border-t border-divider pt-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('attendance.table.date')}</span>
                    <span className="nums font-mono text-[12px] text-ink">{formatDate(rec.date)}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('attendance.table.checkIn')}</span>
                    <span className={cn('nums font-mono text-[12px]', rec.check_in ? 'text-ink' : 'text-ink-faint')}>
                      {formatTime(rec.check_in)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('attendance.table.checkOut')}</span>
                    <span className={cn('nums font-mono text-[12px]', rec.check_out ? 'text-ink' : 'text-ink-faint')}>
                      {formatTime(rec.check_out)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('attendance.table.late')}</span>
                    <span
                      className={cn(
                        'nums font-mono text-[12px]',
                        rec.late_minutes && rec.late_minutes > 0 ? 'text-amber-600 font-semibold' : 'text-ink-faint',
                      )}
                    >
                      {rec.late_minutes && rec.late_minutes > 0 ? `${rec.late_minutes}m` : '—'}
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

      <AttendanceFormDialog open={formOpen} onOpenChange={setFormOpen} record={editTarget} />

      <ConfirmDialog
        open={deleteTarget !== undefined}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t('attendance.deleteConfirm.title')}
        description={
          deleteTarget
            ? t('attendance.deleteConfirm.description', {
                name: deleteTarget.employee
                  ? `${deleteTarget.employee.first_name} ${deleteTarget.employee.last_name}`
                  : `#${deleteTarget.employee_id}`,
                date: formatDate(deleteTarget.date),
              })
            : undefined
        }
        isLoading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
