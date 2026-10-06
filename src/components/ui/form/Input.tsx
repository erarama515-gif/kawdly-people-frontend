import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

/** `forwardRef` so react-hook-form's `register()` can attach its ref directly. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-9 rounded-[3px] border bg-surface px-3 text-[13px] text-ink placeholder:text-ink-faint',
        'focus:outline-none focus:ring-1 focus:ring-navy/40',
        'disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-ink-faint',
        invalid ? 'border-coral focus:ring-coral/40' : 'border-hairline',
        className,
      )}
      {...props}
    />
  );
});
