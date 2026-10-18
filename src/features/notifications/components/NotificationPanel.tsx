import { useTranslation } from 'react-i18next';
import {
  CheckCheck,
  Bell,
  FileWarning,
  FileX,
  CheckCircle,
  XCircle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useNotificationList, useMarkAsRead, useMarkAllRead } from '../api/queries';
import type { NotificationType } from '../api/resource';

/** Returns an icon component for the notification type. */
function NotificationIcon({ type }: { type: NotificationType }) {
  const base = 'h-[18px] w-[18px] shrink-0';
  switch (type) {
    case 'leave_approved':
      return <CheckCircle className={cn(base, 'text-emerald-500')} strokeWidth={1.75} />;
    case 'leave_rejected':
      return <XCircle className={cn(base, 'text-red-500')} strokeWidth={1.75} />;
    case 'document_expiring':
      return <FileWarning className={cn(base, 'text-amber-500')} strokeWidth={1.75} />;
    case 'contract_expiring':
      return <FileX className={cn(base, 'text-orange-500')} strokeWidth={1.75} />;
    case 'general':
    default:
      return <Info className={cn(base, 'text-navy')} strokeWidth={1.75} />;
  }
}

/** Formats an ISO timestamp as a relative time string ("2h ago", "Yesterday", etc.) */
function relativeTime(iso: string | undefined): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export function NotificationPanel({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation();
  const { state } = useNotificationList({ page: 1, perPage: 20 });
  const { mutate: markAsRead } = useMarkAsRead();
  const { mutate: markAllRead, isPending: markingAll } = useMarkAllRead();

  const notifications = state.status === 'success' ? (state.data?.data ?? []) : [];
  const isEmpty = state.status === 'success' && notifications.length === 0;

  const handleMarkItem = (id: number, isRead: boolean) => {
    if (!isRead) {
      void markAsRead(id);
    }
    onClose?.();
  };

  const handleMarkAll = () => {
    void markAllRead(undefined);
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-divider px-4 py-3">
        <span className="text-body-sm font-semibold text-ink">{t('notifications.title')}</span>
        <button
          type="button"
          onClick={handleMarkAll}
          disabled={markingAll || isEmpty}
          className="flex items-center gap-1.5 rounded-[3px] px-2 py-1 text-caption font-medium text-navy transition-colors duration-150 hover:bg-surface-hover hover:text-navy-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
          {t('notifications.markAllRead')}
        </button>
      </div>

      {/* List */}
      <ul className="max-h-[360px] overflow-y-auto scrollbar-slim">
        {state.status === 'pending' && (
          <li className="px-4 py-8 text-center text-body-sm text-ink-muted">
            <Bell className="mx-auto mb-2 h-5 w-5 animate-pulse text-ink-faint" strokeWidth={1.5} />
          </li>
        )}

        {isEmpty && (
          <li className="flex flex-col items-center gap-2 px-4 py-10">
            <Bell className="h-8 w-8 text-ink-faint" strokeWidth={1.25} />
            <p className="text-body-sm text-ink-muted">{t('notifications.empty')}</p>
          </li>
        )}

        {notifications.map((n) => {
          const isRead = n.read_at !== undefined;
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => handleMarkItem(n.id, isRead)}
                className={cn(
                  'flex w-full items-start gap-3 px-4 py-3 text-start transition-colors duration-150 hover:bg-surface-hover',
                  !isRead && 'bg-blue-50/50',
                )}
              >
                {/* Type icon */}
                <span className="mt-0.5 shrink-0">
                  <NotificationIcon type={n.type} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-body-sm font-medium text-ink">{n.title}</span>
                    {/* Unread dot */}
                    {!isRead && (
                      <span
                        aria-label={t('notifications.unread')}
                        className="h-2 w-2 shrink-0 rounded-full bg-blue-500"
                      />
                    )}
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-body-sm text-ink-muted">{n.message}</span>
                  <span className="mt-1 text-caption text-ink-faint">{relativeTime(n.created_at)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
