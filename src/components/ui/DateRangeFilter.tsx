import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface DateRange {
  from: string; // ISO date string (YYYY-MM-DD)
  to: string;
}

interface DateRangeFilterProps {
  value: DateRange | null;
  onChange: (range: DateRange | null) => void;
  className?: string;
}

/**
 * Date-range picker: two native date inputs (from / to) with a clear button.
 *
 * Uses native `<input type="date">` for reliability and accessibility —
 * no third-party date picker dependency. The clear button resets both fields
 * and emits `null` to the parent.
 */
export function DateRangeFilter({ value, onChange, className }: DateRangeFilterProps) {
  const { t } = useTranslation();
  const [from, setFrom] = useState(value?.from ?? '');
  const [to, setTo] = useState(value?.to ?? '');

  const emit = useCallback(
    (newFrom: string, newTo: string) => {
      if (newFrom && newTo) {
        onChange({ from: newFrom, to: newTo });
      } else if (!newFrom && !newTo) {
        onChange(null);
      }
      // If only one is set, don't emit yet — wait for the other
    },
    [onChange],
  );

  const handleFromChange = (val: string) => {
    setFrom(val);
    emit(val, to);
  };

  const handleToChange = (val: string) => {
    setTo(val);
    emit(from, val);
  };

  const handleClear = () => {
    setFrom('');
    setTo('');
    onChange(null);
  };

  const isActive = from !== '' || to !== '';

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Calendar className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />

      <label className="flex items-center gap-1.5">
        <span className="text-caption text-ink-muted">{t('common.from')}</span>
        <input
          type="date"
          value={from}
          onChange={(e) => handleFromChange(e.target.value)}
          max={to || undefined}
          className="rounded-[3px] border border-hairline bg-surface px-2 py-1 text-caption text-ink outline-none focus:border-navy"
        />
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-caption text-ink-muted">{t('common.to')}</span>
        <input
          type="date"
          value={to}
          onChange={(e) => handleToChange(e.target.value)}
          min={from || undefined}
          className="rounded-[3px] border border-hairline bg-surface px-2 py-1 text-caption text-ink outline-none focus:border-navy"
        />
      </label>

      {isActive && (
        <button
          type="button"
          onClick={handleClear}
          className="flex items-center gap-1 rounded-[3px] px-2 py-1 text-caption text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
          title={t('common.clearFilter')}
        >
          <X className="h-3 w-3" strokeWidth={2} />
          <span>{t('common.clear')}</span>
        </button>
      )}
    </div>
  );
}
