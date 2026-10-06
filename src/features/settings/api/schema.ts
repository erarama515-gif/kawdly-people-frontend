import { array, nullable, num, object, optional, str } from '@/lib/api/decode';

/**
 * Wire schemas for the Settings module.
 *
 * Confirmed from:
 *   backend/app/Modules/Platform/Models/Setting.php
 *   backend/app/Modules/Platform/Controllers/SettingController.php
 *
 * `value` is nullable string — the backend stores booleans/numbers as their
 * string form (e.g. `'true'`, `'15'`). `type` is a client-side convention
 * ('string' | 'boolean' | 'number') that the UI uses to render/parse the value.
 */

// ─── Shared page meta ─────────────────────────────────────────────────────────

export const pageMetaDecoder = object({
  current_page: num(),
  per_page: num(),
  total: num(),
  last_page: num(),
});

export type PageMetaWire = ReturnType<typeof pageMetaDecoder.decode>;

// ─── Setting ──────────────────────────────────────────────────────────────────

export const settingDecoder = object({
  id: num(),
  company_id: num(),
  group: str(),
  key: str(),
  value: nullable(str()),
  type: optional(str()),
  created_at: optional(str()),
  updated_at: optional(str()),
});

export type SettingWire = ReturnType<typeof settingDecoder.decode>;

export const settingListDecoder = object({
  data: array(settingDecoder),
  meta: pageMetaDecoder,
});

export type SettingListWire = ReturnType<typeof settingListDecoder.decode>;

export const settingEnvelopeDecoder = object({ data: settingDecoder });
export type SettingEnvelopeWire = ReturnType<typeof settingEnvelopeDecoder.decode>;
