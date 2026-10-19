import { array, literalUnion, num, object, optional, str } from '@/lib/api/decode';
import type { NotificationType } from './resource';

export const notificationTypeDecoder = literalUnion([
  'leave_approved',
  'leave_rejected',
  'document_expiring',
  'contract_expiring',
  'general',
] as const satisfies readonly NotificationType[]);

export const notificationDecoder = object({
  id: num(),
  type: notificationTypeDecoder,
  title: str(),
  message: str(),
  read_at: optional(str()),
  created_at: optional(str()),
});

export type NotificationWire = ReturnType<typeof notificationDecoder.decode>;

export const pageMetaDecoder = object({
  current_page: num(),
  per_page: num(),
  total: num(),
  last_page: num(),
});

export const notificationListDecoder = object({
  data: array(notificationDecoder),
  meta: pageMetaDecoder,
});

export type NotificationListWire = ReturnType<typeof notificationListDecoder.decode>;

export const unreadCountDecoder = object({
  count: num(),
});

export type UnreadCountWire = ReturnType<typeof unreadCountDecoder.decode>;

export const notificationEnvelopeDecoder = object({ data: notificationDecoder });
