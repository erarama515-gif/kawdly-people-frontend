import { cn } from '@/lib/cn';
import type { SortDirection, SortState } from '@/hooks/useSort';

interface SortableHeaderProps<K extends string> {
  column: K;
  label: string;
  sort: SortState<K>;
  onSort: (column: K) => void;
  className?: string;
}

/**
 * A clickable table column header with sort direction indicator.
 *
 * Renders the standard caption-style header text; when active, shows
 * an ascending (▲) or descending (▼) arrow next to the label.
 */
export function SortableHeader<K extends string>({
  column,
  label,
  sort,
  onSort,
  className,
}: SortableHeaderProps<K>) {
  const isActive = sort.column === column;

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={cn(
        'flex items-center gap-1 text-caption font-semibold uppercase tracking-wide transition-colors',
        isActive ? 'text-navy' : 'text-ink-faint hover:text-ink-muted',
        className,
      )}
    >
      <span>{label}</span>
      <SortArrow direction={isActive ? sort.direction : null} />
    </button>
  );
}

function SortArrow({ direction }: { direction: SortDirection | null }) {
  return (
    <span
      className={cn(
        'inline-flex flex-col text-[8px] leading-[1]',
        direction === null && 'opacity-0 group-hover:opacity-40',
      )}
      aria-hidden="true"
    >
      <span className={cn(direction === 'asc' ? 'text-navy' : 'text-ink-faint/40')}>▲</span>
      <span className={cn(direction === 'desc' ? 'text-navy' : 'text-ink-faint/40')}>▼</span>
    </span>
  );
}
