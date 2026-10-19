import { appHttpClient as http } from '@/lib/api/appHttpClient';
import {
  notificationEnvelopeDecoder,
  notificationListDecoder,
  unreadCountDecoder,
} from './schema';
import type { NotificationListParams, NotificationListWire, UnreadCountWire, Notification } from './resource';
import type { FetchContext } from '@/lib/query';

const BASE = '/notifications';

function requireData<T>(data: T | undefined, endpoint: string): T {
  if (data === undefined) throw new Error(`${endpoint} returned an empty body`);
  return data;
}

export const notificationHttpClient = {
  async list({ signal }: FetchContext, params: NotificationListParams): Promise<NotificationListWire> {
    const { data } = await http(BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
      },
      signal,
      schema: notificationListDecoder,
    });
    return requireData(data, 'GET /notifications');
  },

  async unreadCount({ signal }: FetchContext): Promise<UnreadCountWire> {
    const { data } = await http(`${BASE}/unread-count`, {
      signal,
      schema: unreadCountDecoder,
    });
    return requireData(data, 'GET /notifications/unread-count');
  },

  async markAsRead({ signal }: FetchContext, id: number): Promise<Notification> {
    const { data } = await http(`${BASE}/${id}/read`, {
      method: 'PATCH',
      signal,
      schema: notificationEnvelopeDecoder,
    });
    return requireData(data, `PATCH /notifications/${id}/read`).data;
  },

  async markAllRead({ signal }: FetchContext): Promise<void> {
    await http(`${BASE}/mark-all-read`, {
      method: 'POST',
      signal,
      ignoreBody: true,
    });
  },
};
