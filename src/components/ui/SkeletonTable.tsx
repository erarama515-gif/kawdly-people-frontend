import { cn } from '@/lib/cn';
import { Card } from './Card';
import { Skeleton } from './Skeleton';

// Width distribution for skeleton rows — varies per column index to look organic.
const COL_WIDTHS = ['35%', '22%', '18%', '15%', '12%'];

interface SkeletonTableProps {
  /** Number of skeleton rows to display (default: 5). */
  rows?: number;
  /** Number of columns per row (default: 4). */
  columns?: number;
  className?: string;
}

/**
 * Animated skeleton placeholder for table/list loading states.
 *
 * Shows a header-bar skeleton followed by `rows` skeleton rows, each with
 * `columns` bars of varying width. Replaces the "Loading..." text that
 * previously occupied the initial-load state in every list page.
 */
export function SkeletonTable({ rows = 5, columns = 4, className }: SkeletonTableProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Header row */}
      <div className="flex items-center gap-4 border-b border-hairline bg-surface px-5 py-3">
        {Array.from({ length: columns }, (_, c) => (
          <Skeleton key={c} className="h-3" style={{ width: c === 0 ? '30%' : '18%' }} />
        ))}
      </div>

      {/* Data rows */}
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 border-b border-hairline px-5 py-3.5 last:border-b-0"
        >
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton
              key={c}
              className="h-3"
              style={{ width: COL_WIDTHS[(c + r) % COL_WIDTHS.length] }}
            />
          ))}
        </div>
      ))}
    </Card>
  );
}

interface SkeletonKpiStripProps {
  /** Number of KPI card skeletons (default: 4). */
  count?: number;
  className?: string;
}

/**
 * Skeleton placeholder for a row of KPI metric cards.
 */
export function SkeletonKpiStrip({ count = 4, className }: SkeletonKpiStripProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-4', className)}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="flex flex-col gap-2 px-5 pb-4 pt-4">
          <Skeleton className="h-3 w-[60%]" />
          <Skeleton className="h-7 w-[45%]" />
          <Skeleton className="h-2.5 w-[40%]" />
        </Card>
      ))}
    </div>
  );
}
