import type { QueryKey } from '@/lib/query';

export type NotificationType =
  | 'leave_approved'
  | 'leave_rejected'
  | 'document_expiring'
  | 'contract_expiring'
  | 'general';

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  read_at?: string | undefined;
  created_at?: string | undefined;
}

export interface NotificationListParams {
  page?: number;
  perPage?: number;
}

export interface PageMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface NotificationListWire {
  data: Notification[];
  meta: PageMeta;
}

export interface UnreadCountWire {
  count: number;
}

export const notificationKeys = {
  all: ['notifications'] as const satisfies QueryKey,
  list: (params: NotificationListParams) =>
    ['notifications', 'list', params] as const satisfies QueryKey,
  unreadCount: ['notifications', 'unreadCount'] as const satisfies QueryKey,
};
