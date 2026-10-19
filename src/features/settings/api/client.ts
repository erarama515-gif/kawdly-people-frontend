import { env } from '@/config/env';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import { mockSettingApi, resetMockSettings, setMockSettingFailureRate } from './mockApi';
import { settingEnvelopeDecoder, settingListDecoder } from './schema';
import type { SettingApi, SettingInput, SettingListParams, SettingUpdateInput } from './resource';

/**
 * Real HTTP implementation of SettingApi against `/settings`.
 *
 * `$filterable` on the backend: `company_id`, `group`, `type` — those are the
 * only query params sent on list. Mirrors the HttpClient conventions from
 * `organization/api/client.ts`.
 */

const SETTINGS_BASE = '/settings';

export const httpSettingApi: SettingApi = {
  async list({ signal }, params) {
    const { data } = await http(SETTINGS_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        company_id: params.companyId,
        group: params.group,
        type: params.type,
      },
      signal,
      schema: settingListDecoder,
    });
    return requireData(data, 'GET /settings');
  },

  async create({ signal }, input) {
    const { data } = await http(SETTINGS_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: settingEnvelopeDecoder,
    });
    return requireData(data, 'POST /settings').data;
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${SETTINGS_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: settingEnvelopeDecoder,
    });
    return requireData(data, `PATCH /settings/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${SETTINGS_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function requireData<T>(data: T | undefined, endpoint: string): T {
  if (data === undefined) throw new Error(`${endpoint} returned an empty body`);
  return data;
}

// ─── Transport selector ───────────────────────────────────────────────────────

export const settingApi: SettingApi = env.useMockApi ? mockSettingApi : httpSettingApi;

if (env.isDev && env.useMockApi) {
  Object.defineProperty(window, '__settingsMock', {
    value: { setFailureRate: setMockSettingFailureRate, reset: resetMockSettings },
    configurable: true,
  });
}

export type { SettingInput, SettingUpdateInput, SettingListParams };
