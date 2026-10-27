import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronRight, Receipt } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { cn } from '@/lib/cn';
import { formatAmount } from '@/lib/salary';
import { userFacingMessage } from '@/lib/api/errors';
import { usePayslipList } from '@/features/payroll/api/queries';
import type { PayslipStatus } from '@/features/payroll/api/resource';
import type { PayslipWire } from '@/features/payroll/api/schema';

const PER_PAGE = 20;

const STATUS_STYLES: Record<PayslipStatus, string> = {
  draft: 'bg-surface text-ink-muted border border-divider',
  finalized: 'bg-sky-50 text-sky-700',
  paid: 'bg-emerald-100 text-emerald-800',
};

/**
 * F-04: employee self-service payslip list.
 *
 * Uses the existing `GET /payslips` which the backend scopes to the
 * authenticated employee's own payslips (PayrollScopedQuery). Salary fields
 * the role may not see (e.g. gross/deductions for `employee`) render as the
 * restricted dash via `formatAmount`, exactly like the payroll module (A2.3).
 */
export function MyPayslipsPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'en' ? 'en' : 'ar';
  const [page, setPage] = useState(1);
  const { state } = usePayslipList({ page, perPage: PER_PAGE });

  const payslips = state.data?.data ?? [];
  const meta = state.data?.meta;

  return (
    <div className="flex flex-col">
      <PageHeader title={t('nav.myPayslips')} />

      {state.error ? (
        <p className="mb-4 text-body-sm text-coral">{userFacingMessage(state.error)}</p>
      ) : null}

      {!state.error && payslips.length === 0 && state.status !== 'pending' ? (
        <EmptyState />
      ) : null}

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,2fr)_90px_110px_110px_110px_auto] border-b border-divider px-5 py-2.5 md:grid">
          {(['period', 'gross', 'deductions', 'net', 'status', ''] as const).map((col) => (
            <span
              key={col}
              className="text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted"
            >
              {col ? t(`my.payslips.table.${col}`) : ''}
            </span>
          ))}
        </div>

        {payslips.map((payslip) => (
          <Link
            key={payslip.id}
            to={`/my/payslips/${payslip.id}`}
            className="group grid grid-cols-2 items-center gap-3 border-b border-divider px-5 py-3 last:border-b-0 hover:bg-page md:grid-cols-[minmax(0,2fr)_90px_110px_110px_110px_auto]"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded bg-surface-hover text-navy">
                <Receipt className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="truncate text-body-sm font-semibold text-ink">
                {formatPeriod(payslip, language)}
              </span>
            </div>
            <span className="nums font-mono text-body-sm text-ink">{formatAmount(payslip.gross_salary)}</span>
            <span className="nums font-mono text-body-sm text-coral">
              {formatAmount(payslip.total_deductions)}
            </span>
            <span className="nums font-mono text-body-sm font-bold text-navy">
              {formatAmount(payslip.net_salary)}
            </span>
            <StatusBadge status={payslip.status} />
            <span className="hidden items-center gap-1 text-caption font-semibold text-navy group-hover:underline md:flex">
              {t('my.payslips.view')}
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </Link>
        ))}

        {state.status === 'pending' && payslips.length === 0 ? (
          <p className="px-5 py-8 text-center text-body-sm text-ink-muted">{t('common.loading')}</p>
        ) : null}
      </Card>

      {meta && meta.last_page > 1 ? (
        <div className="mt-4">
          <Pagination
            currentPage={meta.current_page}
            lastPage={meta.last_page}
            total={meta.total}
            perPage={meta.per_page}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: PayslipStatus | undefined }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'justify-self-start rounded-[2px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        STATUS_STYLES[status ?? 'draft'],
      )}
    >
      {t(`payroll.payslip.status.${status ?? 'draft'}`, {
        defaultValue: status ?? 'draft',
      })}
    </span>
  );
}

function formatPeriod(payslip: PayslipWire, language: 'ar' | 'en'): string {
  const ts = new Date(payslip.updated_at ?? payslip.created_at ?? '');
  if (Number.isNaN(ts.getTime())) return `#${payslip.id}`;
  return new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' }).format(ts);
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
      <Receipt className="h-8 w-8 text-ink-faint" aria-hidden="true" />
      <p className="text-body-sm text-ink-muted">{t('my.payslips.empty')}</p>
    </div>
  );
}