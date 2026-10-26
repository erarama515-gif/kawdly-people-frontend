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
import { useDeleteLeavePolicy, useLeavePolicyAdminList } from '../api/admin';
import type { LeavePolicyWire } from '../api/admin';
import { LeavePolicyFormDialog } from './LeavePolicyFormDialog';

const GRID = 'grid grid-cols-[1.6fr_1.2fr_0.7fr_0.8fr_0.7fr_0.8fr_0.7fr_auto] items-center gap-4';

/**
 * Leave policies (A6.5): entitlement + accrual + carry-forward + encashment per
 * leave type. Gated on `leave.leave_policy.*` (again, not via `useCan`).
 */
export function LeavePoliciesPanel() {
  const { t } = useTranslation();
  const canCreate = useHasPermission('leave.leave_policy.create');
  const canEdit = useHasPermission('leave.leave_policy.edit');
  const canDelete = useHasPermission('leave.leave_policy.delete');

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LeavePolicyWire | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<LeavePolicyWire | undefined>(undefined);

  const { state, refetch } = useLeavePolicyAdminList();
  const deleteMutation = useDeleteLeavePolicy();

  const policies = state.data?.data ?? [];

  function openCreate() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function openEdit(policy: LeavePolicyWire) {
    setEditTarget(policy);
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
          <h2 className="text-body-sm font-semibold text-ink">{t('leave.admin.policies.title')}</h2>
          <p className="text-caption text-ink-muted">{t('leave.admin.policies.hint')}</p>
        </div>
        {canCreate ? (
          <Button variant="primary" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            {t('leave.admin.policies.add')}
          </Button>
        ) : null}
      </div>

      {state.error ? (
        <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>{userFacingMessage(state.error) || t('leave.admin.policies.loadFailed')}</span>
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {state.status === 'pending' && policies.length === 0 ? <SkeletonTable /> : null}

      {state.status !== 'pending' && policies.length === 0 ? (
        <Card className="px-5 py-10 text-center text-body-sm text-ink-muted">
          {t('leave.admin.policies.empty')}
        </Card>
      ) : null}

      {policies.length > 0 ? (
        <Card className="overflow-x-auto">
          <div className="min-w-[860px]">
            <div className="border-b border-divider px-5 py-3">
              <div className={GRID}>
                {(
                  [
                    'name',
                    'leaveType',
                    'entitlement',
                    'accrual',
                    'carryForward',
                    'encashment',
                    'active',
                  ] as const
                ).map((col) => (
                  <span
                    key={col}
                    className="text-caption font-semibold uppercase tracking-wide text-ink-faint"
                  >
                    {t(`leave.admin.policies.table.${col}`)}
                  </span>
                ))}
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('leave.admin.common.actions')}
                </span>
              </div>
            </div>

            {policies.map((policy, index) => (
              <div
                key={policy.id}
                className={cn(
                  GRID,
                  'px-5 py-3 transition-colors hover:bg-surface/60',
                  index < policies.length - 1 && 'border-b border-divider',
                )}
              >
                <span className="truncate text-body-sm font-semibold text-ink">{policy.name}</span>
                <span className="truncate text-[12px] text-ink-muted">
                  {policy.leave_type?.name ?? `#${policy.leave_type_id}`}
                </span>
                <span className="nums font-mono text-[12px] text-ink-muted">
                  {policy.annual_entitlement}
                </span>
                <span className="text-[12px] text-ink-muted">
                  {t(`leave.admin.policies.accrual.${policy.accrual_method}`)}
                </span>
                <span className="nums font-mono text-[12px] text-ink-muted">
                  {policy.carry_forward_max ?? '0'}
                </span>
                <span className="text-[12px] text-ink-muted">
                  {policy.encashment_allowed
                    ? t('leave.admin.policies.encashmentAllowed')
                    : t('leave.admin.policies.encashmentNotAllowed')}
                </span>
                <span
                  className={cn(
                    'w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                    policy.is_active
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {policy.is_active
                    ? t('leave.admin.common.active')
                    : t('leave.admin.common.inactive')}
                </span>
                <div className="flex items-center gap-1">
                  {canEdit ? (
                    <Button
                      variant="ghost"
                      className="h-7 w-7 px-0"
                      aria-label={t('leave.admin.policies.editAction')}
                      onClick={() => openEdit(policy)}
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button
                      variant="ghost"
                      className="h-7 w-7 px-0 hover:!text-coral"
                      aria-label={t('leave.admin.policies.deleteAction')}
                      onClick={() => setDeleteTarget(policy)}
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

      <LeavePolicyFormDialog open={formOpen} onOpenChange={setFormOpen} policy={editTarget} />

      <ConfirmDialog
        open={deleteTarget !== undefined}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(undefined);
        }}
        title={t('leave.admin.policies.deleteTitle')}
        description={t('leave.admin.policies.deleteDescription', {
          name: deleteTarget?.name ?? '',
        })}
        isLoading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
