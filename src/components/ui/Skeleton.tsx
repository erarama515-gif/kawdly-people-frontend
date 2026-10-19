import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block animate-pulse rounded-[2px] bg-[#e3e7ec]',
        className,
      )}
      {...props}
    />
  );
}
