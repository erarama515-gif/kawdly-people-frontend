import { cn } from '@/lib/cn';

const STRIP_DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Decision-count readout: each digit lives in a vertical strip that rolls the
 * changed digit to its new position over 480ms (motion tokens). Reduced-motion
 * snaps instantly via the global media query.
 */
export function RollingNumber({ value, className }: { value: number; className?: string }) {
  const digits = String(Math.max(0, value)).split('');
  return (
    <span
      className={cn('nums inline-flex items-center align-baseline', className)}
      dir="ltr"
      aria-label={String(value)}
    >
      {digits.length === 0 ? (
        <RollingDigit digit={0} />
      ) : (
        digits.map((digit, index) => <RollingDigit key={index} digit={Number(digit)} />)
      )}
    </span>
  );
}

function RollingDigit({ digit }: { digit: number }) {
  return (
    <span className="inline-flex h-[1em] w-[1ch] flex-col overflow-hidden">
      <span
        className="flex flex-col"
        style={{
          transform: `translateY(-${digit * 100}%)`,
          transition: 'transform 480ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {STRIP_DIGITS.map((n) => (
          <span key={n} className="h-[1em] leading-none">
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}