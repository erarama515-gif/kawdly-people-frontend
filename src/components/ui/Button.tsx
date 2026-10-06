import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Shows a spinner in place of the leading icon and disables the button. */
  isLoading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'border-[1.5px] border-navy bg-navy text-on-navy hover:bg-navy-deep disabled:border-hairline disabled:bg-surface-hover disabled:text-ink-faint',
  secondary:
    'border border-hairline bg-surface text-ink hover:border-navy/40 hover:text-navy disabled:text-ink-faint',
  danger:
    'border-[1.5px] border-coral bg-coral text-on-navy hover:bg-coral-hover disabled:border-hairline disabled:bg-surface-hover disabled:text-ink-faint',
  ghost: 'border border-transparent bg-transparent text-ink-muted hover:bg-surface-hover hover:text-ink',
};

/** Shared action button — the single place every modal/form/toolbar button's chrome is defined. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', isLoading, disabled, className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-[3px] px-4 text-[13px] font-semibold transition-colors',
        'disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} aria-hidden="true" /> : null}
      {children}
    </button>
  );
});
