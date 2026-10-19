import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { userFacingMessage } from '@/lib/api/errors';
import { useTurnoverRate } from '../api/queries';

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  payload?: { value: number; payload: { month: string; departures: number; rate: number } }[];
  label?: string;
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  const { departures, rate } = payload[0].payload;
  return (
    <div className="rounded-[4px] border border-divider bg-surface px-3 py-2 shadow-md">
      <p className="mb-1 text-[11px] text-ink-muted">{label}</p>
      <p className="text-[13px] font-semibold text-coral">
        {t('analytics.charts.turnoverRate')}: {rate}%
      </p>
      <p className="text-[11px] text-ink-muted">
        {departures} {t('analytics.charts.departures')}
      </p>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

function shortMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month - 1).toLocaleString('default', { month: 'short' });
}

export function TurnoverRateChart() {
  const { t } = useTranslation();
  const { state } = useTurnoverRate();

  const title = t('analytics.charts.turnoverTrend');
  const subtitle = t('analytics.charts.turnoverTrendSub');

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
    departures: item.departures,
    rate: item.rate,
  }));

  const isEmpty = chartData.every((d) => d.departures === 0);

  return (
    <Card className="flex flex-col">
      {header}
      <div className="p-4">
        {isEmpty ? (
          <p className="py-10 text-center text-body-sm text-ink-faint">
            {t('analytics.charts.noTurnover')}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
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
                unit="%"
                allowDecimals={true}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="rate" fill="#FF6B6B" radius={[2, 2, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
