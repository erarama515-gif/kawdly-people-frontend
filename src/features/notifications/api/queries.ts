import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { notificationHttpClient } from './client';
import { notificationKeys } from './resource';
import type { NotificationListParams, NotificationListWire, UnreadCountWire } from './resource';

/** Poll interval for unread count (30 seconds). */
const UNREAD_POLL_INTERVAL = 30_000;

export function useNotificationList(params: NotificationListParams = {}) {
  const { state, refetch } = useQuery<NotificationListWire>({
    queryKey: notificationKeys.list(params),
    queryFn: (context) => notificationHttpClient.list(context, params),
    staleTime: 15_000,
  });
  return { state, refetch };
}

export interface UnreadCountData {
  state: QueryState<UnreadCountWire>;
  refetch: () => void;
}

export function useUnreadCount(): UnreadCountData {
  const { state, refetch } = useQuery<UnreadCountWire>({
    queryKey: notificationKeys.unreadCount,
    queryFn: (context) => notificationHttpClient.unreadCount(context),
    staleTime: 20_000,
    refetchInterval: UNREAD_POLL_INTERVAL,
  });
  return { state, refetch };
}

function isNotificationKey(key: readonly unknown[]): boolean {
  return key[0] === 'notifications';
}

export function useMarkAsRead() {
  const client = useQueryClient();
  return useMutation<number, void>({
    mutationFn: async (id, { signal }) => {
      await notificationHttpClient.markAsRead({ signal }, id);
    },
    onSuccess: () => {
      void client.invalidate({ predicate: isNotificationKey });
    },
  });
}

export function useMarkAllRead() {
  const client = useQueryClient();
  return useMutation<void, void>({
    mutationFn: (_input, { signal }) => notificationHttpClient.markAllRead({ signal }),
    onSuccess: () => {
      void client.invalidate({ predicate: isNotificationKey });
    },
  });
}
