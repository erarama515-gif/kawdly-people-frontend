import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { ExportButton } from '@/components/ui/ExportButton';
import type { ExportColumn } from '@/components/ui/ExportButton';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { SkeletonTable } from '@/components/ui/SkeletonTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { useSort, sortData } from '@/hooks/useSort';
import { userFacingMessage } from '@/lib/api/errors';
import {
  useEmployeeDocumentList,
  useDeleteEmployeeDocument,
  useDocumentTypeList,
  useDocumentTemplateCount,
} from '../api/queries';
import { useCan } from '@/hooks/useCan';
import type { EmployeeDocumentListParams, EmployeeDocumentStatus } from '../api/resource';
import type { EmployeeDocumentWire } from '../api/schema';
import { EmployeeDocumentFormDialog } from './EmployeeDocumentFormDialog';
import { LetterGenerator } from './LetterGenerator';

/**
 * Documents module live-data page. Mirrors `AttendancePage` conventions:
 * - `useEmployeeDocumentList` for data
 * - Add/Edit via `EmployeeDocumentFormDialog`
 * - Delete via `ConfirmDialog` + optimistic `useDeleteEmployeeDocument`
 * - `Pagination` for page controls
 * - Debounced search (employee name, document title, document number)
 * - Status filter chips (real backend values: valid/expired/pending_renewal + All)
 * - Stat cards backed by cheap `perPage:1` filtered queries (total/valid/expired/pending_renewal/templates)
 *
 * "Expiring soon" visual annotation: records with status=`valid` and
 * `expiry_date` within 30 days from today are shown with an orange badge
 * variant — this is purely a client-side visual, not a real server status.
 */

const PER_PAGE = 10;
const EXPIRING_SOON_DAYS = 30;

const STATUS_CLASSES: Record<EmployeeDocumentStatus | 'expiring_soon', string> = {
  valid: 'bg-emerald-50 text-emerald-700',
  expiring_soon: 'bg-orange-50 text-orange-700',
  expired: 'bg-red-50 text-red-700',
  pending_renewal: 'bg-amber-50 text-amber-700',
};

function formatDate(isoDate: string | undefined): string {
  if (!isoDate) return '—';
  return new Date(isoDate).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function initialsOf(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/**
 * Returns true when a `valid` document is expiring within EXPIRING_SOON_DAYS.
 * Only called for status=`valid` documents.
 */
function isExpiringSoon(expiryDate: string | undefined): boolean {
  if (!expiryDate) return false;
  const now = Date.now();
  const expiry = new Date(expiryDate).getTime();
  const threshold = EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;
  return expiry > now && expiry - now <= threshold;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  warning,
  danger,
  muted,
}: {
  label: string;
  value: number | undefined;
  warning?: boolean;
  danger?: boolean;
  muted?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-1 px-5 pb-4 pt-4">
      <span className="text-caption text-ink-muted">{label}</span>
      <span
        className={cn(
          'nums font-mono text-[32px] font-bold leading-[1.1] tracking-[-0.04em]',
          danger ? 'text-coral' : warning ? 'text-orange-600' : muted ? 'text-ink-muted' : 'text-navy',
        )}
      >
        {value !== undefined ? value.toLocaleString() : '—'}
      </span>
    </Card>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({
  status,
  expiryDate,
}: {
  status: EmployeeDocumentStatus | undefined;
  expiryDate: string | undefined;
}) {
  const { t } = useTranslation();

  if (!status) return null;

  // Client-side "expiring soon" visual — status is still `valid` server-side
  const effectiveKey: EmployeeDocumentStatus | 'expiring_soon' =
    status === 'valid' && isExpiringSoon(expiryDate) ? 'expiring_soon' : status;

  const labelKey =
    effectiveKey === 'expiring_soon'
      ? 'documents.statusOptions.expiring_soon'
      : `documents.statusOptions.${effectiveKey}`;

  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', STATUS_CLASSES[effectiveKey])}>
      {t(labelKey)}
    </span>
  );
}

// ─── Row Actions ──────────────────────────────────────────────────────────────

function RowActions({
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: {
  onEdit: () => void;
  onDelete: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const { t } = useTranslation();
  if (!canEdit && !canDelete) return null;
  return (
    <div className="flex items-center gap-1">
      {canEdit && (
        <Button variant="ghost" className="h-7 w-7 px-0" aria-label={t('documents.editAction')} onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      )}
      {canDelete && (
        <Button
          variant="ghost"
          className="h-7 w-7 px-0 hover:!text-coral"
          aria-label={t('documents.deleteAction')}
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

// ─── Filter Chips ─────────────────────────────────────────────────────────────

const FILTER_OPTIONS: Array<{ key: string; value: EmployeeDocumentStatus | 'all' }> = [
  { key: 'all',             value: 'all' },
  { key: 'valid',           value: 'valid' },
  { key: 'expired',         value: 'expired' },
  { key: 'pending_renewal', value: 'pending_renewal' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function DocumentsPage() {
  const { t } = useTranslation();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmployeeDocumentStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeDocumentWire | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeDocumentWire | undefined>(undefined);
  const [letterOpen, setLetterOpen] = useState(false);

  // Debounce the free-text search so every keystroke doesn't fire a request.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // A new search/filter invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const params = useMemo<EmployeeDocumentListParams>(
    () => ({
      page,
      perPage: PER_PAGE,
      search: search || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    [page, search, statusFilter],
  );

  const { state, refetch } = useEmployeeDocumentList(params);

  // Stat queries — each reads only `meta.total`, never fabricates numbers.
  const { state: totalState }          = useEmployeeDocumentList({ page: 1, perPage: 1 });
  const { state: validState }          = useEmployeeDocumentList({ page: 1, perPage: 1, status: 'valid' });
  const { state: expiredState }        = useEmployeeDocumentList({ page: 1, perPage: 1, status: 'expired' });
  const { state: pendingState }        = useEmployeeDocumentList({ page: 1, perPage: 1, status: 'pending_renewal' });
  const { state: templateCountState }  = useDocumentTemplateCount();

  // Document type map: id → name (for displaying type name in the table)
  const { state: docTypeState } = useDocumentTypeList();
  const docTypeMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (const dt of docTypeState.data ?? []) {
      map[dt.id] = dt.name;
    }
    return map;
  }, [docTypeState.data]);

  const deleteMutation = useDeleteEmployeeDocument(params);
  const canCreate = useCan('document', 'create');
  const canEdit = useCan('document', 'edit');
  const canDelete = useCan('document', 'delete');
  const canGenerate = useCan('document_template', 'view');

  // Client-side sorting
  type DocSortCol = 'employee' | 'documentType' | 'documentNumber' | 'issueDate' | 'expiryDate' | 'status';
  const { sort, toggle: toggleSort } = useSort<DocSortCol>();
  const SORT_ACCESSORS: Record<DocSortCol, (d: EmployeeDocumentWire) => string | number | undefined> = {
    employee:       (d) => `${d.employee?.first_name ?? ''} ${d.employee?.last_name ?? ''}`,
    documentType:   (d) => d.document_type?.name ?? docTypeMap[d.document_type_id] ?? '',
    documentNumber: (d) => d.document_number ?? '',
    issueDate:      (d) => d.issue_date ?? '',
    expiryDate:     (d) => d.expiry_date ?? '',
    status:         (d) => d.status ?? '',
  };
  const rawRecords = state.data?.data ?? [];
  const records = sortData(rawRecords, sort, SORT_ACCESSORS);
  const meta = state.data?.meta;

  const exportColumns: ExportColumn[] = [
    { key: 'employee', label: t('documents.table.employee') },
    { key: 'documentType', label: t('documents.table.documentType') },
    { key: 'documentNumber', label: t('documents.table.documentNumber') },
    { key: 'issueDate', label: t('documents.table.issueDate') },
    { key: 'expiryDate', label: t('documents.table.expiryDate') },
    { key: 'status', label: t('documents.table.status') },
  ];

  const exportData = records.map((d) => ({
    employee: `${d.employee?.first_name ?? ''} ${d.employee?.last_name ?? ''}`.trim(),
    documentType: d.document_type?.name ?? docTypeMap[d.document_type_id] ?? '',
    documentNumber: d.document_number ?? '',
    issueDate: formatDate(d.issue_date),
    expiryDate: formatDate(d.expiry_date),
    status: d.status ? t(`documents.statusOptions.${d.status}`) : '',
  }));

  function openAddForm() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function openEditForm(record: EmployeeDocumentWire) {
    setEditTarget(record);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await deleteMutation.mutate(deleteTarget.id);
    if (result !== undefined || deleteMutation.error === undefined) setDeleteTarget(undefined);
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t('documents.title')}
        actions={
          <div className="flex items-center gap-2">
            <ExportButton data={exportData} columns={exportColumns} filename="documents" />
            {canGenerate && (
              <Button variant="secondary" onClick={() => setLetterOpen(true)}>
                <FileText className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                {t('documents.generateLetter')}
              </Button>
            )}
            {canCreate && (
              <Button variant="primary" onClick={openAddForm}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                {t('documents.addDocument')}
              </Button>
            )}
          </div>
        }
      />

      {/* Stat strip */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label={t('documents.stat.totalDocuments')} value={totalState.data?.meta.total} />
        <StatCard label={t('documents.stat.valid')} value={validState.data?.meta.total} />
        <StatCard label={t('documents.stat.expired')} value={expiredState.data?.meta.total} danger />
        <StatCard label={t('documents.stat.pendingRenewal')} value={pendingState.data?.meta.total} warning />
        <StatCard label={t('documents.stat.templates')} value={templateCountState.data} muted />
      </div>

      {/* Toolbar: search + filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <label className="relative flex items-center">
          <span className="pointer-events-none absolute start-3 text-ink-faint">
            <Search className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <input
            type="search"
            placeholder={t('documents.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={cn(
              'h-9 rounded-full border border-hairline bg-surface ps-8 pe-4 text-[13px] text-ink placeholder:text-ink-faint',
              'focus:outline-none focus:ring-1 focus:ring-navy/40',
              'w-52',
            )}
          />
        </label>

        {/* Status filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors',
                statusFilter === opt.value
                  ? 'border-navy bg-navy text-on-navy'
                  : 'border-hairline bg-surface text-ink-muted hover:border-navy/40 hover:text-ink',
              )}
            >
              {opt.value === 'all'
                ? t('documents.filter.all')
                : t(`documents.statusOptions.${opt.value}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Load failure */}
      {state.error ? (
        <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>{userFacingMessage(state.error) || t('documents.loadFailed')}</span>
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {/* Initial load */}
      {state.status === 'pending' && records.length === 0 ? (
        <SkeletonTable />
      ) : null}

      {/* Empty state */}
      {state.status !== 'pending' && records.length === 0 && (
        <Card className="px-5 py-10 text-center text-body-sm text-ink-muted">{t('documents.emptySearch')}</Card>
      )}

      {records.length > 0 && (
        <>
          {/* Documents table — desktop/tablet-landscape */}
          <Card className="hidden lg:block">
            {/* Header */}
            <div className="border-b border-divider px-5 py-3">
              <div className="grid grid-cols-[2.5fr_1.5fr_1.5fr_1fr_1fr_1fr_auto] items-center gap-4">
                {(['employee', 'documentType', 'documentNumber', 'issueDate', 'expiryDate', 'status'] as const).map(
                  (col) => (
                    <SortableHeader key={col} column={col} label={t(`documents.table.${col}`)} sort={sort} onSort={toggleSort} />
                  ),
                )}
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('documents.table.actions')}
                </span>
              </div>
            </div>

            {records.map((doc, idx) => (
              <div
                key={doc.id}
                className={cn(
                  'grid grid-cols-[2.5fr_1.5fr_1.5fr_1fr_1fr_1fr_auto] items-center gap-4 px-5 py-3',
                  idx < records.length - 1 && 'border-b border-divider',
                  'cursor-pointer transition-colors hover:bg-surface/60',
                )}
              >
                {/* Employee */}
                <div className="flex min-w-0 items-center gap-3">
                  {doc.employee ? (
                    <Avatar
                      initials={initialsOf(doc.employee.first_name, doc.employee.last_name)}
                      photo={doc.employee.photo}
                      size={32}
                    />
                  ) : (
                    <Avatar initials="??" size={32} />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-ink">
                      {doc.employee
                        ? `${doc.employee.first_name} ${doc.employee.last_name}`
                        : `#${doc.employee_id}`}
                    </p>
                    <p className="truncate text-caption text-ink-muted">
                      {doc.employee?.employee_number ?? ''}
                    </p>
                  </div>
                </div>

                {/* Document type */}
                <span className="truncate text-body-sm text-ink-muted">
                  {doc.document_type?.name ?? docTypeMap[doc.document_type_id] ?? `#${doc.document_type_id}`}
                </span>

                {/* Document number */}
                <span className="nums font-mono text-[12px] text-ink-muted">
                  {doc.document_number ?? '—'}
                </span>

                {/* Issue date */}
                <span className="nums font-mono text-[12px] text-ink-muted">
                  {formatDate(doc.issue_date)}
                </span>

                {/* Expiry date */}
                <span
                  className={cn(
                    'nums font-mono text-[12px]',
                    doc.status === 'expired'
                      ? 'font-semibold text-red-500'
                      : doc.status === 'valid' && isExpiringSoon(doc.expiry_date)
                      ? 'font-semibold text-orange-600'
                      : 'text-ink-muted',
                  )}
                >
                  {formatDate(doc.expiry_date)}
                </span>

                {/* Status */}
                <StatusBadge status={doc.status} expiryDate={doc.expiry_date} />

                {/* Actions */}
                <RowActions
                  onEdit={() => openEditForm(doc)}
                  onDelete={() => setDeleteTarget(doc)}
                  canEdit={canEdit}
                  canDelete={canDelete}
                />
              </div>
            ))}
          </Card>

          {/* Document cards — mobile/tablet-portrait */}
          <div className="flex flex-col gap-3 lg:hidden">
            {records.map((doc) => (
              <Card key={doc.id} className="flex flex-col gap-3 p-4">
                {/* Identity + status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {doc.employee ? (
                      <Avatar
                        initials={initialsOf(doc.employee.first_name, doc.employee.last_name)}
                        photo={doc.employee.photo}
                        size={36}
                      />
                    ) : (
                      <Avatar initials="??" size={36} />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-body-sm font-semibold text-ink">
                        {doc.employee
                          ? `${doc.employee.first_name} ${doc.employee.last_name}`
                          : `#${doc.employee_id}`}
                      </p>
                      <p className="truncate text-caption text-ink-muted">
                        {doc.employee?.employee_number ?? ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusBadge status={doc.status} expiryDate={doc.expiry_date} />
                    <RowActions
                      onEdit={() => openEditForm(doc)}
                      onDelete={() => setDeleteTarget(doc)}
                      canEdit={canEdit}
                      canDelete={canDelete}
                    />
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3 border-t border-divider pt-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('documents.table.documentType')}</span>
                    <span className="truncate text-[12px] text-ink">
                      {doc.document_type?.name ?? docTypeMap[doc.document_type_id] ?? `#${doc.document_type_id}`}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('documents.table.documentNumber')}</span>
                    <span className="nums font-mono text-[12px] text-ink">{doc.document_number ?? '—'}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('documents.table.issueDate')}</span>
                    <span className="nums font-mono text-[12px] text-ink">{formatDate(doc.issue_date)}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('documents.table.expiryDate')}</span>
                    <span
                      className={cn(
                        'nums font-mono text-[12px]',
                        doc.status === 'expired'
                          ? 'font-semibold text-red-500'
                          : doc.status === 'valid' && isExpiringSoon(doc.expiry_date)
                          ? 'font-semibold text-orange-600'
                          : 'text-ink',
                      )}
                    >
                      {formatDate(doc.expiry_date)}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {meta ? (
            <Pagination
              currentPage={meta.current_page}
              lastPage={meta.last_page}
              total={meta.total}
              perPage={meta.per_page}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}

      <EmployeeDocumentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        record={editTarget}
      />

      <ConfirmDialog
        open={deleteTarget !== undefined}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t('documents.deleteConfirm.title')}
        description={
          deleteTarget
            ? t('documents.deleteConfirm.description', {
                name: deleteTarget.employee
                  ? `${deleteTarget.employee.first_name} ${deleteTarget.employee.last_name}`
                  : `#${deleteTarget.employee_id}`,
                title: deleteTarget.title,
              })
            : undefined
        }
        isLoading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
      />

      <LetterGenerator open={letterOpen} onOpenChange={setLetterOpen} />
    </div>
  );
}
