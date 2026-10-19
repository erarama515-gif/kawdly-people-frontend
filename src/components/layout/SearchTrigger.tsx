import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/stores/ui-store';

/** Compact search pill matching the new 44px top-bar design. */
export function SearchTrigger() {
  const { t } = useTranslation();
  const setCommandPaletteOpen = useUiStore((state) => state.setCommandPaletteOpen);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <button
      type="button"
      onClick={() => setCommandPaletteOpen(true)}
      aria-label={t('topbar.search')}
      className="hidden items-center gap-6 border border-on-navy-border-35 px-3.5 py-1 text-[11px] text-on-navy-muted-85 transition-colors duration-150 hover:border-on-navy-border-50 md:flex"
    >
      <span className="whitespace-nowrap">{t('topbar.searchPlaceholder')}</span>
      <kbd className="nums font-mono text-[10px] border border-on-navy-border-50 px-1.5 leading-[18px]">
        {isMac ? '⌘K' : 'Ctrl K'}
      </kbd>
    </button>
  );
}
