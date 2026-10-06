import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface PageHeaderProps {
  title: string;
  /** Reserved for future page level actions (rendered on the inline end). */
  actions?: ReactNode | undefined;
  className?: string | undefined;
}

export function PageHeader({ title, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-8 flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="text-page-title text-ink">{title}</h1>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}