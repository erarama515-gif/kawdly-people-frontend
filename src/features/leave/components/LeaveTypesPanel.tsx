import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SkeletonTable } from '@/components/ui/SkeletonTable';
import { toast } from '@/components/ui/Toast';
import { userFacingMessage } from '@/lib/api/errors';
import { useHasPermission } from '@/auth/session';
import { useDeleteLeaveType, useLeaveTypeAdminList } from '../api/admin';
import type { LeaveTypeAdminWire } from '../api/admin';
import { LeaveTypeFormDialog } from './LeaveTypeFormDialog';

const GRID = 'grid grid-cols-[2fr_0.7fr_0.7fr_0.9fr_0.9fr_0.7fr_auto] items-center gap-4';

/**
 * Leave-type configuration (A6.5): the catalogue that drives the request form's
 * dropdown. Gated on `leave.leave_type.*` directly — `useCan`'s RESOURCE_MAP
 * exposes this resource as `leave.type`, which is not a real permission slug.
 */
export function LeaveTypesPanel() {
  const { t } = useTranslation();
  const canCreate = useHasPermission('leave.leave_type.create');
  const canEdit = useHasPermission('leave.leave_type.edit');
  const canDelete = useHasPermission('leave.leave_type.delete');

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LeaveTypeAdminWire | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<LeaveTypeAdminWire | undefined>(undefined);

  const { state, refetch } = useLeaveTypeAdminList();
  const deleteMutation = useDeleteLeaveType();

  const leaveTypes = state.data?.data ?? [];

  function openCreate() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function openEdit(leaveType: LeaveTypeAdminWire) {
    setEditTarget(leaveType);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success(t('common.deleted'));
    } catch (error) {
      toast.error(userFacingMessage(error));
    } finally {
      setDeleteTarget(undefined);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-body-sm font-semibold text-ink">{t('leave.admin.types.title')}</h2>
          <p className="text-caption text-ink-muted">{t('leave.admin.types.hint')}</p>
        </div>
        {canCreate ? (
          <Button variant="primary" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            {t('leave.admin.types.add')}
          </Button>
        ) : null}
      </div>

      {state.error ? (
        <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>{userFacingMessage(state.error) || t('leave.admin.types.loadFailed')}</span>
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {state.status === 'pending' && leaveTypes.length === 0 ? <SkeletonTable /> : null}

      {state.status !== 'pending' && leaveTypes.length === 0 ? (
        <Card className="px-5 py-10 text-center text-body-sm text-ink-muted">
          {t('leave.admin.types.empty')}
        </Card>
      ) : null}

      {leaveTypes.length > 0 ? (
        <Card className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="border-b border-divider px-5 py-3">
              <div className={GRID}>
                {(['name', 'code', 'paid', 'maxDays', 'attachment', 'active'] as const).map((col) => (
                  <span
                    key={col}
                    className="text-caption font-semibold uppercase tracking-wide text-ink-faint"
                  >
                    {t(`leave.admin.types.table.${col}`)}
                  </span>
                ))}
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('leave.admin.common.actions')}
                </span>
              </div>
            </div>

            {leaveTypes.map((leaveType, index) => (
              <div
                key={leaveType.id}
                className={cn(
                  GRID,
                  'px-5 py-3 transition-colors hover:bg-surface/60',
                  index < leaveTypes.length - 1 && 'border-b border-divider',
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: leaveType.color ?? '#94a3b8' }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-body-sm font-semibold text-ink">
                    {leaveType.name}
                  </span>
                </div>
                <span className="truncate font-mono text-[12px] text-ink-muted" dir="ltr">
                  {leaveType.code ?? '—'}
                </span>
                <span className="text-[12px] text-ink-muted">
                  {leaveType.is_paid ? t('leave.admin.types.paid') : t('leave.admin.types.unpaid')}
                </span>
                <span className="nums font-mono text-[12px] text-ink-muted">
                  {leaveType.max_days_per_request ?? '—'}
                </span>
                <span className="text-[12px] text-ink-muted">
                  {leaveType.requires_attachment
                    ? t('leave.admin.types.required')
                    : t('leave.admin.types.optional')}
                </span>
                <span
                  className={cn(
                    'w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                    leaveType.is_active
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {leaveType.is_active
                    ? t('leave.admin.common.active')
                    : t('leave.admin.common.inactive')}
                </span>
                <div className="flex items-center gap-1">
                  {canEdit ? (
                    <Button
                      variant="ghost"
                      className="h-7 w-7 px-0"
                      aria-label={t('leave.admin.types.editAction')}
                      onClick={() => openEdit(leaveType)}
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button
                      variant="ghost"
                      className="h-7 w-7 px-0 hover:!text-coral"
                      aria-label={t('leave.admin.types.deleteAction')}
                      onClick={() => setDeleteTarget(leaveType)}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <LeaveTypeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        leaveType={editTarget}
      />

      <ConfirmDialog
        open={deleteTarget !== undefined}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(undefined);
        }}
        title={t('leave.admin.types.deleteTitle')}
        description={t('leave.admin.types.deleteDescription', { name: deleteTarget?.name ?? '' })}
        isLoading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
