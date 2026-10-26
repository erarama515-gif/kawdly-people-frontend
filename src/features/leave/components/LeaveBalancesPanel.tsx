import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonTable } from '@/components/ui/SkeletonTable';
import { toast } from '@/components/ui/Toast';
import { userFacingMessage } from '@/lib/api/errors';
import { useHasPermission } from '@/auth/session';
import { useEmployeeList } from '@/features/employees/api/queries';
import {
  remainingDays,
  useDeleteLeaveBalance,
  useLeaveBalanceAdminList,
  useLeaveTypeAdminList,
} from '../api/admin';
import type { LeaveBalanceWire } from '../api/admin';
import { LeaveBalanceFormDialog } from './LeaveBalanceFormDialog';

const PER_PAGE = 10;
const CURRENT_YEAR = new Date().getFullYear();
const GRID = 'grid grid-cols-[1.7fr_1.2fr_0.5fr_0.7fr_0.7fr_0.7fr_0.7fr_auto] items-center gap-4';

/**
 * Yearly leave balances (A6.5). `remaining` is computed here because the model
 * accessor is not in `$appends`, so it never reaches the JSON payload.
 */
export function LeaveBalancesPanel() {
  const { t } = useTranslation();
  const canCreate = useHasPermission('leave.leave_balance.create');
  const canEdit = useHasPermission('leave.leave_balance.edit');
  const canDelete = useHasPermission('leave.leave_balance.delete');

  const [page, setPage] = useState(1);
  const [year, setYear] = useState<string>(String(CURRENT_YEAR));
  const [employeeId, setEmployeeId] = useState('');
  const [leaveTypeId, setLeaveTypeId] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LeaveBalanceWire | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<LeaveBalanceWire | undefined>(undefined);

  useEffect(() => {
    setPage(1);
  }, [year, employeeId, leaveTypeId]);

  const { state, refetch } = useLeaveBalanceAdminList({
    page,
    perPage: PER_PAGE,
    year: year ? Number(year) : undefined,
    employeeId: employeeId ? Number(employeeId) : undefined,
    leaveTypeId: leaveTypeId ? Number(leaveTypeId) : undefined,
  });
  const { state: leaveTypesState } = useLeaveTypeAdminList();
  const { state: employeesState } = useEmployeeList({ page: 1, perPage: 200 });
  const deleteMutation = useDeleteLeaveBalance();

  const balances = state.data?.data ?? [];
  const meta = state.data?.meta;
  const leaveTypes = leaveTypesState.data?.data ?? [];
  const employees = employeesState.data?.data ?? [];

  function employeeNameOf(balance: LeaveBalanceWire): string {
    if (!balance.employee) return `#${balance.employee_id}`;
    return balance.employee.first_name_ar && balance.employee.last_name_ar
      ? `${balance.employee.first_name_ar} ${balance.employee.last_name_ar}`
      : `${balance.employee.first_name} ${balance.employee.last_name}`;
  }

  function openCreate() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function openEdit(balance: LeaveBalanceWire) {
    setEditTarget(balance);
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
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-body-sm font-semibold text-ink">{t('leave.admin.balances.title')}</h2>
          <p className="text-caption text-ink-muted">{t('leave.admin.balances.hint')}</p>
        </div>
        {canCreate ? (
          <Button variant="primary" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            {t('leave.admin.balances.add')}
          </Button>
        ) : null}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-caption text-ink-muted">{t('leave.admin.common.year')}</span>
          <input
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(event) => setYear(event.target.value)}
            className="h-9 w-28 rounded-[3px] border border-hairline bg-surface px-3 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-navy/40"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-caption text-ink-muted">{t('leave.admin.common.employee')}</span>
          <select
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            className="h-9 w-56 rounded-[3px] border border-hairline bg-surface px-2 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-navy/40"
          >
            <option value="">{t('leave.admin.common.all')}</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.first_name_ar && employee.last_name_ar
                  ? `${employee.first_name_ar} ${employee.last_name_ar}`
                  : `${employee.first_name} ${employee.last_name}`}{' '}
                — {employee.employee_number}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-caption text-ink-muted">{t('leave.admin.common.leaveType')}</span>
          <select
            value={leaveTypeId}
            onChange={(event) => setLeaveTypeId(event.target.value)}
            className="h-9 w-48 rounded-[3px] border border-hairline bg-surface px-2 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-navy/40"
          >
            <option value="">{t('leave.admin.common.all')}</option>
            {leaveTypes.map((leaveType) => (
              <option key={leaveType.id} value={leaveType.id}>
                {leaveType.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {state.error ? (
        <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>{userFacingMessage(state.error) || t('leave.admin.balances.loadFailed')}</span>
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {state.status === 'pending' && balances.length === 0 ? <SkeletonTable /> : null}

      {state.status !== 'pending' && balances.length === 0 ? (
        <Card className="px-5 py-10 text-center text-body-sm text-ink-muted">
          {t('leave.admin.balances.empty')}
        </Card>
      ) : null}

      {balances.length > 0 ? (
        <>
          <Card className="overflow-x-auto">
            <div className="min-w-[820px]">
              <div className="border-b border-divider px-5 py-3">
                <div className={GRID}>
                  {(
                    ['employee', 'leaveType', 'year', 'entitled', 'taken', 'pending', 'remaining'] as const
                  ).map((col) => (
                    <span
                      key={col}
                      className="text-caption font-semibold uppercase tracking-wide text-ink-faint"
                    >
                      {t(`leave.admin.balances.table.${col}`)}
                    </span>
                  ))}
                  <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                    {t('leave.admin.common.actions')}
                  </span>
                </div>
              </div>

              {balances.map((balance, index) => (
                <div
                  key={balance.id}
                  className={cn(
                    GRID,
                    'px-5 py-3 transition-colors hover:bg-surface/60',
                    index < balances.length - 1 && 'border-b border-divider',
                  )}
                >
                  <span className="truncate text-body-sm font-semibold text-ink">
                    {employeeNameOf(balance)}
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: balance.leave_type?.color ?? '#94a3b8' }}
                      aria-hidden="true"
                    />
                    <span className="truncate text-[12px] text-ink-muted">
                      {balance.leave_type?.name ?? `#${balance.leave_type_id}`}
                    </span>
                  </span>
                  <span className="nums font-mono text-[12px] text-ink-muted">{balance.year}</span>
                  <span className="nums font-mono text-[12px] text-ink-muted">
                    {balance.entitled}
                  </span>
                  <span className="nums font-mono text-[12px] text-ink-muted">{balance.taken}</span>
                  <span className="nums font-mono text-[12px] text-ink-muted">
                    {balance.pending}
                  </span>
                  <span className="nums font-mono text-[12px] font-semibold text-ink">
                    {remainingDays(balance)}
                  </span>
                  <div className="flex items-center gap-1">
                    {canEdit ? (
                      <Button
                        variant="ghost"
                        className="h-7 w-7 px-0"
                        aria-label={t('leave.admin.balances.editAction')}
                        onClick={() => openEdit(balance)}
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button
                        variant="ghost"
                        className="h-7 w-7 px-0 hover:!text-coral"
                        aria-label={t('leave.admin.balances.deleteAction')}
                        onClick={() => setDeleteTarget(balance)}
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>

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
      ) : null}

      <LeaveBalanceFormDialog open={formOpen} onOpenChange={setFormOpen} balance={editTarget} />

      <ConfirmDialog
        open={deleteTarget !== undefined}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(undefined);
        }}
        title={t('leave.admin.balances.deleteTitle')}
        description={t('leave.admin.balances.deleteDescription', {
          name: deleteTarget ? employeeNameOf(deleteTarget) : '',
        })}
        isLoading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
