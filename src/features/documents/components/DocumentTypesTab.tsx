import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/form';
import { isApiError, userFacingMessage } from '@/lib/api/errors';
import { useHasPermission, useSession } from '@/auth/session';
import { useDeleteDocumentType, useDocumentTypePage } from '../api/queries';
import type { DocumentTypeCategory, DocumentTypeListParams } from '../api/resource';
import type { DocumentTypeWire } from '../api/schema';
import { DocumentTypeFormDialog } from './DocumentTypeFormDialog';

const PER_PAGE = 10;

const CATEGORY_VALUES: DocumentTypeCategory[] = [
  'identification',
  'contract',
  'certificate',
  'license',
  'other',
];

type CategoryFilter = DocumentTypeCategory | 'all';

function BooleanBadge({ value }: { value: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={
        value
          ? 'rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700'
          : 'rounded-full bg-surface-hover px-2.5 py-0.5 text-[11px] font-semibold text-ink-faint'
      }
    >
      {value ? t('documents.documentTypes.yes') : t('documents.documentTypes.no')}
    </span>
  );
}

interface RowActionsProps {
  row: DocumentTypeWire;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (row: DocumentTypeWire) => void;
  onDelete: (row: DocumentTypeWire) => void;
}

function RowActions({ row, canEdit, canDelete, onEdit, onDelete }: RowActionsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      {canEdit ? (
        <Button
          variant="ghost"
          className="h-7 w-7 px-0 text-ink-faint hover:text-ink"
          aria-label={`${t('documents.documentTypes.actions.edit')}: ${row.name}`}
          title={t('documents.documentTypes.actions.edit')}
          onClick={() => onEdit(row)}
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      ) : null}
      {canDelete ? (
        <Button
          variant="ghost"
          className="h-7 w-7 px-0 text-ink-faint hover:text-coral"
          aria-label={`${t('documents.documentTypes.actions.delete')}: ${row.name}`}
          title={t('documents.documentTypes.actions.delete')}
          onClick={() => onDelete(row)}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

function DocumentTypesSkeleton() {
  return (
    <Card className="overflow-hidden" aria-busy="true" aria-label="Loading document types…">
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className="flex items-center gap-4 border-b border-divider px-5 py-3.5 last:border-b-0"
        >
          <div className="h-4 w-44 animate-pulse rounded bg-divider" />
          <div className="h-4 w-28 animate-pulse rounded bg-divider" />
          <div className="h-4 w-16 animate-pulse rounded bg-divider" />
          <div className="h-4 w-16 animate-pulse rounded bg-divider" />
        </div>
      ))}
    </Card>
  );
}

/**
 * Settings → Document Types.
 *
 * Full CRUD over `Route::apiResource('document-types')`: desktop table,
 * mobile cards, server-side pagination, category filter, and a nested
 * `ConfirmDialog` for deletes. Create/edit share one form component (mounted
 * twice, once per mode) so Radix can animate the close.
 */
export function DocumentTypesTab() {
  const { t } = useTranslation();
  const { user } = useSession();

  const canCreate = useHasPermission('document.document_type.create');
  const canEdit = useHasPermission('document.document_type.edit');
  const canDelete = useHasPermission('document.document_type.delete');

  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DocumentTypeWire | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentTypeWire | null>(null);

  const params = useMemo<DocumentTypeListParams>(
    () => ({
      page,
      perPage: PER_PAGE,
      sort: 'sort_order',
      direction: 'asc',
      ...(category === 'all' ? {} : { category }),
    }),
    [page, category],
  );

  const { state, refetch } = useDocumentTypePage(params);
  const {
    mutate: deleteDocumentType,
    isPending: isDeleting,
    error: deleteError,
    reset: resetDeleteError,
  } = useDeleteDocumentType();

  const rows = state.data?.data ?? [];
  const meta = state.data?.meta;

  function handleCategoryChange(value: CategoryFilter) {
    setCategory(value);
    setPage(1);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteDocumentType(deleteTarget.id);
    if (result === true) {
      // Deleting the last row on a page would otherwise leave it empty.
      if (rows.length === 1 && page > 1) setPage((current) => current - 1);
      setDeleteTarget(null);
      resetDeleteError();
    }
  }

  const deleteDescription = deleteTarget
    ? isApiError(deleteError) && deleteError.status === 409
      ? t('documents.documentTypes.deleteConfirm.inUse', { name: deleteTarget.name })
      : deleteError
        ? t('documents.documentTypes.deleteConfirm.failed', {
            message: userFacingMessage(deleteError),
          })
        : t('documents.documentTypes.deleteConfirm.description', { name: deleteTarget.name })
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-ink">
            {t('documents.documentTypes.title')}
          </h2>
          <p className="mt-0.5 text-body-sm text-ink-muted">
            {t('documents.documentTypes.subtitle')}
          </p>
        </div>
        {canCreate ? (
          <Button
            variant="primary"
            onClick={() => setAddOpen(true)}
            disabled={user.companyId === undefined}
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            {t('documents.documentTypes.add')}
          </Button>
        ) : null}
      </div>

      {canCreate && user.companyId === undefined ? (
        <p
          role="alert"
          className="rounded-[3px] border border-coral/30 bg-coral/5 px-4 py-2 text-caption text-coral"
        >
          {t('documents.documentTypes.noCompany')}
        </p>
      ) : null}

      {/* Category filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="document-type-category-filter" className="text-caption font-semibold text-ink-muted">
          {t('documents.documentTypes.filterLabel')}
        </label>
        <Select
          id="document-type-category-filter"
          value={category}
          onChange={(event) => handleCategoryChange(event.target.value as CategoryFilter)}
          className="max-w-[220px]"
        >
          <option value="all">{t('documents.documentTypes.filterAll')}</option>
          {CATEGORY_VALUES.map((value) => (
            <option key={value} value={value}>
              {t(`documents.documentTypes.categories.${value}`)}
            </option>
          ))}
        </Select>
      </div>

      {/* Loading / error / empty */}
      {state.status === 'pending' ? <DocumentTypesSkeleton /> : null}

      {state.status === 'error' ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-body-sm text-coral">{userFacingMessage(state.error)}</p>
            <Button variant="ghost" onClick={refetch}>
              {t('common.retry')}
            </Button>
          </div>
        </Card>
      ) : null}

      {state.status === 'success' && rows.length === 0 ? (
        <Card>
          <div className="py-12 text-center text-body-sm text-ink-muted">
            {t('documents.documentTypes.empty')}
          </div>
        </Card>
      ) : null}

      {/* Desktop table */}
      {state.status === 'success' && rows.length > 0 ? (
        <Card className="hidden overflow-hidden md:block">
          <div className="grid grid-cols-[2fr_1.2fr_1fr_1fr_0.8fr_120px] gap-4 border-b border-divider bg-surface px-5 py-2.5">
            <span className="text-caption font-semibold text-ink-muted">
              {t('documents.documentTypes.columns.name')}
            </span>
            <span className="text-caption font-semibold text-ink-muted">
              {t('documents.documentTypes.columns.category')}
            </span>
            <span className="text-caption font-semibold text-ink-muted">
              {t('documents.documentTypes.columns.hasExpiry')}
            </span>
            <span className="text-caption font-semibold text-ink-muted">
              {t('documents.documentTypes.columns.required')}
            </span>
            <span className="text-caption font-semibold text-ink-muted">
              {t('documents.documentTypes.columns.sortOrder')}
            </span>
            <span className="text-caption font-semibold text-ink-muted">
              {t('documents.documentTypes.columns.actions')}
            </span>
          </div>

          {rows.map((row, index) => (
            <div
              key={row.id}
              className={`grid grid-cols-[2fr_1.2fr_1fr_1fr_0.8fr_120px] items-center gap-4 px-5 py-3.5 ${
                index < rows.length - 1 ? 'border-b border-divider' : ''
              }`}
            >
              <span className="truncate text-body-sm font-medium text-ink">{row.name}</span>
              <span className="text-body-sm text-ink-muted">
                {row.category
                  ? t(`documents.documentTypes.categories.${row.category}`)
                  : '—'}
              </span>
              <span>
                <BooleanBadge value={row.has_expiry ?? false} />
              </span>
              <span>
                <BooleanBadge value={row.is_required ?? false} />
              </span>
              <span className="nums text-body-sm text-ink-muted">{row.sort_order ?? '—'}</span>
              <RowActions
                row={row}
                canEdit={canEdit}
                canDelete={canDelete}
                onEdit={setEditTarget}
                onDelete={setDeleteTarget}
              />
            </div>
          ))}
        </Card>
      ) : null}

      {/* Mobile cards */}
      {state.status === 'success' && rows.length > 0 ? (
        <div className="flex flex-col gap-3 md:hidden">
          {rows.map((row) => (
            <Card key={row.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="text-body-sm font-medium text-ink">{row.name}</span>
                <RowActions
                  row={row}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onEdit={setEditTarget}
                  onDelete={setDeleteTarget}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-surface-hover px-2.5 py-0.5 text-[11px] font-semibold text-ink-muted">
                  {row.category
                    ? t(`documents.documentTypes.categories.${row.category}`)
                    : '—'}
                </span>
                <BooleanBadge value={row.has_expiry ?? false} />
                <BooleanBadge value={row.is_required ?? false} />
                <span className="nums text-caption text-ink-faint">
                  {t('documents.documentTypes.columns.sortOrder')}: {row.sort_order ?? '—'}
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Pagination */}
      {state.status === 'success' && meta ? (
        <Pagination
          currentPage={meta.current_page}
          lastPage={meta.last_page}
          total={meta.total}
          perPage={meta.per_page}
          onPageChange={setPage}
        />
      ) : null}

      {/* Dialogs — always mounted so Radix can animate the close */}
      <DocumentTypeFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        documentType={null}
        companyId={user.companyId}
      />
      <DocumentTypeFormDialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        documentType={editTarget}
        companyId={user.companyId}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            resetDeleteError();
          }
        }}
        title={t('documents.documentTypes.deleteConfirm.title')}
        description={deleteDescription}
        confirmLabel={t('documents.documentTypes.deleteConfirm.submit')}
        isLoading={isDeleting}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
