import { useCallback, useEffect, useState } from 'react';

/**
 * Generic multi-select hook for list pages.
 *
 * Pass the current page's items (T must have an `id: number` field).
 * The hook cleans up stale selections automatically whenever the items array
 * changes (e.g. on pagination or filter change).
 */
export function useBulkSelect<T extends { id: number }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Drop any IDs that are no longer in the current page when items change.
  useEffect(() => {
    const currentIds = new Set(items.map((item) => item.id));
    setSelectedIds((prev) => {
      const next = new Set<number>();
      prev.forEach((id) => {
        if (currentIds.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const isSelected = useCallback(
    (id: number) => selectedIds.has(id),
    [selectedIds],
  );

  const toggle = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  }, [items]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedCount = selectedIds.size;
  const isAllSelected = items.length > 0 && selectedCount === items.length;

  return {
    selectedIds,
    isSelected,
    toggle,
    selectAll,
    deselectAll,
    selectedCount,
    isAllSelected,
  };
}
