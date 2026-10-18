import type { LucideIcon } from 'lucide-react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

export interface BulkAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: 'danger';
}

export interface BulkActionBarProps {
  selectedCount: number;
  onDeselectAll: () => void;
  actions: BulkAction[];
}

/**
 * Floating bar that rises from the bottom of the viewport whenever one or more
 * rows are selected.  Uses a CSS-transition-based slide-up / slide-down so it
 * works without any animation library.  The bar is RTL-aware via `start`/`end`
 * logical properties.
 */
export function BulkActionBar({ selectedCount, onDeselectAll, actions }: BulkActionBarProps) {
  const { t } = useTranslation();

  const visible = selectedCount > 0;

  return (
    <div
      role="toolbar"
      aria-label={t('common.selected', { count: selectedCount })}
      className={cn(
        // Positioning: fixed, centred horizontally, above bottom edge
        'fixed bottom-6 start-1/2 z-50 -translate-x-1/2',
        // RTL: logical transform handled by Tailwind's RTL variant is not needed
        // because we centre with translate — explicit override below handles RTL
        '[dir=rtl]:[--tw-translate-x:50%]',
        // Layout
        'flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg',
        // Design tokens
        'bg-navy text-on-navy',
        // Slide animation
        'transition-all duration-300 ease-out',
        visible
          ? 'translate-y-0 opacity-100 pointer-events-auto'
          : 'translate-y-10 opacity-0 pointer-events-none',
      )}
    >
      {/* Selected count */}
      <span className="whitespace-nowrap text-sm font-semibold">
        {t('common.selected', { count: selectedCount })}
      </span>

      {/* Divider */}
      <span className="h-4 w-px bg-white/20" aria-hidden="true" />

      {/* Action buttons */}
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
              'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
              action.variant === 'danger'
                ? 'bg-coral/20 hover:bg-coral/40 text-red-200'
                : 'bg-white/10 hover:bg-white/20 text-on-navy',
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            {action.label}
          </button>
        );
      })}

      {/* Divider */}
      <span className="h-4 w-px bg-white/20" aria-hidden="true" />

      {/* Deselect all */}
      <button
        type="button"
        onClick={onDeselectAll}
        aria-label={t('common.deselectAll')}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-lg',
          'bg-white/10 hover:bg-white/20 transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
        )}
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}

// Re-export Button so pages don't need to import it separately — not needed here,
// but keeps the public surface clean.
export type { BulkActionBarProps as default };
