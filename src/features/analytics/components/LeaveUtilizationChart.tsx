import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { userFacingMessage } from '@/lib/api/errors';
import { useLeaveUtilization } from '../api/queries';

// ─── Colour palette ──────────────────────────────────────────────────────────

const COLOURS = [
  '#1B2559', // navy
  '#10B981', // emerald
  '#F59E0B', // amber
  '#0EA5E9', // sky
  '#8B5CF6', // violet
  '#FF6B6B', // coral
  '#EC4899', // pink
];

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
      <p className="mb-0.5 text-[11px] font-medium text-ink">{label}</p>
      <p className="text-[13px] font-semibold text-ink">
        {payload[0].value.toLocaleString()} {t('analytics.charts.days')}
      </p>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LeaveUtilizationChart() {
  const { t } = useTranslation();
  const { state } = useLeaveUtilization();

  const title = t('analytics.charts.leaveUtilization');
  const subtitle = t('analytics.charts.leaveUtilizationSub');

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
    name: item.leave_type,
    days: item.days_used,
  }));

  const isEmpty = chartData.length === 0;

  // Compute chart height proportional to number of items (min 160, capped at 320)
  const chartHeight = Math.min(320, Math.max(160, chartData.length * 40));

  return (
    <Card className="flex flex-col">
      {header}
      <div className="p-4">
        {isEmpty ? (
          <p className="py-10 text-center text-body-sm text-ink-faint">
            {t('analytics.charts.noData')}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E7EC" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: '#8A94A6' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: '#555E73' }}
                axisLine={false}
                tickLine={false}
                width={110}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="days" radius={[0, 2, 2, 0]} maxBarSize={20}>
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLOURS[index % COLOURS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
