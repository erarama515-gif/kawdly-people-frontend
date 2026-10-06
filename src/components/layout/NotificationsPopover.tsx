import { useTranslation } from 'react-i18next';
import * as Popover from '@radix-ui/react-popover';
import { Bell } from 'lucide-react';
import { useIsRtl } from '@/hooks/useDirection';
import { cn } from '@/lib/cn';

/** Shared chrome for every floating surface in the top bar — hairline, sharp, no shadow. */
const surfaceClass =
  'z-50 rounded-[3px] border border-hairline bg-surface focus:outline-none data-[state=open]:animate-content-in';

export function NotificationsPopover() {
  const { t } = useTranslation();
  // Radix places overlays physically, so the alignment follows the current direction.
  const alignToButton = useIsRtl() ? 'start' : 'end';
  const items = t('notifications.items', { returnObjects: true }) as Array<{
    title: string;
    description: string;
    time: string;
  }>;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={t('topbar.notifications')}
          className="relative grid h-9 w-9 shrink-0 place-items-center rounded-[3px] text-on-navy-muted-85 transition-colors duration-150 hover:bg-on-navy-fill-12 hover:text-on-navy"
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
          <span
            aria-hidden="true"
            className="absolute end-[7px] top-[6px] h-2 w-2 rounded-full border-2 border-navy bg-coral"
          />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align={alignToButton}
          sideOffset={8}
          collisionPadding={8}
          className={cn(surfaceClass, 'w-[360px] max-w-[calc(100vw-32px)] p-0')}
        >
          <p className="flex items-center justify-between gap-3 border-b border-divider px-4 py-3">
            <span className="text-body-sm font-semibold text-ink">{t('notifications.title')}</span>
            <span className="nums rounded-full bg-coral px-2 py-0.5 text-caption font-bold text-on-navy">
              {t('notifications.count')}
            </span>
          </p>

          <ul className="max-h-[320px] overflow-y-auto scrollbar-slim py-1">
            {items.map((item) => (
              <li key={item.title} className="px-4 py-3 transition-colors duration-150 hover:bg-surface-hover">
                <p className="text-body-sm font-medium text-ink">{item.title}</p>
                <p className="mt-0.5 text-body-sm text-ink-muted">{item.description}</p>
                <p className="mt-1 text-caption text-ink-faint">{item.time}</p>
              </li>
            ))}
          </ul>

          <div className="border-t border-divider px-1 py-1">
            <button
              type="button"
              className="w-full rounded-[3px] px-3 py-2 text-start text-body-sm font-medium text-navy transition-colors duration-150 hover:bg-surface-hover hover:text-navy-deep"
            >
              {t('notifications.viewAll')}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}