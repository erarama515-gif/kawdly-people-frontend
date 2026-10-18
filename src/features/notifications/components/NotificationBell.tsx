import { useTranslation } from 'react-i18next';
import * as Popover from '@radix-ui/react-popover';
import { Bell } from 'lucide-react';
import { useIsRtl } from '@/hooks/useDirection';
import { cn } from '@/lib/cn';
import { useUnreadCount } from '../api/queries';
import { NotificationPanel } from './NotificationPanel';

/** Shared chrome class for floating surfaces (matches NotificationsPopover). */
const surfaceClass =
  'z-50 rounded-[3px] border border-hairline bg-surface focus:outline-none data-[state=open]:animate-content-in';

export function NotificationBell() {
  const { t } = useTranslation();
  const alignToButton = useIsRtl() ? 'start' : 'end';
  const { state } = useUnreadCount();

  const unreadCount = state.status === 'success' ? (state.data?.count ?? 0) : 0;
  const hasUnread = unreadCount > 0;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={t('topbar.notifications')}
          className="relative grid h-7 w-7 shrink-0 place-items-center rounded-[2px] text-on-navy-muted-85 transition-colors duration-150 hover:bg-on-navy-fill-12 hover:text-on-navy"
        >
          <Bell className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />

          {/* Unread count badge */}
          {hasUnread && (
            <span
              aria-hidden="true"
              className={cn(
                'absolute end-[3px] top-[3px] flex min-w-[12px] items-center justify-center rounded-full border border-navy bg-coral text-[8px] font-bold leading-none text-white',
                unreadCount > 9 ? 'px-[3px] py-[2px]' : 'h-[14px] w-[14px]',
              )}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}

          {/* Fallback dot when no count available yet (matches original design) */}
          {!hasUnread && state.status !== 'success' && (
            <span
              aria-hidden="true"
              className="absolute end-[4px] top-[4px] h-1.5 w-1.5 rounded-full border border-navy bg-coral"
            />
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align={alignToButton}
          sideOffset={8}
          collisionPadding={8}
          className={cn(surfaceClass, 'w-[380px] max-w-[calc(100vw-32px)] p-0')}
        >
          <Popover.Close asChild>
            {/* Wrapping div so Close can be the dismiss callback target */}
            <div className="pointer-events-none absolute" />
          </Popover.Close>
          <NotificationPanel />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
