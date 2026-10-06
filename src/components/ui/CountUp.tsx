import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

function formatValue(value: number, decimals: number): string {
  return decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
}

/**
 * Counts from 0 to `value` over `duration` with an ease-out cubic curve.
 * Restarts whenever `value` changes; reduced-motion renders the final value.
 */
export function CountUp({
  value,
  duration = 1000,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(0);

  const decimals = Number.isInteger(value) ? 0 : String(value).split('.')[1]?.length ?? 1;

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);

  return (
    <span className={className ?? 'nums inline-block'} dir="ltr">
      {formatValue(display, decimals)}
    </span>
  );
}