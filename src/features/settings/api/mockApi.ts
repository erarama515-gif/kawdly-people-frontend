import { ApiError } from '@/lib/api/errors';
import type { FetchContext } from '@/lib/query';
import { settingDecoder, settingListDecoder } from './schema';
import type { SettingListWire, SettingWire } from './schema';
import type { SettingApi } from './resource';

/**
 * In-process implementation of SettingApi.
 *
 * Seeded from the same group/key/value/type data that `features/settings/data.ts`
 * previously provided as static mock data. The seed preserves every existing
 * row so the UI looks identical on first load.
 *
 * Booleans are stored as `'true'`/`'false'` strings; numbers as their decimal
 * string form. The `type` field drives how the UI parses/renders each row.
 *
 * Mirrors the exact simulation + failure-rate pattern from
 * `organization/api/mockApi.ts`.
 */

// ─── Simulation helpers ───────────────────────────────────────────────────────

const READ_LATENCY_MS = 220;
const WRITE_LATENCY_MS = 420;

const FAILURE_RATE_KEY = 'kawdly.settingsMockFailureRate';

function readFailureRate(): number {
  const raw = sessionStorage.getItem(FAILURE_RATE_KEY);
  const parsed = Number(raw);
  return raw !== null && Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0;
}

let failureRate = readFailureRate();

export function setMockSettingFailureRate(rate: number): void {
  failureRate = Math.min(Math.max(rate, 0), 1);
  sessionStorage.setItem(FAILURE_RATE_KEY, String(failureRate));
}

async function simulate(context: FetchContext, baseMs: number): Promise<void> {
  if (context.signal.aborted) throw new ApiError('aborted', 'Request aborted');
  if (failureRate > 0 && Math.random() < failureRate) {
    throw new ApiError('network', 'Simulated transport failure');
  }

  const jittered = baseMs + Math.random() * baseMs * 0.4;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      context.signal.removeEventListener('abort', onAbort);
      resolve();
    }, jittered);
    function onAbort() {
      clearTimeout(timer);
      reject(new ApiError('aborted', 'Request aborted'));
    }
    context.signal.addEventListener('abort', onAbort, { once: true });
  });
}

// ─── Stored shape ─────────────────────────────────────────────────────────────

interface StoredSetting {
  id: number;
  company_id: number;
  group: string;
  key: string;
  value: string | null;
  type: string | undefined;
  created_at: string;
  updated_at: string;
}

// ─── Seed data ────────────────────────────────────────────────────────────────
//
// Preserves every row from `features/settings/data.ts` exactly.
// Booleans → 'true'/'false' strings; all other values already strings.
// `type` mirrors how the UI should parse/render the value.

const SEED_SETTINGS: StoredSetting[] = [
  // ─── General ───────────────────────────────────────────────────────────────
  { id: 1,  company_id: 1, group: 'general', key: 'companyName',    value: 'Kawdly Technologies Co.', type: 'string',  created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 2,  company_id: 1, group: 'general', key: 'logo',           value: 'kawdly-logo.svg',          type: 'string',  created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 3,  company_id: 1, group: 'general', key: 'timezone',       value: 'Asia/Riyadh (UTC+3)',      type: 'string',  created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 4,  company_id: 1, group: 'general', key: 'language',       value: 'English',                  type: 'string',  created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 5,  company_id: 1, group: 'general', key: 'fiscalYearStart',value: '01 January',               type: 'string',  created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },

  // ─── Attendance ────────────────────────────────────────────────────────────
  { id: 6,  company_id: 1, group: 'attendance', key: 'gracePeriod',       value: '15 minutes',                 type: 'string', created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 7,  company_id: 1, group: 'attendance', key: 'overtimeThreshold', value: '8 hours / day',              type: 'string', created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 8,  company_id: 1, group: 'attendance', key: 'checkInMethods',    value: 'Mobile app, Biometric, Web', type: 'string', created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 9,  company_id: 1, group: 'attendance', key: 'weekendDays',       value: 'Friday & Saturday',          type: 'string', created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },

  // ─── Leave ─────────────────────────────────────────────────────────────────
  { id: 10, company_id: 1, group: 'leave', key: 'annualEntitlement', value: '21 days',              type: 'string', created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 11, company_id: 1, group: 'leave', key: 'carryForwardMax',   value: '5 days',               type: 'string', created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 12, company_id: 1, group: 'leave', key: 'accrualMethod',     value: 'Monthly pro-rata',     type: 'string', created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 13, company_id: 1, group: 'leave', key: 'approvalLevels',    value: '2 (Manager → HR)',     type: 'string', created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },

  // ─── Payroll ───────────────────────────────────────────────────────────────
  { id: 14, company_id: 1, group: 'payroll', key: 'payCycle',           value: 'Monthly',               type: 'string',  created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 15, company_id: 1, group: 'payroll', key: 'currency',           value: 'SAR — Saudi Riyal',     type: 'string',  created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 16, company_id: 1, group: 'payroll', key: 'taxEnabled',         value: 'true',                  type: 'boolean', created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 17, company_id: 1, group: 'payroll', key: 'payDay',             value: '25th of each month',    type: 'string',  created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 18, company_id: 1, group: 'payroll', key: 'overtimeMultiplier', value: '1.5×',                  type: 'string',  created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },

  // ─── Notifications ─────────────────────────────────────────────────────────
  { id: 19, company_id: 1, group: 'notifications', key: 'emailNotifs',     value: 'true',               type: 'boolean', created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 20, company_id: 1, group: 'notifications', key: 'smsNotifs',       value: 'false',              type: 'boolean', created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 21, company_id: 1, group: 'notifications', key: 'inAppNotifs',     value: 'true',               type: 'boolean', created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
  { id: 22, company_id: 1, group: 'notifications', key: 'digestFrequency', value: 'Daily at 08:00',     type: 'string',  created_at: '2021-01-01T00:00:00.000Z', updated_at: '2021-01-01T00:00:00.000Z' },
];

// ─── Mutable store ────────────────────────────────────────────────────────────

let settingStore: StoredSetting[] = SEED_SETTINGS.map((s) => ({ ...s }));
let settingNextId = 100;

export function resetMockSettings(): void {
  settingStore = SEED_SETTINGS.map((s) => ({ ...s }));
  settingNextId = 100;
}

function settingFindOrThrow(id: number): StoredSetting {
  const row = settingStore.find((item) => item.id === id);
  if (!row) throw new ApiError('http', `Setting ${id} not found`, { status: 404 });
  return row;
}

function settingToWire(row: StoredSetting): SettingWire {
  return settingDecoder.decode({ ...row });
}

// ─── Mock API ─────────────────────────────────────────────────────────────────

export const mockSettingApi: SettingApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const filtered = settingStore.filter((row) => {
      if (params.companyId !== undefined && row.company_id !== params.companyId) return false;
      if (params.group !== undefined && row.group !== params.group) return false;
      if (params.type !== undefined && row.type !== params.type) return false;
      return true;
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const pageData = filtered.slice(start, start + perPage);

    const wire: SettingListWire = {
      data: pageData.map(settingToWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return settingListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = settingNextId;
    settingNextId += 1;
    const stamp = new Date().toISOString();
    const row: StoredSetting = {
      id,
      company_id: input.company_id,
      group: input.group,
      key: input.key,
      value: input.value ?? null,
      type: input.type ?? undefined,
      created_at: stamp,
      updated_at: stamp,
    };
    settingStore = [row, ...settingStore];
    return settingDecoder.decode(structuredClone(settingToWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = settingFindOrThrow(id);

    const updated: StoredSetting = {
      ...row,
      ...(input.company_id !== undefined ? { company_id: input.company_id } : {}),
      ...(input.group !== undefined ? { group: input.group } : {}),
      ...(input.key !== undefined ? { key: input.key } : {}),
      ...(input.value !== undefined ? { value: input.value ?? null } : {}),
      ...(input.type !== undefined ? { type: input.type ?? undefined } : {}),
      updated_at: new Date().toISOString(),
    };
    settingStore = settingStore.map((item) => (item.id === id ? updated : item));
    return settingDecoder.decode(structuredClone(settingToWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    settingFindOrThrow(id);
    settingStore = settingStore.filter((item) => item.id !== id);
  },
};
