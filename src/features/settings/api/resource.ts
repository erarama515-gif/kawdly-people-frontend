import type { FetchContext, QueryKey } from '@/lib/query';
import type { SettingListWire, SettingWire } from './schema';

/**
 * The Settings module's remote resource contract.
 *
 * One-row-per-setting flat key-value store. The only UI operation exercised is
 * PATCH (inline edit), but create/remove are included for completeness and
 * test-mock consistency with every other feature's api/resource.ts pattern.
 *
 * Backend confirmed from:
 *   backend/app/Modules/Platform/Models/Setting.php
 *   backend/app/Modules/Platform/Requests/StoreSettingRequest.php
 *   backend/app/Modules/Platform/Requests/UpdateSettingRequest.php
 *   backend/app/Modules/Platform/Controllers/SettingController.php
 */

// ─── List params ──────────────────────────────────────────────────────────────

export interface SettingListParams {
  page?: number;
  perPage?: number;
  companyId?: number | undefined;
  group?: string | undefined;
  type?: string | undefined;
}

// ─── Input shapes ─────────────────────────────────────────────────────────────

/**
 * `StoreSettingRequest` validated fields.
 * `exactOptionalPropertyTypes: true` — only truly optional fields are `?: T`.
 */
export interface SettingInput {
  company_id: number;
  group: string;
  key: string;
  value?: string | null;
  type?: string | null;
}

/**
 * `UpdateSettingRequest` wraps all fields in `sometimes` — any subset is valid.
 */
export interface SettingUpdateInput {
  company_id?: number | undefined;
  group?: string | undefined;
  key?: string | undefined;
  value?: string | null | undefined;
  type?: string | null | undefined;
}

// ─── Api interface ────────────────────────────────────────────────────────────

export interface SettingApi {
  list(context: FetchContext, params: SettingListParams): Promise<SettingListWire>;
  create(context: FetchContext, input: SettingInput): Promise<SettingWire>;
  update(context: FetchContext, id: number, input: SettingUpdateInput): Promise<SettingWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

// ─── Cache keys ───────────────────────────────────────────────────────────────

export const settingKeys = {
  all: ['settings'] as const satisfies QueryKey,
  list: (params: SettingListParams) => ['settings', 'list', params] as const satisfies QueryKey,
};
