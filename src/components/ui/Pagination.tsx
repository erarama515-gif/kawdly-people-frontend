import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Button } from './Button';

/**
 * Page controls for any list backed by the backend's `{current_page, per_page,
 * total, last_page}` envelope (see `EmployeeApi.list` and every other module's
 * `index` action). Deliberately dumb — it only reports the page the caller
 * should fetch next; the query hook owns actually fetching it.
 */

export interface PaginationProps {
  currentPage: number;
  lastPage: number;
  total: number;
  perPage: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ currentPage, lastPage, total, perPage, onPageChange, className }: PaginationProps) {
  const { t } = useTranslation();

  if (total === 0) return null;

  const from = (currentPage - 1) * perPage + 1;
  const to = Math.min(currentPage * perPage, total);
  const canPrev = currentPage > 1;
  const canNext = currentPage < lastPage;

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 px-1 py-3', className)}>
      <span className="nums text-caption text-ink-muted">
        {t('common.pagination.range', { from, to, total })}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canPrev}
          aria-label={t('common.pagination.previous')}
          className="h-8 w-8 px-0"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </Button>
        <span className="nums px-1 text-caption text-ink">
          {t('common.pagination.page', { page: currentPage, lastPage })}
        </span>
        <Button
          variant="secondary"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canNext}
          aria-label={t('common.pagination.next')}
          className="h-8 w-8 px-0"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
