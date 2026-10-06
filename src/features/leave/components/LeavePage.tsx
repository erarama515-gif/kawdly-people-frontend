import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { userFacingMessage } from '@/lib/api/errors';
import {
  useLeaveRequestList,
  useDeleteLeaveRequest,
  useApproveLeaveRequest,
  useRejectLeaveRequest,
} from '../api/queries';
import type { LeaveRequestListParams, LeaveRequestStatus } from '../api/resource';
import type { LeaveRequestWire } from '../api/schema';
import { LeaveRequestFormDialog } from './LeaveRequestFormDialog';

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
}

function RowActions({ request, onEdit, onDelete, onApprove, onReject, approveLoading, rejectLoading }: RowActionsProps) {
  const { t } = useTranslation();
  const isPending = request.status === 'pending';

  return (
    <div className="flex items-center gap-1">
      {isPending && (
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
      <Button
        variant="ghost"
        className="h-7 w-7 px-0"
        aria-label={t('leave.editAction')}
        onClick={onEdit}
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        className="h-7 w-7 px-0 hover:!text-coral"
        aria-label={t('leave.deleteAction')}
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      </Button>
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

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeaveRequestStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LeaveRequestWire | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<LeaveRequestWire | undefined>(undefined);

  // Debounce the free-text search so every keystroke doesn't fire a request.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // A new search/filter invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const params = useMemo<LeaveRequestListParams>(
    () => ({
      page,
      perPage: PER_PAGE,
      search: search || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    [page, search, statusFilter],
  );

  const { state, refetch } = useLeaveRequestList(params);

  // Stat cards — each is a cheap `perPage:1` call reading only `meta.total`.
  const { state: totalState }    = useLeaveRequestList({ page: 1, perPage: 1 });
  const { state: pendingState }  = useLeaveRequestList({ page: 1, perPage: 1, status: 'pending' });
  const { state: approvedState } = useLeaveRequestList({ page: 1, perPage: 1, status: 'approved' });

  const deleteMutation  = useDeleteLeaveRequest(params);
  const approveMutation = useApproveLeaveRequest(params);
  const rejectMutation  = useRejectLeaveRequest(params);

  const requests = state.data?.data ?? [];
  const meta     = state.data?.meta;

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
    await approveMutation.mutate(id);
  }

  async function handleReject(id: number) {
    await rejectMutation.mutate(id);
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t('leave.title')}
        actions={
          <Button variant="primary" onClick={openAddForm}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            {t('leave.addLeaveRequest')}
          </Button>
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
          <span className="pointer-events-none absolute left-3 text-ink-faint">
            <Search className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <input
            type="search"
            placeholder={t('leave.searchPlaceholder')}
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
              {t(`leave.filter.${opt.key}`)}
            </button>
          ))}
        </div>
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
        <Card className="px-5 py-10 text-center text-body-sm text-ink-muted">{t('common.loading')}</Card>
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
                  <span key={col} className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                    {t(`leave.table.${col}`)}
                  </span>
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
              const leaveTypeName = req.leaveType?.name ?? String(req.leave_type_id);

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
                    onReject={() => void handleReject(req.id)}
                    approveLoading={approveMutation.isPending}
                    rejectLoading={rejectMutation.isPending}
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
              const leaveTypeName = req.leaveType?.name ?? String(req.leave_type_id);

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
                        onReject={() => void handleReject(req.id)}
                        approveLoading={approveMutation.isPending}
                        rejectLoading={rejectMutation.isPending}
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
    </div>
  );
}
