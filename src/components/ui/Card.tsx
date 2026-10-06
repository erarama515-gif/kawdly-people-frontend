import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** Base white card: 12px radius, 1px border, surface fill. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-[3px] border border-hairline bg-surface', className)} {...props} />;
}