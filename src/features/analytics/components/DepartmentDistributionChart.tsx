import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { userFacingMessage } from '@/lib/api/errors';
import { useDepartmentDistribution } from '../api/queries';

// ─── Colour palette ──────────────────────────────────────────────────────────

const COLOURS = [
  '#1B2559', // navy
  '#FF6B6B', // coral
  '#10B981', // emerald
  '#F59E0B', // amber
  '#0EA5E9', // sky
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
];

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; payload: { name: string; value: number } }[];
}

function ChartTooltip({ active, payload }: TooltipProps) {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload;
  return (
    <div className="rounded-[4px] border border-divider bg-surface px-3 py-2 shadow-md">
      <p className="mb-0.5 text-[11px] font-medium text-ink">{name}</p>
      <p className="text-[13px] font-semibold text-ink">
        {value.toLocaleString()} {t('analytics.charts.employees')}
      </p>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DepartmentDistributionChart() {
  const { t } = useTranslation();
  const { state } = useDepartmentDistribution();

  const title = t('analytics.charts.deptDistribution');
  const subtitle = t('analytics.charts.deptDistributionSub');

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

  const chartData = state.data.data;
  const isEmpty = chartData.length === 0 || chartData.every((d) => d.value === 0);

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
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="45%"
                innerRadius={52}
                outerRadius={76}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLOURS[index % COLOURS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span style={{ fontSize: 11, color: '#555E73' }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
