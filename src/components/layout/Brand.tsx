import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

/**
 * Wordmark tile. The logo asset is isolated here so it can be swapped for an
 * SVG component later without touching the layout: a white tile at the
 * reference radii (7px on the 56px mobile bar, 8px on the 64px desktop bar).
 */
function WordmarkTile() {
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] bg-surface md:h-8 md:w-8 md:rounded-lg">
      <img
        src="/kawdly-mark.png"
        alt=""
        aria-hidden="true"
        className="h-[26px] w-[26px] md:h-[30px] md:w-[30px]"
      />
    </span>
  );
}

/** Top bar brand: tile + single-line wordmark. Fixed width keeps the nav aligned. */
export function Brand({ className, tone = 'navy' }: { className?: string; tone?: 'navy' | 'light' }) {
  const { t } = useTranslation();
  const onNavy = tone === 'navy';

  return (
    <div className={cn('flex w-auto min-w-0 shrink-0 items-center gap-2.5 min-[360px]:w-[150px]', className)}>
      <WordmarkTile />
      <span className="hidden truncate text-base leading-none min-[360px]:inline">
        <span className={cn('font-semibold', onNavy ? 'text-on-navy' : 'text-ink')}>{t('brand.name')}</span>{' '}
        <span className={onNavy ? 'text-on-navy-muted-70' : 'text-ink-muted'}>{t('brand.suffix')}</span>
      </span>
    </div>
  );
}