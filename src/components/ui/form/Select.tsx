import { forwardRef } from 'react';
import type { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

/** `forwardRef` so react-hook-form's `register()` can attach its ref directly. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'h-9 w-full appearance-none rounded-[3px] border bg-surface px-3 pe-8 text-[13px] text-ink',
          'focus:outline-none focus:ring-1 focus:ring-navy/40',
          'disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-ink-faint',
          invalid ? 'border-coral focus:ring-coral/40' : 'border-hairline',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </div>
  );
});
