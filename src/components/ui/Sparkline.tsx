const GRID_STROKE = '#e3e7ec';

export function Sparkline({
  points,
  lastValue,
}: {
  points: number[];
  lastValue: number;
}) {
  if (points.length === 0) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const width = 240;
  const height = 86;
  const baselineY = 70;
  const topY = 8;
  const stepX = (width - 12) / (points.length - 1 || 1);
  const xs = points.map((_, i) => 6 + i * stepX);

  const path = points
    .map((value, index) => {
      const y = topY + (1 - (value - min) / span) * (baselineY - topY);
      return `${index === 0 ? 'M' : 'L'}${xs[index].toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const lastX = xs[xs.length - 1];
  const lastY = topY + (1 - (lastValue - min) / span) * (baselineY - topY);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 block w-full">
      <path d={`M0 ${baselineY}H${width}M0 0V${baselineY}`} stroke={GRID_STROKE} fill="none" />
      <path d={path} stroke="var(--color-navy)" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={3.5} fill="var(--color-coral)" />
    </svg>
  );
}
