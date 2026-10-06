import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/stores/ui-store';
import type { Language } from '@/lib/language';

/**
 * Ledger footer bar: closes the content column (matching the KPI strip and
 * trend/queue borders) with the copyright line and Privacy / Support / اللغة
 * links. The language link toggles straight to the other locale.
 */
export function FooterBar() {
  const { t, i18n } = useTranslation();
  const setLanguage = useUiStore((state) => state.setLanguage);
  const otherLanguage: Language = i18n.language === 'en' ? 'ar' : 'en';
  const otherLabel =
    otherLanguage === 'ar' ? t('userMenu.languageArabic') : t('userMenu.languageEnglish');

  return (
    <footer className="flex h-14 items-center justify-between gap-3 border-x border-b border-hairline bg-divider px-4 text-[13px] text-ink-muted md:px-6">
      <span className="truncate">{t('dashboard.footer.copyright')}</span>

      <nav className="flex shrink-0 items-center gap-4 md:gap-5" aria-label="Footer">
        <span className="transition-colors duration-150 hover:text-ink">{t('dashboard.footer.privacy')}</span>
        <span className="transition-colors duration-150 hover:text-ink">{t('dashboard.footer.support')}</span>
        <button
          type="button"
          onClick={() => setLanguage(otherLanguage)}
          className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-navy transition-colors duration-150 hover:text-coral"
        >
          {otherLabel}
        </button>
      </nav>
    </footer>
  );
}