import { forwardRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

/** `forwardRef` so react-hook-form's `register()` can attach its ref directly. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'min-h-[80px] rounded-[3px] border bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint',
        'focus:outline-none focus:ring-1 focus:ring-navy/40',
        'disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-ink-faint',
        invalid ? 'border-coral focus:ring-coral/40' : 'border-hairline',
        className,
      )}
      {...props}
    />
  );
});
