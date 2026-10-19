import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { userFacingMessage } from '@/lib/api/errors';
import { useHeadcountTrend } from '../api/queries';

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[4px] border border-divider bg-surface px-3 py-2 shadow-md">
      <p className="mb-0.5 text-[11px] text-ink-muted">{label}</p>
      <p className="text-[13px] font-semibold text-ink">
        {payload[0].value.toLocaleString()} {t('analytics.charts.employees')}
      </p>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

/** Formats "YYYY-MM" → short month label like "Jan", "Feb" */
function shortMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month - 1).toLocaleString('default', { month: 'short' });
}

export function HeadcountTrendChart() {
  const { t } = useTranslation();
  const { state } = useHeadcountTrend();

  const title = t('analytics.charts.headcountTrend');
  const subtitle = t('analytics.charts.headcountTrendSub');

  const header = (
    <div className="border-b border-divider px-5 py-3.5">
      <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
      <p className="mt-0.5 text-caption text-ink-muted">{subtitle}</p>
    </div>
  );

  if (state.error) {
    return (
      <Card className="flex flex-col">
        {header}
        <div className="px-5 py-6 text-body-sm text-coral">{userFacingMessage(state.error)}</div>
      </Card>
    );
  }

  if (state.status === 'pending' || !state.data) {
    return (
      <Card className="flex flex-col">
        {header}
        <div className="flex flex-col gap-2 px-5 py-4">
          <Skeleton className="h-[160px] w-full" />
        </div>
      </Card>
    );
  }

  const chartData = state.data.data.map((item) => ({
    month: shortMonth(item.month),
    headcount: item.headcount,
  }));

  const isEmpty = chartData.every((d) => d.headcount === 0);

  return (
    <Card className="flex flex-col">
      {header}
      <div className="p-4">
        {isEmpty ? (
          <p className="py-10 text-center text-body-sm text-ink-faint">
            {t('analytics.charts.noData')}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="headcountGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1B2559" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#1B2559" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E7EC" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#8A94A6' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#8A94A6' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="headcount"
                stroke="#1B2559"
                strokeWidth={2}
                fill="url(#headcountGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#1B2559' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
