import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { CalendarDays, Clock3, Receipt, RefreshCw, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { CountUp } from '@/components/ui/CountUp';
import { cn } from '@/lib/cn';
import { formatAmount } from '@/lib/salary';
import type { SessionUser, Role } from '@/auth/session';
import type {
  AttendanceSummary,
  DashboardDataset,
  DashboardQuickAction,
  Kpi,
  MyLeaveRequest,
  MyPayslipSummary,
  QueueId,
} from '../model';
import { FooterBar } from './FooterBar';
import { HeroHeader } from './HeroHeader';

interface SelfDashboardProps {
  data: DashboardDataset;
  user: SessionUser;
  role: Role;
  roleLabel: string;
  today: string;
  language: 'ar' | 'en';
  onRefresh: () => void;
  isFetching: boolean;
}

/**
 * Personal dashboard for employees and every other non-admin/non-manager role.
 *
 * It only renders fields from the `self` dataset: personal leave balance,
 * pending requests, today's attendance and the latest payslip. There is no
 * company headcount, payroll cost, org treemap or decision queue here, by
 * design - the API does not send them for this mode (F-01/P0).
 */
export function SelfDashboard({
  data,
  user,
  role,
  roleLabel,
  today,
  language,
  onRefresh,
  isFetching,
}: SelfDashboardProps) {
  const { t } = useTranslation();
  const requests = data.myRequests ?? [];
  const quickActions: DashboardQuickAction[] = data.quickActions ?? [];

  return (
    <div className="flex flex-col">
      <HeroHeader
        user={user}
        role={role}
        roleLabel={roleLabel}
        today={today}
        rows={[]}
        counts={{} as Record<QueueId, number>}
        removing={new Set()}
        actions={quickActions}
      />

      <section
        data-testid="my-kpi-strip"
        className="border-t-[2px] border-b border-hairline bg-hairline"
        style={{ borderTopColor: 'var(--color-ink, #14202e)' }}
      >
        <SelfKpiStrip kpis={data.kpis} language={language} />
      </section>

      <div className="flex items-center justify-end gap-2 bg-page py-2">
        <span className="nums font-mono text-[10px] font-medium text-ink-faint" dir="ltr">
          {t('dashboard.kpi.updatedAt', { time: formatTime(data.updatedAt, language) })} · live
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isFetching}
          aria-label={t('dashboard.kpi.refresh')}
          title={t('dashboard.kpi.refresh')}
          className="grid h-5 w-5 place-items-center rounded-[2px] border-0 bg-transparent text-ink-faint transition-colors duration-150 hover:bg-surface-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RefreshCw className={isFetching ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-2 grid items-start gap-7 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <SectionTitle icon={<CalendarDays className="h-4 w-4" />} title={t('my.dashboard.requests.title')} />
          {requests.length === 0 ? (
            <EmptyState text={t('my.dashboard.requests.empty')} />
          ) : (
            <ul className="divide-y divide-hairline">
              {requests.map((request) => (
                <LeaveRequestRow key={request.id} request={request} language={language} />
              ))}
            </ul>
          )}
          <div className="border-t border-hairline px-4 py-3">
            <Link to="/workforce/leave" className="text-[12px] font-semibold text-navy underline-offset-2 hover:underline">
              {t('my.dashboard.requests.viewAll')}
            </Link>
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden">
            <SectionTitle icon={<Receipt className="h-4 w-4" />} title={t('my.dashboard.payslip.title')} />
            <PayslipCard payslip={data.myPayslip ?? null} language={language} />
          </Card>

          <Card className="overflow-hidden">
            <SectionTitle icon={<Clock3 className="h-4 w-4" />} title={t('my.dashboard.attendance.title')} />
            <AttendanceCard attendance={data.attendance} />
          </Card>
        </div>
      </div>

      <FooterBar />
      <div className="h-10 md:h-14 pb-[env(safe-area-inset-bottom)]" aria-hidden="true" />
    </div>
  );
}

function SelfKpiStrip({ kpis, language }: { kpis: Kpi[]; language: 'ar' | 'en' }) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 bg-hairline lg:grid-cols-4">
      {kpis.map((kpi) => {
        const isAttendance = kpi.id === 'myAttendanceToday';
        const isMoney = kpi.id === 'myLastNetPay';

        return (
          <Link
            key={kpi.id}
            to={kpi.path}
            className="group flex min-h-[132px] flex-col justify-between bg-surface px-4 py-4 transition-colors duration-150 hover:bg-surface-hover md:px-6"
          >
            <span className="text-[11px] font-medium text-ink-muted">{t(kpi.captionKey)}</span>
            <span className="flex items-baseline gap-1.5">
              {isAttendance ? (
                <span className="text-[24px] font-bold leading-none text-ink">
                  {kpi.value > 0 ? t('my.dashboard.present') : t('my.dashboard.notClockedIn')}
                </span>
              ) : (
                <span className="nums text-[30px] font-bold leading-none tracking-[-1px] text-ink">
                  {isMoney ? formatAmount(kpi.value) : <CountUp value={kpi.value} />}
                </span>
              )}
              {kpi.suffix && !isAttendance ? (
                <span className="text-[11px] font-semibold text-ink-muted">{kpi.suffix}</span>
              ) : null}
            </span>
            <span className="text-[11px] text-ink-faint">
              {isAttendance
                ? new Intl.DateTimeFormat(language, { weekday: 'long' }).format(new Date())
                : t(kpi.deltaKey)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-hairline bg-surface px-4 py-3">
      <span className="text-ink-muted" aria-hidden="true">{icon}</span>
      <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="px-4 py-8 text-center text-[12px] text-ink-faint">{text}</p>;
}

function LeaveRequestRow({ request, language }: { request: MyLeaveRequest; language: 'ar' | 'en' }) {
  const { t } = useTranslation();
  const statusLabel = t(`my.requests.status.${request.status}`, { defaultValue: request.status });

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-ink">{request.leaveType}</p>
        <p className="nums mt-0.5 text-[11px] text-ink-muted">
          {formatDate(request.startDate, language)} → {formatDate(request.endDate, language)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="nums text-[11px] text-ink-muted">
          {t('my.dashboard.requests.days', { count: request.days })}
        </span>
        <span
          className={cn(
            'rounded-[2px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            request.status === 'approved' && 'bg-emerald-50 text-emerald-700',
            request.status === 'pending' && 'bg-amber-50 text-amber-700',
            request.status === 'rejected' && 'bg-red-50 text-red-700',
            request.status === 'cancelled' && 'bg-slate-100 text-slate-600',
          )}
        >
          {statusLabel}
        </span>
      </div>
    </li>
  );
}

function PayslipCard({ payslip, language }: { payslip: MyPayslipSummary | null; language: 'ar' | 'en' }) {
  const { t } = useTranslation();

  if (!payslip) {
    return (
      <>
        <EmptyState text={t('my.dashboard.payslip.empty')} />
        <div className="border-t border-hairline px-4 py-3">
          <Link to="/my/payslips" className="text-[12px] font-semibold text-navy underline-offset-2 hover:underline">
            {t('my.dashboard.payslip.viewAll')}
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-end justify-between px-4 py-4">
        <div>
          <p className="text-[11px] text-ink-muted">{formatPeriod(payslip.period, language)}</p>
          <p className="nums mt-1 flex items-baseline gap-1.5 text-[26px] font-bold leading-none text-ink">
            <Wallet className="mb-0.5 h-4 w-4 text-ink-muted" aria-hidden="true" />
            {formatAmount(payslip.net)}
            <span className="text-[11px] font-semibold text-ink-muted">EGP</span>
          </p>
        </div>
        <span className="rounded-[2px] bg-surface-hover px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
          {t(`payroll.payslip.status.${payslip.status}`, { defaultValue: payslip.status })}
        </span>
      </div>
      <div className="border-t border-hairline px-4 py-3">
        <Link to="/my/payslips" className="text-[12px] font-semibold text-navy underline-offset-2 hover:underline">
          {t('my.dashboard.payslip.viewAll')}
        </Link>
      </div>
    </>
  );
}

function AttendanceCard({ attendance }: { attendance: AttendanceSummary }) {
  const { t } = useTranslation();
  const total = attendance.totalEmployees;
  const todayPct = total > 0 ? Math.round((attendance.present / total) * 100) : 0;

  if (total === 0) {
    return <EmptyState text={t('my.dashboard.attendance.empty')} />;
  }

  return (
    <>
      <div className="px-4 py-4">
        <p className="text-[11px] text-ink-muted">{t('my.dashboard.attendance.today')}</p>
        <p className="mt-1 text-[24px] font-bold leading-none text-ink">{todayPct}%</p>
        <div className="mt-3 flex gap-3 text-[11px] text-ink-muted">
          <span className="text-emerald-700">{t('my.dashboard.attendance.present', { count: attendance.present })}</span>
          <span className="text-amber-700">{t('my.dashboard.attendance.late', { count: attendance.late })}</span>
          <span className="text-red-700">{t('my.dashboard.attendance.absent', { count: attendance.absent })}</span>
        </div>
      </div>
      <div className="border-t border-hairline px-4 py-3">
        <Link to="/workforce/attendance" className="text-[12px] font-semibold text-navy underline-offset-2 hover:underline">
          {t('my.dashboard.attendance.viewAll')}
        </Link>
      </div>
    </>
  );
}

function formatDate(value: string, language: 'ar' | 'en'): string {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(date);
}

function formatPeriod(value: string, language: 'ar' | 'en'): string {
  if (!value) return '—';
  const date = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' }).format(date);
}

function formatTime(iso: string, language: 'ar' | 'en'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }).format(date);
}
