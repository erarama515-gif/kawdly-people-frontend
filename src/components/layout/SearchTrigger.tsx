import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { useUiStore } from '@/stores/ui-store';

/** Navy pill per the reference — looks like a subtle input, opens the command palette. */
export function SearchTrigger() {
  const { t } = useTranslation();
  const setCommandPaletteOpen = useUiStore((state) => state.setCommandPaletteOpen);

  // Platform-aware shortcut hint: "⌘K" on macOS, "Ctrl K" elsewhere.
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <button
      type="button"
      onClick={() => setCommandPaletteOpen(true)}
      aria-label={t('topbar.search')}
      className="flex h-9 w-9 items-center justify-center gap-2 rounded-full border border-[#1F7BB8] bg-transparent text-on-navy-muted-85 transition-colors duration-150 hover:border-on-navy-border-50 hover:text-on-navy md:w-[280px] md:justify-start md:px-4 md:text-start"
    >
      <Search className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span className="hidden min-w-0 flex-1 truncate text-[13px] font-medium text-on-navy-muted-85 md:block">
        {t('topbar.searchPlaceholder')}
      </span>
      <kbd className="nums hidden shrink-0 rounded-full border border-on-navy-border-50 px-2 text-[11px] font-medium leading-5 text-on-navy-muted-85 md:inline-block">
        {isMac ? '⌘K' : 'Ctrl K'}
      </kbd>
    </button>
  );
}