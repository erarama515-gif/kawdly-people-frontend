import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

/** Top bar brand: bordered K mark + "Kawdly People" wordmark. */
export function Brand({ className, tone = 'navy' }: { className?: string; tone?: 'navy' | 'light' }) {
  const { t } = useTranslation();
  const onNavy = tone === 'navy';

  return (
    <div className={cn('flex min-w-0 shrink-0 items-center gap-2', className)}>
      <span
        className={cn(
          'inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center text-[13px] font-bold',
          onNavy
            ? 'border-[1.5px] border-on-navy text-on-navy'
            : 'border-[1.5px] border-ink text-ink',
        )}
      >
        K
      </span>
      <span className="hidden truncate text-[14px] font-bold leading-none min-[360px]:inline">
        <span className={onNavy ? 'text-on-navy' : 'text-ink'}>{t('brand.name')}</span>{' '}
        <span className={onNavy ? 'text-on-navy' : 'text-ink'}>{t('brand.suffix')}</span>
      </span>
    </div>
  );
}
