import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/cn';
import { formatAmount } from '@/lib/salary';
import { userFacingMessage } from '@/lib/api/errors';
import { useSession } from '@/auth/session';
import { resolveLocaleText } from '@/features/dashboard/model';
import { usePayslip } from '@/features/payroll/api/queries';
import type { PayslipStatus } from '@/features/payroll/api/resource';
import type { PayslipItemWire } from '@/features/payroll/api/schema';

const STATUS_STYLES: Record<PayslipStatus, string> = {
  draft: 'bg-surface text-ink-muted border border-divider',
  finalized: 'bg-sky-50 text-sky-700',
  paid: 'bg-emerald-100 text-emerald-800',
};

/**
 * F-04: employee self-service payslip detail.
 *
 * Fetches one payslip via `GET /payslips/{id}?include=employee,payslipItems`.
 * The backend scopes the row to the authenticated employee and strips salary
 * fields this role may not see (only `net_salary` survives for `employee`);
 * those render as the restricted dash via `formatAmount`.
 */
export function MyPayslipDetailPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'en' ? 'en' : 'ar';
  const { id } = useParams<{ id: string }>();
  const payslipId = id && /^\d+$/.test(id) ? Number(id) : undefined;
  const { user } = useSession();
  const { state } = usePayslip(payslipId);

  const payslip = state.data;
  const me = user?.name ? resolveLocaleText(user.name, language) : '';

  return (
    <div className="flex flex-col">
      <Link
        to="/my/payslips"
        className="mb-4 inline-flex w-max items-center gap-1.5 text-caption font-semibold text-navy hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        {t('my.payslip.back')}
      </Link>

      <PageHeader title={t('my.payslip.title')} />

      {state.error ? (
        <p className="mb-4 text-body-sm text-coral">{userFacingMessage(state.error)}</p>
      ) : null}

      {state.status === 'pending' && !payslip ? (
        <p className="py-10 text-center text-body-sm text-ink-muted">{t('common.loading')}</p>
      ) : null}

      {!state.error && payslip ? (
        <>
          <Card className="p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-caption text-ink-muted">{t('my.payslip.for')} {me}</p>
                <p className="mt-1 text-body font-semibold text-ink">
                  {formatPeriod(payslip, language)}
                </p>
              </div>
              <StatusBadge status={payslip.status} />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-divider pt-5 md:grid-cols-4">
              <SummaryCell label={t('my.payslip.gross')} value={payslip.gross_salary} accent="text-ink" />
              <SummaryCell
                label={t('my.payslip.earnings')}
                value={payslip.total_earnings}
                accent="text-ink"
              />
              <SummaryCell
                label={t('my.payslip.deductions')}
                value={payslip.total_deductions}
                accent="text-coral"
              />
              <SummaryCell
                label={t('my.payslip.net')}
                value={payslip.net_salary}
                accent="text-navy"
                emphasis
              />
            </div>
          </Card>

          <h2 className="mb-3 mt-8 text-body font-semibold text-ink">
            {t('my.payslip.breakdownTitle')}
          </h2>
          <Card className="overflow-hidden">
            {(payslip.payslipItems ?? []).length === 0 ? (
              <p className="px-5 py-8 text-center text-body-sm text-ink-muted">
                {t('my.payslip.breakdownEmpty')}
              </p>
            ) : (
              <BreakdownTable items={payslip.payslipItems ?? []} />
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}

function SummaryCell({
  label,
  value,
  accent,
  emphasis,
}: {
  label: string;
  value: number | undefined;
  accent: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <p className="text-caption text-ink-faint">{label}</p>
      <p
        className={cn(
          'nums mt-1 font-mono text-[18px] font-bold leading-none',
          accent,
          emphasis && 'text-[24px]',
        )}
      >
        {value !== undefined ? (
          <span className="inline-flex items-center gap-1.5">
            <Wallet className="h-4 w-4 text-ink-muted" aria-hidden="true" />
            {formatAmount(value)}
          </span>
        ) : (
          formatAmount(value)
        )}
        <span className="ml-1 text-[11px] font-semibold text-ink-muted">EGP</span>
      </p>
    </div>
  );
}

function BreakdownTable({ items }: { items: PayslipItemWire[] }) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="hidden grid-cols-[minmax(0,1fr)_90px_90px_auto] border-b border-divider px-5 py-2.5 md:grid">
        {(['description', 'type', 'amount', ''] as const).map((col) => (
          <span
            key={col}
            className="text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted"
          >
            {col ? t(`my.payslip.${col}`) : ''}
          </span>
        ))}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          className="grid grid-cols-2 items-center gap-3 border-b border-divider px-5 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_90px_90px_auto]"
        >
          <span className="truncate text-body-sm font-medium text-ink">{item.description}</span>
          <span
            className={cn(
              'justify-self-start rounded-[2px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              item.type === 'earning' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
            )}
          >
            {t(`my.payslip.types.${item.type}`, { defaultValue: item.type })}
          </span>
          <span
            className={cn(
              'nums font-mono text-body-sm',
              item.type === 'deduction' ? 'text-coral' : 'text-ink',
            )}
          >
            {formatAmount(item.amount)} <span className="text-[10px] text-ink-muted">EGP</span>
          </span>
          <span className="hidden md:block" />
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: PayslipStatus | undefined }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'rounded-[2px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        STATUS_STYLES[status ?? 'draft'],
      )}
    >
      {t(`payroll.payslip.status.${status ?? 'draft'}`, { defaultValue: status ?? 'draft' })}
    </span>
  );
}

function formatPeriod(payslip: { updated_at?: string; created_at?: string; id: number }, language: 'ar' | 'en'): string {
  const ts = new Date(payslip.updated_at ?? payslip.created_at ?? '');
  if (Number.isNaN(ts.getTime())) return `#${payslip.id}`;
  return new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' }).format(ts);
}