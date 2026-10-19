import { useCallback, useState } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortState<K extends string = string> {
  column: K | null;
  direction: SortDirection;
}

/**
 * Manages sort column + direction. Clicking the same column toggles
 * asc → desc → null (reset); clicking a different column starts at asc.
 */
export function useSort<K extends string = string>(
  initialColumn: K | null = null,
  initialDirection: SortDirection = 'asc',
) {
  const [sort, setSort] = useState<SortState<K>>({
    column: initialColumn,
    direction: initialDirection,
  });

  const toggle = useCallback((column: K) => {
    setSort((prev) => {
      if (prev.column !== column) return { column, direction: 'asc' };
      if (prev.direction === 'asc') return { column, direction: 'desc' };
      return { column: null, direction: 'asc' };
    });
  }, []);

  return { sort, toggle } as const;
}

/**
 * Client-side sort helper. Sorts an array by a nested key path.
 *
 * `accessor` extracts the sort value; falls back to `''` for undefined.
 * Numeric values are compared numerically; strings use `localeCompare`.
 */
export function sortData<T>(
  data: readonly T[],
  sort: SortState,
  accessors: Record<string, (item: T) => string | number | undefined | null>,
): T[] {
  if (!sort.column || !accessors[sort.column]) return [...data];

  const accessor = accessors[sort.column];
  const dir = sort.direction === 'asc' ? 1 : -1;

  return [...data].sort((a, b) => {
    const va = accessor(a) ?? '';
    const vb = accessor(b) ?? '';

    if (typeof va === 'number' && typeof vb === 'number') {
      return (va - vb) * dir;
    }

    return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' }) * dir;
  });
}
