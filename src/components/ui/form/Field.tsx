import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Label + control + error wrapper shared by every form field. `htmlFor` must
 * match the control's `id` — react-hook-form's `register(name)` sets `name`
 * but not `id`, so callers pass `id={name}` on the control explicitly.
 */

export interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  required?: boolean;
  hint?: string | undefined;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, error, required, hint, children, className }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-caption font-semibold text-ink-muted">
        {label}
        {required ? <span className="text-coral"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-caption text-coral">
          {error}
        </p>
      ) : hint ? (
        <p className="text-caption text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}
