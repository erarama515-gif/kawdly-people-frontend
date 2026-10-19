import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Pencil, Settings2, Shield, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { userFacingMessage } from '@/lib/api/errors';
import { useHasPermission } from '@/auth/session';
import { useSettingList, useUpdateSetting } from '../api/queries';
import type { SettingListParams } from '../api/resource';
import type { SettingWire } from '../api/schema';
import { UsersTab } from './UsersTab';
import { RolesTab } from './RolesTab';
import { DocumentTypesTab } from '@/features/documents/components/DocumentTypesTab';

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
// Human-readable labels and descriptions live here, driven by i18n keys so the
// UI works in both English and Arabic. This map is keyed by `${group}::${key}`.

interface RowMeta {
  label: string;
  description?: string;
}

type TFunction = (key: string) => string;

function getRowMeta(t: TFunction): Record<string, RowMeta> {
  return {
    // General
    'general::companyName':    { label: t('settings.rows.general_companyName') },
    'general::logo':           { label: t('settings.rows.general_logo') },
    'general::timezone':       { label: t('settings.rows.general_timezone') },
    'general::language':       { label: t('settings.rows.general_language') },
    'general::fiscalYearStart':{ label: t('settings.rows.general_fiscalYearStart') },

    // Attendance
    'attendance::gracePeriod':       { label: t('settings.rows.attendance_gracePeriod'),       description: t('settings.rows.attendance_gracePeriod_desc') },
    'attendance::overtimeThreshold': { label: t('settings.rows.attendance_overtimeThreshold'), description: t('settings.rows.attendance_overtimeThreshold_desc') },
    'attendance::checkInMethods':    { label: t('settings.rows.attendance_checkInMethods') },
    'attendance::weekendDays':       { label: t('settings.rows.attendance_weekendDays') },

    // Leave
    'leave::annualEntitlement': { label: t('settings.rows.leave_annualEntitlement'), description: t('settings.rows.leave_annualEntitlement_desc') },
    'leave::carryForwardMax':   { label: t('settings.rows.leave_carryForwardMax'),   description: t('settings.rows.leave_carryForwardMax_desc') },
    'leave::accrualMethod':     { label: t('settings.rows.leave_accrualMethod') },
    'leave::approvalLevels':    { label: t('settings.rows.leave_approvalLevels') },

    // Payroll
    'payroll::payCycle':           { label: t('settings.rows.payroll_payCycle') },
    'payroll::currency':           { label: t('settings.rows.payroll_currency') },
    'payroll::taxEnabled':         { label: t('settings.rows.payroll_taxEnabled'), description: t('settings.rows.payroll_taxEnabled_desc') },
    'payroll::payDay':             { label: t('settings.rows.payroll_payDay') },
    'payroll::overtimeMultiplier': { label: t('settings.rows.payroll_overtimeMultiplier') },

    // Notifications
    'notifications::emailNotifs':     { label: t('settings.rows.notifications_emailNotifs'),     description: t('settings.rows.notifications_emailNotifs_desc') },
    'notifications::smsNotifs':       { label: t('settings.rows.notifications_smsNotifs'),       description: t('settings.rows.notifications_smsNotifs_desc') },
    'notifications::inAppNotifs':     { label: t('settings.rows.notifications_inAppNotifs'),     description: t('settings.rows.notifications_inAppNotifs_desc') },
    'notifications::digestFrequency': { label: t('settings.rows.notifications_digestFrequency') },
  };
}

function getGroupTitles(t: TFunction): Record<string, string> {
  return {
    general:       t('settings.groups.general'),
    attendance:    t('settings.groups.attendance'),
    leave:         t('settings.groups.leave'),
    payroll:       t('settings.groups.payroll'),
    notifications: t('settings.groups.notifications'),
  };
}

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
            'rounded-[3px] border border-divider bg-surface px-2.5 py-1 text-body-sm text-ink',
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
  const rowMeta = getRowMeta(t);
  const meta = rowMeta[`${row.group}::${row.key}`];
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
  const { t } = useTranslation();
  const groupTitles = getGroupTitles(t);
  const title = groupTitles[groupId] ?? groupId;
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

// ─── General Settings Content ─────────────────────────────────────────────────

function GeneralSettingsContent() {
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
    <>
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
    </>
  );
}

// ─── Tab definitions ─────────────────────────────────────────────────────────

type SettingsTabId = 'general' | 'users' | 'roles' | 'document-types';

interface SettingsTabDef {
  id: SettingsTabId;
  labelKey: string;
  icon: React.ReactNode;
}

const SETTINGS_TABS: SettingsTabDef[] = [
  { id: 'general', labelKey: 'settings.tabs.general', icon: <Settings2 className="h-4 w-4" strokeWidth={1.75} /> },
  { id: 'users',   labelKey: 'settings.tabs.users',   icon: <Users className="h-4 w-4" strokeWidth={1.75} /> },
  { id: 'roles',   labelKey: 'settings.tabs.roles',   icon: <Shield className="h-4 w-4" strokeWidth={1.75} /> },
  { id: 'document-types', labelKey: 'settings.tabs.documentTypes', icon: <FileText className="h-4 w-4" strokeWidth={1.75} /> },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTabId>('general');

  // The backend guards every roles.* endpoint behind `roles.manage` (see
  // RoleController) — hide the tab itself for sessions that don't have it,
  // rather than let a user land on a tab that 403s on every request.
  const canManageRoles = useHasPermission('roles.manage');
  const canViewDocumentTypes = useHasPermission('document.document_type.view');
  const visibleTabs = SETTINGS_TABS.filter(
    (tab) =>
      (tab.id !== 'roles' || canManageRoles) &&
      (tab.id !== 'document-types' || canViewDocumentTypes),
  );

  return (
    <div className="flex flex-col">
      <PageHeader title={t('settings.title')} />

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 border-b border-divider">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-body-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border-navy text-navy'
                : 'border-transparent text-ink-muted hover:border-divider hover:text-ink',
            )}
          >
            {tab.icon}
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'general' && <GeneralSettingsContent />}
      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'roles' && canManageRoles && <RolesTab />}
      {activeTab === 'document-types' && canViewDocumentTypes && <DocumentTypesTab />}

      <div className="h-10" aria-hidden="true" />
    </div>
  );
}
