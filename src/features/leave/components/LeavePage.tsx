import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { ExportButton } from '@/components/ui/ExportButton';
import type { ExportColumn } from '@/components/ui/ExportButton';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { SkeletonTable } from '@/components/ui/SkeletonTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/form/Field';
import { Textarea } from '@/components/ui/form/Textarea';
import { toast } from '@/components/ui/Toast';
import { Pagination } from '@/components/ui/Pagination';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { useSort, sortData } from '@/hooks/useSort';
import { userFacingMessage } from '@/lib/api/errors';
import { useLocalizeEntity } from '@/lib/localizeEntity';
import {
  useLeaveRequestList,
  useDeleteLeaveRequest,
  useApproveLeaveRequest,
  useRejectLeaveRequest,
} from '../api/queries';
import { useCan } from '@/hooks/useCan';
import type { LeaveRequestListParams, LeaveRequestStatus } from '../api/resource';
import type { LeaveRequestWire } from '../api/schema';
import { LeaveRequestFormDialog } from './LeaveRequestFormDialog';
import { DateRangeFilter } from '@/components/ui/DateRangeFilter';
import type { DateRange } from '@/components/ui/DateRangeFilter';

const PER_PAGE = 10;

const STATUS_CLASSES: Record<LeaveRequestStatus, string> = {
  pending:   'bg-amber-50 text-amber-700',
  approved:  'bg-emerald-50 text-emerald-700',
  rejected:  'bg-red-50 text-red-700',
  cancelled: 'bg-slate-100 text-slate-600',
};

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

function StatusBadge({ status }: { status: LeaveRequestStatus }) {
  const { t } = useTranslation();
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', STATUS_CLASSES[status])}>
      {t(`leave.status.${status}`)}
    </span>
  );
}

// ─── Row actions ──────────────────────────────────────────────────────────────

interface RowActionsProps {
  request: LeaveRequestWire;
  onEdit: () => void;
  onDelete: () => void;
  onApprove: () => void;
  onReject: () => void;
  approveLoading: boolean;
  rejectLoading: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canApprove?: boolean;
}

function RowActions({
  request,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  approveLoading,
  rejectLoading,
  canEdit = true,
  canDelete = true,
  canApprove = true,
}: RowActionsProps) {
  const { t } = useTranslation();
  const isPending = request.status === 'pending';

  return (
    <div className="flex items-center gap-1">
      {isPending && canApprove && (
        <>
          <Button
            variant="ghost"
            className="h-7 w-7 px-0 hover:!text-emerald-600"
            aria-label={t('leave.approve')}
            onClick={onApprove}
            isLoading={approveLoading}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            className="h-7 w-7 px-0 hover:!text-coral"
            aria-label={t('leave.reject')}
            onClick={onReject}
            isLoading={rejectLoading}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          </Button>
        </>
      )}
      {canEdit && (
        <Button
          variant="ghost"
          className="h-7 w-7 px-0"
          aria-label={t('leave.editAction')}
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      )}
      {canDelete && (
        <Button
          variant="ghost"
          className="h-7 w-7 px-0 hover:!text-coral"
          aria-label={t('leave.deleteAction')}
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

// ─── Filter chips ─────────────────────────────────────────────────────────────

const FILTER_OPTIONS: Array<{ key: string; value: LeaveRequestStatus | 'all' }> = [
  { key: 'all',      value: 'all' },
  { key: 'pending',  value: 'pending' },
  { key: 'approved', value: 'approved' },
  { key: 'rejected', value: 'rejected' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function LeavePage() {
  const { t } = useTranslation();
  const localize = useLocalizeEntity();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeaveRequestStatus | 'all'>('all');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LeaveRequestWire | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<LeaveRequestWire | undefined>(undefined);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequestWire | undefined>(undefined);
  const [rejectionReason, setRejectionReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>(undefined);

  // Debounce the free-text search so every keystroke doesn't fire a request.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // A new search/filter invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, dateRange]);

  const params = useMemo<LeaveRequestListParams>(
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

  const { state, refetch } = useLeaveRequestList(params);

  // Stat cards — each is a cheap `perPage:1` call reading only `meta.total`.
  const { state: totalState }    = useLeaveRequestList({ page: 1, perPage: 1 });
  const { state: pendingState }  = useLeaveRequestList({ page: 1, perPage: 1, status: 'pending' });
  const { state: approvedState } = useLeaveRequestList({ page: 1, perPage: 1, status: 'approved' });

  const deleteMutation  = useDeleteLeaveRequest(params);
  const approveMutation = useApproveLeaveRequest(params);
  const rejectMutation  = useRejectLeaveRequest(params);

  const canCreate = useCan('leave', 'create');
  const canEdit = useCan('leave', 'edit');
  const canDelete = useCan('leave', 'delete');
  const canApprove = useCan('leave', 'approve');

  // Client-side sorting
  type LeaveSortCol = 'employee' | 'leaveType' | 'from' | 'to' | 'days' | 'status';
  const { sort, toggle: toggleSort } = useSort<LeaveSortCol>();
  const SORT_ACCESSORS: Record<LeaveSortCol, (r: LeaveRequestWire) => string | number | undefined> = {
    employee:  (r) => `${r.employee?.first_name ?? ''} ${r.employee?.last_name ?? ''}`,
    leaveType: (r) => r.leave_type?.name ?? String(r.leave_type_id),
    from:      (r) => r.start_date,
    to:        (r) => r.end_date,
    days:      (r) => parseFloat(r.days),
    status:    (r) => r.status,
  };
  const rawRequests = state.data?.data ?? [];
  // Date range is now applied server-side via `params.dateFrom`/`dateTo` (see above).
  const requests = sortData(rawRequests, sort, SORT_ACCESSORS);
  const meta     = state.data?.meta;

  const exportColumns: ExportColumn[] = [
    { key: 'employee', label: t('leave.table.employee') },
    { key: 'leaveType', label: t('leave.table.leaveType') },
    { key: 'from', label: t('leave.table.from') },
    { key: 'to', label: t('leave.table.to') },
    { key: 'days', label: t('leave.table.days') },
    { key: 'status', label: t('leave.table.status') },
  ];

  const exportData = requests.map((r) => ({
    employee: `${r.employee?.first_name ?? ''} ${r.employee?.last_name ?? ''}`.trim(),
    leaveType: localize(r.leave_type?.name) || String(r.leave_type_id),
    from: formatDate(r.start_date),
    to: formatDate(r.end_date),
    days: parseFloat(r.days).toFixed(1),
    status: t(`leave.status.${r.status}`),
  }));

  function openAddForm() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function openEditForm(request: LeaveRequestWire) {
    setEditTarget(request);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await deleteMutation.mutate(deleteTarget.id);
    if (result !== undefined || deleteMutation.error === undefined) setDeleteTarget(undefined);
  }

  async function handleApprove(id: number) {
    try {
      await approveMutation.mutateAsync(id);
      toast.success(t('leave.approved'));
    } catch (error) {
      toast.error(userFacingMessage(error));
    }
  }

  /**
   * Rejection opens a dialog instead of firing straight away (A2.2): the reason
   * is the only thing the employee sees when they open a refused request, and
   * the old one-click path both lost it and swallowed the failure.
   */
  function openReject(request: LeaveRequestWire) {
    setRejectTarget(request);
    setRejectionReason('');
    setReasonError(undefined);
  }

  async function confirmReject() {
    if (!rejectTarget) return;

    const reason = rejectionReason.trim();
    if (reason.length < 3) {
      setReasonError(t('leave.rejectDialog.reasonRequired'));
      return;
    }

    try {
      await rejectMutation.mutateAsync({ id: rejectTarget.id, reason });
      toast.success(t('leave.rejected'));
      setRejectTarget(undefined);
      setRejectionReason('');
    } catch (error) {
      toast.error(userFacingMessage(error));
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t('leave.title')}
        actions={
          <div className="flex items-center gap-2">
            <ExportButton data={exportData} columns={exportColumns} filename="leave-requests" />
            {canCreate && (
              <Button variant="primary" onClick={openAddForm}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                {t('leave.addLeaveRequest')}
              </Button>
            )}
          </div>
        }
      />

      {/* Stat strip — total, pending, approved; all genuinely derived from the live list endpoint */}
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t('leave.stat.total')}    value={totalState.data?.meta.total} />
        <StatCard label={t('leave.stat.pending')}  value={pendingState.data?.meta.total} accent />
        <StatCard label={t('leave.stat.approved')} value={approvedState.data?.meta.total} />
      </div>

      {/* Toolbar: search + status filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <label className="relative flex items-center">
          <span className="pointer-events-none absolute start-3 text-ink-faint">
            <Search className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <input
            type="search"
            placeholder={t('leave.searchPlaceholder')}
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
              {t(`leave.filter.${opt.key}`)}
            </button>
          ))}
        </div>

        {/* Date range filter */}
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* Load failure */}
      {state.error ? (
        <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>{userFacingMessage(state.error) || t('leave.loadFailed')}</span>
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {/* Initial load */}
      {state.status === 'pending' && requests.length === 0 ? (
        <SkeletonTable />
      ) : null}

      {/* Empty state */}
      {state.status !== 'pending' && requests.length === 0 && (
        <Card className="px-5 py-10 text-center text-body-sm text-ink-muted">{t('leave.emptySearch')}</Card>
      )}

      {requests.length > 0 && (
        <>
          {/* Desktop table */}
          <Card className="hidden lg:block">
            {/* Header */}
            <div className="border-b border-divider px-5 py-3">
              <div className="grid grid-cols-[2fr_1.2fr_1fr_1fr_0.6fr_1fr_auto] gap-4">
                {(['employee', 'leaveType', 'from', 'to', 'days', 'status'] as const).map((col) => (
                  <SortableHeader key={col} column={col} label={t(`leave.table.${col}`)} sort={sort} onSort={toggleSort} />
                ))}
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('leave.table.actions')}
                </span>
              </div>
            </div>

            {requests.map((req, idx) => {
              const emp = req.employee;
              const firstName = emp?.first_name ?? '';
              const lastName  = emp?.last_name ?? '';
              const photo     = emp?.photo;
              const initials  = initialsOf(firstName, lastName);
              const leaveTypeName = localize(req.leave_type?.name) || String(req.leave_type_id);

              return (
                <div
                  key={req.id}
                  className={cn(
                    'grid grid-cols-[2fr_1.2fr_1fr_1fr_0.6fr_1fr_auto] items-center gap-4 px-5 py-3',
                    idx < requests.length - 1 && 'border-b border-divider',
                    'hover:bg-surface/60 transition-colors',
                  )}
                >
                  {/* Employee */}
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar initials={initials} photo={photo} size={32} />
                    <div className="min-w-0">
                      <p className="truncate text-body-sm font-semibold text-ink">
                        {firstName} {lastName}
                      </p>
                      <p className="truncate text-caption text-ink-muted">{req.reason ?? '—'}</p>
                    </div>
                  </div>

                  {/* Leave type */}
                  <span className="truncate text-body-sm text-ink">{leaveTypeName}</span>

                  {/* From */}
                  <span className="nums font-mono text-[12px] text-ink-muted">{formatDate(req.start_date)}</span>

                  {/* To */}
                  <span className="nums font-mono text-[12px] text-ink-muted">{formatDate(req.end_date)}</span>

                  {/* Days */}
                  <span className="nums font-mono text-body-sm font-semibold text-ink">
                    {parseFloat(req.days)}
                  </span>

                  {/* Status */}
                  <StatusBadge status={req.status} />

                  {/* Actions */}
                  <RowActions
                    request={req}
                    onEdit={() => openEditForm(req)}
                    onDelete={() => setDeleteTarget(req)}
                    onApprove={() => void handleApprove(req.id)}
                    onReject={() => openReject(req)}
                    approveLoading={approveMutation.isPending}
                    rejectLoading={rejectMutation.isPending}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    canApprove={canApprove}
                  />
                </div>
              );
            })}
          </Card>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 lg:hidden">
            {requests.map((req) => {
              const emp = req.employee;
              const firstName = emp?.first_name ?? '';
              const lastName  = emp?.last_name ?? '';
              const photo     = emp?.photo;
              const initials  = initialsOf(firstName, lastName);
              const leaveTypeName = localize(req.leave_type?.name) || String(req.leave_type_id);

              return (
                <Card key={req.id} className="flex flex-col gap-3 p-4">
                  {/* Identity + status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar initials={initials} photo={photo} size={32} />
                      <div className="min-w-0">
                        <p className="truncate text-body-sm font-semibold text-ink">
                          {firstName} {lastName}
                        </p>
                        <p className="truncate text-caption text-ink-muted">{req.reason ?? '—'}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <StatusBadge status={req.status} />
                      <RowActions
                        request={req}
                        onEdit={() => openEditForm(req)}
                        onDelete={() => setDeleteTarget(req)}
                        onApprove={() => void handleApprove(req.id)}
                        onReject={() => openReject(req)}
                        approveLoading={approveMutation.isPending}
                        rejectLoading={rejectMutation.isPending}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        canApprove={canApprove}
                      />
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-3 border-t border-divider pt-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-caption text-ink-faint">{t('leave.table.leaveType')}</span>
                      <span className="truncate text-body-sm text-ink">{leaveTypeName}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-caption text-ink-faint">{t('leave.table.days')}</span>
                      <span className="nums font-mono text-[12px] text-ink font-semibold">
                        {parseFloat(req.days)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-caption text-ink-faint">{t('leave.table.from')}</span>
                      <span className="nums font-mono text-[12px] text-ink">{formatDate(req.start_date)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-caption text-ink-faint">{t('leave.table.to')}</span>
                      <span className="nums font-mono text-[12px] text-ink">{formatDate(req.end_date)}</span>
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

      <LeaveRequestFormDialog open={formOpen} onOpenChange={setFormOpen} leaveRequest={editTarget} />

      <ConfirmDialog
        open={deleteTarget !== undefined}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t('leave.deleteConfirm.title')}
        description={
          deleteTarget
            ? t('leave.deleteConfirm.description', {
                name: `${deleteTarget.employee?.first_name ?? ''} ${deleteTarget.employee?.last_name ?? ''}`.trim() || String(deleteTarget.id),
              })
            : undefined
        }
        isLoading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
      />

      <Dialog
        open={rejectTarget !== undefined}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(undefined);
        }}
      >
        <DialogContent
          title={t('leave.rejectDialog.title')}
          description={t('leave.rejectDialog.description')}
          footer={
            <>
              <DialogClose asChild>
                <Button variant="secondary" disabled={rejectMutation.isPending}>
                  {t('common.cancel')}
                </Button>
              </DialogClose>
              <Button
                variant="danger"
                isLoading={rejectMutation.isPending}
                onClick={() => void confirmReject()}
              >
                {t('leave.rejectDialog.confirm')}
              </Button>
            </>
          }
        >
          <Field
            label={t('leave.rejectDialog.reason')}
            htmlFor="leave-rejection-reason"
            error={reasonError}
            required
          >
            <Textarea
              id="leave-rejection-reason"
              value={rejectionReason}
              invalid={reasonError !== undefined}
              onChange={(event) => {
                setRejectionReason(event.target.value);
                if (reasonError) setReasonError(undefined);
              }}
              rows={4}
              autoFocus
            />
          </Field>
        </DialogContent>
      </Dialog>
    </div>
  );
}
