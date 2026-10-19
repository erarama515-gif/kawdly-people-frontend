import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useLeaveBalance } from '../api/balanceQueries';
import type { LeaveBalanceItem } from '../api/balanceQueries';

// ── Colour helpers ────────────────────────────────────────────────────────────

/**
 * Returns a Tailwind progress-bar colour class based on how much of the
 * allocation is remaining:
 *   > 60% remaining → green
 *   30–60% remaining → amber
 *   < 30% remaining → red
 */
function progressColor(allocated: number, remaining: number): string {
  if (allocated <= 0) return 'bg-slate-300';
  const pct = remaining / allocated;
  if (pct > 0.6) return 'bg-emerald-500';
  if (pct > 0.3) return 'bg-amber-400';
  return 'bg-coral';
}

function progressTrackColor(allocated: number, remaining: number): string {
  if (allocated <= 0) return 'bg-slate-100';
  const pct = remaining / allocated;
  if (pct > 0.6) return 'bg-emerald-100';
  if (pct > 0.3) return 'bg-amber-100';
  return 'bg-red-100';
}

// ── Leave type name key mapping ───────────────────────────────────────────────

const TYPE_I18N_KEY: Record<string, string> = {
  Annual:   'leave.balance.annual',
  Sick:     'leave.balance.sick',
  Personal: 'leave.balance.personal',
  Unpaid:   'leave.balance.unpaid',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function BalanceRow({ item }: { item: LeaveBalanceItem }) {
  const { t } = useTranslation();

  const total    = item.allocated + item.carried_over;
  const usedPct  = total > 0 ? Math.min(1, item.used / total) * 100 : 0;
  const i18nKey  = TYPE_I18N_KEY[item.leave_type_name] ?? 'leave.balance.annual';
  const label    = t(i18nKey, { defaultValue: item.leave_type_name });

  return (
    <div className="flex flex-col gap-1.5 py-3">
      {/* Type name + remaining days */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {item.color ? (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
          ) : null}
          <span className="text-body-sm font-semibold text-ink">{label}</span>
        </div>
        <span className="nums text-[12px] font-mono text-ink-muted">
          {item.remaining.toFixed(1)}{' '}
          <span className="text-ink-faint">{t('leave.balance.remaining')}</span>
        </span>
      </div>

      {/* Progress bar */}
      <div
        className={cn('h-1.5 w-full rounded-full overflow-hidden', progressTrackColor(total, item.remaining))}
        role="progressbar"
        aria-valuenow={usedPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn('h-full rounded-full transition-all', progressColor(total, item.remaining))}
          style={{ width: `${usedPct.toFixed(1)}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="flex gap-4 text-caption text-ink-faint">
        <span>
          <span className="text-ink-muted font-medium">{t('leave.balance.allocated')}: </span>
          <span className="nums font-mono text-[11px] text-ink">{item.allocated.toFixed(1)}</span>
          {item.carried_over > 0 ? (
            <span className="ml-1 text-[10px] text-ink-faint">
              (+{item.carried_over.toFixed(1)} carried)
            </span>
          ) : null}
        </span>
        <span>
          <span className="text-ink-muted font-medium">{t('leave.balance.used')}: </span>
          <span className="nums font-mono text-[11px] text-ink">{item.used.toFixed(1)}</span>
        </span>
      </div>
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

export interface LeaveBalanceCardProps {
  employeeId: number;
  year?: number;
  className?: string;
}

export function LeaveBalanceCard({ employeeId, year, className }: LeaveBalanceCardProps) {
  const { t } = useTranslation();
  const { state } = useLeaveBalance(employeeId, year);

  if (state.status === 'pending') {
    return (
      <Card className={cn('p-5', className)}>
        <Skeleton className="mb-4 h-4 w-36" />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="flex justify-between">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3.5 w-16" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (state.status === 'error' || !state.data) {
    return null;
  }

  const summary = state.data;
  const displayYear = summary.year;

  // Filter out leave types with zero allocation and no usage (e.g. Unpaid with 0 days)
  const items = summary.balances.filter((b) => b.allocated > 0 || b.used > 0 || b.remaining > 0);

  if (items.length === 0) {
    return null;
  }

  return (
    <Card className={cn('p-5', className)}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-faint">
          {t('leave.balance.title')}
        </h2>
        <span className="text-caption text-ink-faint">{displayYear}</span>
      </div>

      {/* Balance rows */}
      <div className="divide-y divide-divider">
        {items.map((item) => (
          <BalanceRow key={item.leave_type_id} item={item} />
        ))}
      </div>
    </Card>
  );
}
