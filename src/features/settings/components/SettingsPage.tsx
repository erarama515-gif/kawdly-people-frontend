import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { userFacingMessage } from '@/lib/api/errors';
import { useSettingList, useUpdateSetting } from '../api/queries';
import type { SettingListParams } from '../api/resource';
import type { SettingWire } from '../api/schema';

/**
 * SettingsPage — live-data, inline-edit version.
 *
 * Fetches all ~22 settings in a single bounded query (perPage: 100, companyId: 1).
 * Groups the flat list client-side using the GROUP_META lookup table below,
 * which preserves the group titles and per-row labels/descriptions that were
 * previously hardcoded in `data.ts` (the backend model has no label/description
 * field, so these stay in the frontend; see i18n approach note in the report).
 *
 * Inline edit: clicking the pencil icon on any row activates an editable input.
 * For `type:'boolean'` rows a checkbox toggle replaces the badge; for all other
 * rows a text <input> is shown. Save calls `useUpdateSetting` (PATCH) with
 * optimistic update; Cancel restores without a round-trip.
 */

// ─── Group + row metadata ─────────────────────────────────────────────────────
//
// The backend Setting model stores only group/key/value/type.
// Human-readable labels and descriptions live here. i18n approach (b) was
// chosen — see report for rationale. This map is keyed by `${group}::${key}`.

interface RowMeta {
  label: string;
  description?: string;
}

const ROW_META: Record<string, RowMeta> = {
  // General
  'general::companyName':    { label: 'Company Name' },
  'general::logo':           { label: 'Logo' },
  'general::timezone':       { label: 'Timezone' },
  'general::language':       { label: 'Default Language' },
  'general::fiscalYearStart':{ label: 'Fiscal Year Start' },

  // Attendance
  'attendance::gracePeriod':       { label: 'Grace Period',       description: 'Lateness deducted only beyond this window' },
  'attendance::overtimeThreshold': { label: 'Overtime Threshold', description: 'Hours after which overtime rate applies' },
  'attendance::checkInMethods':    { label: 'Check-in Methods' },
  'attendance::weekendDays':       { label: 'Weekend Days' },

  // Leave
  'leave::annualEntitlement': { label: 'Annual Entitlement', description: 'Per employee per year' },
  'leave::carryForwardMax':   { label: 'Carry Forward Maximum', description: 'Unused leave allowed into next year' },
  'leave::accrualMethod':     { label: 'Accrual Method' },
  'leave::approvalLevels':    { label: 'Approval Levels' },

  // Payroll
  'payroll::payCycle':           { label: 'Pay Cycle' },
  'payroll::currency':           { label: 'Currency' },
  'payroll::taxEnabled':         { label: 'VAT / Tax Deduction', description: 'Enabled — 15% VAT applied to payslips' },
  'payroll::payDay':             { label: 'Pay Day' },
  'payroll::overtimeMultiplier': { label: 'Overtime Multiplier' },

  // Notifications
  'notifications::emailNotifs':     { label: 'Email Notifications',   description: 'Leave approvals, payslips, contract alerts' },
  'notifications::smsNotifs':       { label: 'SMS Notifications',     description: 'Urgent alerts only' },
  'notifications::inAppNotifs':     { label: 'In-App Notifications',  description: 'Real-time bell icon alerts' },
  'notifications::digestFrequency': { label: 'Digest Frequency' },
};

const GROUP_TITLES: Record<string, string> = {
  general:       'General',
  attendance:    'Attendance',
  leave:         'Leave',
  payroll:       'Payroll',
  notifications: 'Notifications',
};

/** Canonical display order for groups */
const GROUP_ORDER = ['general', 'attendance', 'leave', 'payroll', 'notifications'];

// ─── List params (stable reference — company 1, all groups) ──────────────────

const LIST_PARAMS: SettingListParams = { companyId: 1, perPage: 100 };

// ─── Toggle Badge ─────────────────────────────────────────────────────────────

function ToggleBadge({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
        enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
      )}
    >
      {enabled ? t('settings.enabled') : t('settings.disabled')}
    </span>
  );
}

// ─── Inline editor ────────────────────────────────────────────────────────────

interface InlineEditorProps {
  row: SettingWire;
  onDone: () => void;
}

function InlineEditor({ row, onDone }: InlineEditorProps) {
  const { t } = useTranslation();
  const isBoolean = row.type === 'boolean';
  const currentBool = row.value === 'true';
  const [draft, setDraft] = useState<string>(row.value ?? '');
  const [boolDraft, setBoolDraft] = useState<boolean>(currentBool);

  const { mutate, isPending, error } = useUpdateSetting();

  async function handleSave() {
    const newValue = isBoolean ? (boolDraft ? 'true' : 'false') : draft;
    await mutate({ id: row.id, listParams: LIST_PARAMS, value: newValue });
    onDone();
  }

  return (
    <div className="flex flex-col gap-1.5">
      {isBoolean ? (
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={boolDraft}
            onChange={(e) => setBoolDraft(e.target.checked)}
            className="h-4 w-4 rounded border-divider accent-navy"
            disabled={isPending}
          />
          <span className="text-body-sm text-ink">
            {boolDraft ? t('settings.enabled') : t('settings.disabled')}
          </span>
        </label>
      ) : (
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={isPending}
          className={cn(
            'rounded-[3px] border border-divider bg-white px-2.5 py-1 text-body-sm text-ink',
            'focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/30',
            'disabled:opacity-60',
          )}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSave();
            if (e.key === 'Escape') onDone();
          }}
        />
      )}

      {error ? (
        <p className="text-caption text-coral">{userFacingMessage(error)}</p>
      ) : null}

      <div className="flex items-center gap-1.5">
        <Button
          variant="primary"
          className="h-7 px-3 text-[12px]"
          onClick={() => void handleSave()}
          disabled={isPending}
          aria-label={t('common.save')}
        >
          {isPending ? t('common.saving') : t('common.save')}
        </Button>
        <Button
          variant="ghost"
          className="h-7 px-3 text-[12px]"
          onClick={onDone}
          disabled={isPending}
          aria-label={t('common.cancel')}
        >
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}

// ─── Setting row ──────────────────────────────────────────────────────────────

interface SettingItemProps {
  row: SettingWire;
  isLast: boolean;
}

function SettingItem({ row, isLast }: SettingItemProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const meta = ROW_META[`${row.group}::${row.key}`];
  const label = meta?.label ?? row.key;
  const description = meta?.description;

  const isBoolean = row.type === 'boolean';
  const boolValue = row.value === 'true';

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 px-5 py-3.5',
        !isLast && 'border-b border-divider',
      )}
    >
      {/* Label side */}
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-medium text-ink">{label}</p>
        {description ? (
          <p className="mt-0.5 text-caption text-ink-faint">{description}</p>
        ) : null}
      </div>

      {/* Value / editor side */}
      <div className="shrink-0">
        {editing ? (
          <InlineEditor row={row} onDone={() => setEditing(false)} />
        ) : (
          <div className="flex items-center gap-2">
            {isBoolean ? (
              <ToggleBadge enabled={boolValue} />
            ) : (
              <span className="text-body-sm text-ink-muted">{row.value ?? '—'}</span>
            )}
            <Button
              variant="ghost"
              className="h-7 w-7 px-0 text-ink-faint hover:text-ink"
              aria-label={t('common.edit')}
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Group card ───────────────────────────────────────────────────────────────

function SettingGroupCard({ groupId, rows }: { groupId: string; rows: SettingWire[] }) {
  const title = GROUP_TITLES[groupId] ?? groupId;
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-divider bg-surface px-5 py-3">
        <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
      </div>
      <div>
        {rows.map((row, idx) => (
          <SettingItem key={row.id} row={row} isLast={idx === rows.length - 1} />
        ))}
      </div>
    </Card>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading settings…">
      {[1, 2, 3].map((n) => (
        <Card key={n} className="overflow-hidden">
          <div className="border-b border-divider bg-surface px-5 py-3">
            <div className="h-5 w-32 animate-pulse rounded bg-divider" />
          </div>
          <div>
            {[1, 2, 3, 4].map((m) => (
              <div key={m} className="flex items-center justify-between border-b border-divider px-5 py-3.5 last:border-b-0">
                <div className="h-4 w-40 animate-pulse rounded bg-divider" />
                <div className="h-4 w-24 animate-pulse rounded bg-divider" />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { t } = useTranslation();
  const { state, refetch } = useSettingList(LIST_PARAMS);

  // Group flat list by group field, preserving canonical display order
  const groups: Array<{ groupId: string; rows: SettingWire[] }> = GROUP_ORDER
    .map((groupId) => ({
      groupId,
      rows: (state.data?.data ?? []).filter((row) => row.group === groupId),
    }))
    .filter(({ rows }) => rows.length > 0);

  return (
    <div className="flex flex-col">
      <PageHeader title={t('settings.title')} />

      {/* Loading */}
      {state.status === 'pending' && <SettingsSkeleton />}

      {/* Error */}
      {state.status === 'error' && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-body-sm text-coral">{userFacingMessage(state.error)}</p>
          <Button variant="ghost" onClick={refetch}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {/* Success */}
      {state.status === 'success' && (
        <div className="flex flex-col gap-6">
          {groups.map(({ groupId, rows }) => (
            <SettingGroupCard key={groupId} groupId={groupId} rows={rows} />
          ))}
        </div>
      )}

      <div className="h-10" aria-hidden="true" />
    </div>
  );
}
