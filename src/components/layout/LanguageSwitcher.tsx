import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/cn';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const isArabic = i18n.language === 'ar';

  function toggle() {
    void i18n.changeLanguage(isArabic ? 'en' : 'ar');
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t('common.language')}
      title={isArabic ? t('common.switchToEnglish') : t('common.switchToArabic')}
      className={cn(
        'flex h-7 items-center gap-1 rounded-[2px] px-2',
        'text-on-navy-muted-85 transition-colors duration-150',
        'hover:bg-on-navy-fill-12 hover:text-on-navy',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-navy-border-50',
        'text-[11px] font-semibold',
      )}
    >
      <Globe className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span>{isArabic ? t('common.switchToEnglish') : t('common.switchToArabic')}</span>
    </button>
  );
}
