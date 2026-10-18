import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRightLeft, Ban, RefreshCw, RotateCcw, TrendingUp, UserX } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { userFacingMessage } from '@/lib/api/errors';
import { useHasPermission } from '@/auth/session';
import { useEmployeeDetail } from '../api/queries';
import { EmployeePromoteDialog } from './EmployeePromoteDialog';
import { EmployeeTransferDialog } from './EmployeeTransferDialog';
import { EmployeeSuspendDialog } from './EmployeeSuspendDialog';
import { EmployeeTerminateDialog } from './EmployeeTerminateDialog';
import { EmployeeReinstateDialog } from './EmployeeReinstateDialog';
import { useContractList } from '@/features/contracts/api/queries';
import { useEmployeeDocumentList } from '@/features/documents/api/queries';
import { useLeaveRequestList } from '@/features/leave/api/queries';
import { LeaveBalanceCard } from '@/features/leave/components/LeaveBalanceCard';
import { useAttendanceList } from '@/features/attendance/api/queries';
import type { EmployeeStatus } from '../api/resource';
import type { ContractStatus } from '@/features/contracts/api/resource';
import type { LeaveRequestStatus } from '@/features/leave/api/resource';
import type { AttendanceWire } from '@/features/attendance/api/schema';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initialsOf(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function fmt(iso: string | undefined | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(timeStr: string | undefined | null): string {
  if (!timeStr) return '—';
  // time strings may be HH:MM:SS or HH:MM
  return timeStr.slice(0, 5);
}

// ─── Status badge colours ─────────────────────────────────────────────────────

const EMP_STATUS_CLASSES: Record<EmployeeStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  on_leave: 'bg-sky-50 text-sky-700',
  suspended: 'bg-amber-50 text-amber-700',
  terminated: 'bg-red-50 text-red-700',
  resigned: 'bg-slate-100 text-slate-600',
};

const CONTRACT_STATUS_CLASSES: Record<ContractStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  draft: 'bg-slate-100 text-slate-500',
  expired: 'bg-red-50 text-red-600',
  terminated: 'bg-rose-50 text-rose-700',
};

const LEAVE_STATUS_CLASSES: Record<LeaveRequestStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-600',
  cancelled: 'bg-slate-100 text-slate-500',
};

type AttendanceWireStatus = AttendanceWire['status'];

const ATTENDANCE_STATUS_CLASSES: Record<AttendanceWireStatus, string> = {
  present: 'bg-emerald-50 text-emerald-700',
  absent: 'bg-red-50 text-red-600',
  leave: 'bg-sky-50 text-sky-700',
  holiday: 'bg-violet-50 text-violet-700',
  weekend: 'bg-slate-100 text-slate-500',
  half_day: 'bg-orange-50 text-orange-600',
};

// ─── Reusable sub-components ──────────────────────────────────────────────────

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold', className)}>
      {label}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string | React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-caption text-ink-faint">{label}</span>
      <span className="text-body-sm text-ink">{value ?? '—'}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-ink-faint">
      {children}
    </h2>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = 'contracts' | 'documents' | 'leave' | 'attendance';

function TabBar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const { t } = useTranslation();
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'contracts', label: t('employeeProfile.tabs.contracts') },
    { key: 'documents', label: t('employeeProfile.tabs.documents') },
    { key: 'leave', label: t('employeeProfile.tabs.leave') },
    { key: 'attendance', label: t('employeeProfile.tabs.attendance') },
  ];
  return (
    <div className="flex gap-0 border-b border-divider">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            'px-5 py-3 text-[13px] font-semibold transition-colors',
            active === tab.key
              ? 'border-b-2 border-navy text-navy'
              : 'text-ink-muted hover:text-ink',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Contracts tab content ────────────────────────────────────────────────────

function ContractsTab({ employeeId }: { employeeId: number }) {
  const { t } = useTranslation();
  const { state } = useContractList({ employeeId, perPage: 10 });
  const contracts = state.data?.data ?? [];

  if (state.status === 'pending') {
    return (
      <div className="flex flex-col gap-2 p-5">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-4/5" />
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-body-sm text-ink-muted">
        {t('employeeProfile.empty.contracts')}
      </p>
    );
  }

  return (
    <div className="divide-y divide-divider">
      {contracts.map((c) => (
        <div key={c.id} className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-3 text-body-sm">
          <div className="flex flex-col gap-0.5">
            <span className="text-caption text-ink-faint">{t('contracts.type.initial')}</span>
            <span className="text-ink">{t(`contracts.type.${c.type}`)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-caption text-ink-faint">{t('contracts.table.startDate')}</span>
            <span className="nums font-mono text-[12px] text-ink">{fmt(c.start_date)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-caption text-ink-faint">{t('contracts.table.endDate')}</span>
            <span className="nums font-mono text-[12px] text-ink">{fmt(c.end_date)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-caption text-ink-faint">{t('contracts.table.salary')}</span>
            <span className="nums font-mono text-[12px] text-ink">{c.basic_salary.toLocaleString()}</span>
          </div>
          <div className="flex items-start pt-3">
            <Badge
              label={t(`contracts.status.${c.status}`)}
              className={CONTRACT_STATUS_CLASSES[c.status]}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Documents tab content ────────────────────────────────────────────────────

function DocumentsTab({ employeeId }: { employeeId: number }) {
  const { t } = useTranslation();
  const { state } = useEmployeeDocumentList({ employeeId, perPage: 10 });
  const docs = state.data?.data ?? [];

  if (state.status === 'pending') {
    return (
      <div className="flex flex-col gap-2 p-5">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-4/5" />
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-body-sm text-ink-muted">
        {t('employeeProfile.empty.documents')}
      </p>
    );
  }

  return (
    <div className="divide-y divide-divider">
      {docs.map((d) => (
        <div key={d.id} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-5 py-3 text-body-sm">
          <div className="flex flex-col gap-0.5">
            <span className="text-caption text-ink-faint">{t('documents.table.documentType')}</span>
            <span className="text-ink">{d.document_type?.name ?? d.title}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-caption text-ink-faint">{t('documents.table.documentNumber')}</span>
            <span className="nums font-mono text-[12px] text-ink">{d.document_number ?? '—'}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-caption text-ink-faint">{t('documents.table.issueDate')}</span>
            <span className="nums font-mono text-[12px] text-ink">{fmt(d.issue_date)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-caption text-ink-faint">{t('documents.table.expiryDate')}</span>
            <span className="nums font-mono text-[12px] text-ink">{fmt(d.expiry_date)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Leave tab content ────────────────────────────────────────────────────────

function LeaveTab({ employeeId }: { employeeId: number }) {
  const { t } = useTranslation();
  const { state } = useLeaveRequestList({ employeeId, perPage: 10 });
  const requests = state.data?.data ?? [];

  if (state.status === 'pending') {
    return (
      <div className="flex flex-col gap-2 p-5">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-4/5" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-5">
        <LeaveBalanceCard employeeId={employeeId} />
        <p className="py-4 text-center text-body-sm text-ink-muted">
          {t('employeeProfile.empty.leave')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      <div className="p-5">
        <LeaveBalanceCard employeeId={employeeId} />
      </div>
      <div className="divide-y divide-divider">
      {requests.map((r) => (
        <div key={r.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-3 text-body-sm">
          <div className="flex flex-col gap-0.5">
            <span className="text-caption text-ink-faint">{t('leave.table.leaveType')}</span>
            <span className="text-ink">{r.leave_type?.name ?? `#${r.leave_type_id}`}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-caption text-ink-faint">{t('leave.table.from')}</span>
            <span className="nums font-mono text-[12px] text-ink">{fmt(r.start_date)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-caption text-ink-faint">{t('leave.table.to')}</span>
            <span className="nums font-mono text-[12px] text-ink">{fmt(r.end_date)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-caption text-ink-faint">{t('leave.table.days')}</span>
            <span className="nums font-mono text-[12px] text-ink">{r.days}</span>
          </div>
          <div className="flex items-start pt-3">
            <Badge
              label={t(`leave.status.${r.status}`)}
              className={LEAVE_STATUS_CLASSES[r.status]}
            />
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

// ─── Attendance tab content ───────────────────────────────────────────────────

function AttendanceTab({ employeeId }: { employeeId: number }) {
  const { t } = useTranslation();
  const { state } = useAttendanceList({ employeeId, perPage: 10 });
  const records = state.data?.data ?? [];

  if (state.status === 'pending') {
    return (
      <div className="flex flex-col gap-2 p-5">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-4/5" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-body-sm text-ink-muted">
        {t('employeeProfile.empty.attendance')}
      </p>
    );
  }

  return (
    <div className="divide-y divide-divider">
      {records.map((r) => (
        <div key={r.id} className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-4 px-5 py-3 text-body-sm">
          <div className="flex flex-col gap-0.5">
            <span className="text-caption text-ink-faint">{t('attendance.table.date')}</span>
            <span className="nums font-mono text-[12px] text-ink">{fmt(r.date)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-caption text-ink-faint">{t('attendance.table.checkIn')}</span>
            <span className="nums font-mono text-[12px] text-ink">{fmtTime(r.check_in)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-caption text-ink-faint">{t('attendance.table.checkOut')}</span>
            <span className="nums font-mono text-[12px] text-ink">{fmtTime(r.check_out)}</span>
          </div>
          <div className="flex items-start pt-3">
            <Badge
              label={t(`attendance.status.${r.status}`)}
              className={ATTENDANCE_STATUS_CLASSES[r.status]}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page skeleton ────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <div className="flex items-center gap-5">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <Skeleton className="mb-4 h-4 w-32" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <Skeleton className="mb-4 h-4 w-32" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const employeeId = Number(id ?? 0);
  const { t } = useTranslation();
  const { state, refetch } = useEmployeeDetail(employeeId);
  const [activeTab, setActiveTab] = useState<Tab>('contracts');

  const canEditLifecycle = useHasPermission('employee.list.edit');
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [reinstateOpen, setReinstateOpen] = useState(false);

  const emp = state.data;

  // Lifecycle actions are gated by both the shared `employee.list.edit`
  // permission (every lifecycle route uses it — see
  // `routes/api/employee-lifecycle.php`) and the employee's current status,
  // so the UI never offers a transition the backend would reject anyway.
  const canPromote = canEditLifecycle && emp ? emp.status !== 'terminated' && emp.status !== 'resigned' : false;
  const canTransfer = canPromote;
  const canSuspend = canEditLifecycle && emp ? emp.status === 'active' || emp.status === 'on_leave' : false;
  const canTerminate = canEditLifecycle && emp ? emp.status !== 'terminated' && emp.status !== 'resigned' : false;
  const canReinstate = canEditLifecycle && emp ? emp.status === 'suspended' || emp.status === 'terminated' : false;

  return (
    <div className="flex flex-col">
      <PageHeader
        title={emp ? `${emp.first_name} ${emp.last_name}` : t('employeeProfile.title')}
        actions={
          <>
            {canPromote ? (
              <Button variant="secondary" onClick={() => setPromoteOpen(true)}>
                <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                {t('employees.promoteAction')}
              </Button>
            ) : null}
            {canTransfer ? (
              <Button variant="secondary" onClick={() => setTransferOpen(true)}>
                <ArrowRightLeft className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                {t('employees.transferAction')}
              </Button>
            ) : null}
            {canSuspend ? (
              <Button variant="secondary" className="hover:!text-amber-600" onClick={() => setSuspendOpen(true)}>
                <UserX className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                {t('employees.suspendAction')}
              </Button>
            ) : null}
            {canReinstate ? (
              <Button variant="secondary" className="hover:!text-emerald-600" onClick={() => setReinstateOpen(true)}>
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                {t('employees.reinstateAction')}
              </Button>
            ) : null}
            {canTerminate ? (
              <Button variant="secondary" className="hover:!text-coral" onClick={() => setTerminateOpen(true)}>
                <Ban className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                {t('employees.terminateAction')}
              </Button>
            ) : null}
            <Link
              to="/people/employees"
              className="flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-[13px] font-semibold text-ink-muted hover:border-navy/40 hover:text-ink transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5 rtl-mirror" strokeWidth={1.75} aria-hidden="true" />
              {t('employeeProfile.backToList')}
            </Link>
          </>
        }
      />

      {emp ? (
        <>
          <EmployeePromoteDialog open={promoteOpen} onOpenChange={setPromoteOpen} employee={emp} />
          <EmployeeTransferDialog open={transferOpen} onOpenChange={setTransferOpen} employee={emp} />
          <EmployeeSuspendDialog open={suspendOpen} onOpenChange={setSuspendOpen} employee={emp} />
          <EmployeeTerminateDialog open={terminateOpen} onOpenChange={setTerminateOpen} employee={emp} />
          <EmployeeReinstateDialog open={reinstateOpen} onOpenChange={setReinstateOpen} employee={emp} />
        </>
      ) : null}

      {/* Load error */}
      {state.error ? (
        <Card className="mb-6 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>{userFacingMessage(state.error) || t('employeeProfile.loadFailed')}</span>
          <Button variant="secondary" onClick={() => void refetch()}>
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {/* Skeleton while first load */}
      {state.status === 'pending' && !emp ? <ProfileSkeleton /> : null}

      {emp ? (
        <div className="flex flex-col gap-5">
          {/* ── Hero header ── */}
          <Card className="p-6">
            <div className="flex flex-wrap items-start gap-5">
              <Avatar
                initials={initialsOf(emp.first_name, emp.last_name)}
                photo={emp.photo}
                size={40}
                className="h-16 w-16 text-[22px]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-[20px] font-bold text-ink">
                    {emp.first_name} {emp.last_name}
                  </h2>
                  {emp.first_name_ar || emp.last_name_ar ? (
                    <span className="text-body-sm text-ink-muted" dir="rtl">
                      {emp.first_name_ar} {emp.last_name_ar}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                      EMP_STATUS_CLASSES[emp.status],
                    )}
                  >
                    {t(`employees.status.${emp.status}`)}
                  </span>
                </div>
                <p className="mt-1 text-body-sm text-ink-muted">{emp.job_position?.title ?? '—'}</p>
                <div className="mt-3 flex flex-wrap gap-5 text-body-sm text-ink-muted">
                  <span>
                    <span className="text-ink-faint">{t('employees.table.id')}: </span>
                    <span className="nums font-mono text-[12px] font-semibold text-ink">
                      {emp.employee_number}
                    </span>
                  </span>
                  {emp.email ? (
                    <span>
                      <span className="text-ink-faint">{t('employees.form.email')}: </span>
                      <span className="text-ink">{emp.email}</span>
                    </span>
                  ) : null}
                  {emp.department ? (
                    <span>
                      <span className="text-ink-faint">{t('employees.table.department')}: </span>
                      <span className="text-ink">{emp.department.name}</span>
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </Card>

          {/* ── Info cards grid ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Personal info */}
            <Card className="p-5">
              <SectionTitle>{t('employeeProfile.section.personal')}</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label={t('employees.form.gender')} value={emp.gender ? t(`employees.form.gender.${emp.gender}`) : '—'} />
                <InfoRow label={t('employeeProfile.field.dateOfBirth')} value={fmt(emp.date_of_birth)} />
                <InfoRow label={t('employeeProfile.field.nationality')} value={emp.nationality ?? '—'} />
                <InfoRow label={t('employees.form.maritalStatus')} value={emp.marital_status ? t(`employees.form.maritalStatus.${emp.marital_status}`) : '—'} />
                <InfoRow label={t('employees.form.phone')} value={emp.phone ?? '—'} />
                <InfoRow label={t('employeeProfile.field.personalEmail')} value={emp.personal_email ?? '—'} />
                <div className="col-span-2">
                  <InfoRow label={t('employeeProfile.field.address')} value={emp.address ?? '—'} />
                </div>
              </div>
            </Card>

            {/* Employment info */}
            <Card className="p-5">
              <SectionTitle>{t('employeeProfile.section.employment')}</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label={t('employees.form.joiningDate')} value={fmt(emp.joining_date)} />
                <InfoRow label={t('employees.form.employmentType')} value={t(`employees.form.employmentType.${emp.employment_type}`)} />
                <InfoRow label={t('employees.form.workLocation')} value={t(`employees.form.workLocation.${emp.work_location}`)} />
                <InfoRow label={t('employees.form.branch')} value={emp.branch?.name ?? '—'} />
                <InfoRow label={t('employeeProfile.field.jobGrade')} value={emp.job_grade?.name ?? '—'} />
                <InfoRow
                  label={t('employeeProfile.field.directManager')}
                  value={emp.direct_manager ? `${emp.direct_manager.first_name} ${emp.direct_manager.last_name}` : '—'}
                />
                {emp.probation_end_date ? (
                  <InfoRow label={t('employeeProfile.field.probationEnd')} value={fmt(emp.probation_end_date)} />
                ) : null}
                {emp.termination_date ? (
                  <InfoRow label={t('employeeProfile.field.terminationDate')} value={fmt(emp.termination_date)} />
                ) : null}
              </div>
            </Card>
          </div>

          {/* ── Tabs section ── */}
          <Card>
            <TabBar active={activeTab} onChange={setActiveTab} />
            {activeTab === 'contracts' && <ContractsTab employeeId={employeeId} />}
            {activeTab === 'documents' && <DocumentsTab employeeId={employeeId} />}
            {activeTab === 'leave' && <LeaveTab employeeId={employeeId} />}
            {activeTab === 'attendance' && <AttendanceTab employeeId={employeeId} />}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
