import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Download, Eye, FileText, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonTable } from '@/components/ui/SkeletonTable';
import { toast } from '@/components/ui/Toast';
import { userFacingMessage } from '@/lib/api/errors';
import { useHasPermission } from '@/auth/session';
import {
  downloadGeneratedDocument,
  useFinalizeGeneratedDocument,
  useGeneratedDocumentList,
} from '../api/generatedDocuments';
import type {
  GeneratedDocumentStatus,
  GeneratedDocumentWire,
} from '../api/generatedDocuments';
import { GenerateDocumentDialog } from './GenerateDocumentDialog';
import { GeneratedDocumentViewDialog } from './GeneratedDocumentViewDialog';

const PER_PAGE = 10;

const STATUS_CLASSES: Record<GeneratedDocumentStatus, string> = {
  draft: 'bg-amber-50 text-amber-700',
  final: 'bg-emerald-50 text-emerald-700',
  revoked: 'bg-red-50 text-red-700',
};

const FILTERS: readonly (GeneratedDocumentStatus | 'all')[] = ['all', 'draft', 'final', 'revoked'];

function formatDate(value: string | undefined, language: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(language.startsWith('ar') ? 'ar-EG' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function employeeNameOf(document: GeneratedDocumentWire): string {
  if (!document.employee) return `#${document.employee_id}`;
  return document.employee.first_name_ar && document.employee.last_name_ar
    ? `${document.employee.first_name_ar} ${document.employee.last_name_ar}`
    : `${document.employee.first_name} ${document.employee.last_name}`;
}

/**
 * Generated-document register (A6.3): list + search + status filters, with
 * create / preview / view / download / finalize / revoke. The legacy
 * `LetterGenerator` stays available on the first tab as a fallback.
 */
export function GeneratedDocumentsTab() {
  const { t, i18n } = useTranslation();
  const canCreate = useHasPermission('document.generated_document.create');
  const canFinalize = useHasPermission('document.generated_document.finalize');

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<GeneratedDocumentStatus | 'all'>('all');

  const [generateOpen, setGenerateOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<GeneratedDocumentWire | undefined>(undefined);
  const [finalizeTarget, setFinalizeTarget] = useState<GeneratedDocumentWire | undefined>(undefined);

  const [downloadingId, setDownloadingId] = useState<number | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const { state, refetch } = useGeneratedDocumentList({
    page,
    perPage: PER_PAGE,
    search: search || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  const finalizeMutation = useFinalizeGeneratedDocument();

  const documents = state.data?.data ?? [];
  const meta = state.data?.meta;

  async function handleFinalize() {
    if (!finalizeTarget) return;
    try {
      await finalizeMutation.mutateAsync(finalizeTarget.id);
      toast.success(t('documents.generated.finalizedToast'));
      setFinalizeTarget(undefined);
    } catch (error) {
      toast.error(userFacingMessage(error));
    }
  }

  async function handleDownload(document: GeneratedDocumentWire) {
    setDownloadingId(document.id);
    try {
      await downloadGeneratedDocument(document);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message.includes('404')
          ? t('documents.generated.downloadUnavailable')
          : userFacingMessage(error),
      );
    } finally {
      setDownloadingId(undefined);
    }
  }

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative flex items-center">
          <span className="pointer-events-none absolute start-3 text-ink-faint">
            <Search className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <input
            type="search"
            placeholder={t('documents.generated.searchPlaceholder')}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className={cn(
              'h-9 rounded-full border border-hairline bg-surface ps-8 pe-4 text-[13px] text-ink placeholder:text-ink-faint',
              'focus:outline-none focus:ring-1 focus:ring-navy/40',
              'w-60',
            )}
          />
        </label>

        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={cn(
                'rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors',
                statusFilter === value
                  ? 'border-navy bg-navy text-on-navy'
                  : 'border-hairline bg-surface text-ink-muted hover:border-navy/40 hover:text-ink',
              )}
            >
              {value === 'all'
                ? t('documents.generated.filter.all')
                : t(`documents.generated.status.${value}`)}
            </button>
          ))}
        </div>

        <div className="ms-auto">
          {canCreate ? (
            <Button variant="primary" onClick={() => setGenerateOpen(true)}>
              <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              {t('documents.generated.generate')}
            </Button>
          ) : null}
        </div>
      </div>

      {state.error ? (
        <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>{userFacingMessage(state.error) || t('documents.generated.loadFailed')}</span>
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {state.status === 'pending' && documents.length === 0 ? <SkeletonTable /> : null}

      {state.status !== 'pending' && documents.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 px-5 py-12 text-center">
          <FileText className="h-7 w-7 text-ink-faint" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-body-sm text-ink-muted">{t('documents.generated.empty')}</p>
        </Card>
      ) : null}

      {documents.length > 0 ? (
        <>
          {/* Desktop table */}
          <Card className="hidden lg:block">
            <div className="border-b border-divider px-5 py-3">
              <div className="grid grid-cols-[2.2fr_1.4fr_1.3fr_1fr_0.9fr_auto] items-center gap-4">
                {(['document', 'employee', 'template', 'generatedAt', 'status'] as const).map((col) => (
                  <span
                    key={col}
                    className="text-caption font-semibold uppercase tracking-wide text-ink-faint"
                  >
                    {t(`documents.generated.table.${col}`)}
                  </span>
                ))}
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('documents.generated.table.actions')}
                </span>
              </div>
            </div>

            {documents.map((document, index) => (
              <div
                key={document.id}
                className={cn(
                  'grid grid-cols-[2.2fr_1.4fr_1.3fr_1fr_0.9fr_auto] items-center gap-4 px-5 py-3',
                  index < documents.length - 1 && 'border-b border-divider',
                  'transition-colors hover:bg-surface/60',
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-semibold text-ink">{document.title}</p>
                  <p className="truncate font-mono text-[11px] text-ink-muted" dir="ltr">
                    {document.reference_number}
                  </p>
                </div>
                <span className="truncate text-body-sm text-ink-muted">
                  {employeeNameOf(document)}
                </span>
                <span className="truncate text-body-sm text-ink-muted">
                  {document.template?.name ?? '—'}
                </span>
                <span className="nums font-mono text-[12px] text-ink-muted">
                  {formatDate(document.generated_at, i18n.language)}
                </span>
                <span
                  className={cn(
                    'w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                    STATUS_CLASSES[document.status],
                  )}
                >
                  {t(`documents.generated.status.${document.status}`)}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    className="h-7 w-7 px-0"
                    aria-label={t('documents.generated.view')}
                    onClick={() => setViewTarget(document)}
                  >
                    <Eye className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                  </Button>
                  {document.file_path ? (
                    <Button
                      variant="ghost"
                      className="h-7 w-7 px-0"
                      aria-label={t('documents.generated.download')}
                      isLoading={downloadingId === document.id}
                      onClick={() => void handleDownload(document)}
                    >
                      <Download className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </Button>
                  ) : null}
                  {canFinalize && document.status === 'draft' ? (
                    <Button
                      variant="ghost"
                      className="h-7 w-7 px-0 hover:!text-emerald-600"
                      aria-label={t('documents.generated.finalize')}
                      onClick={() => setFinalizeTarget(document)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </Card>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 lg:hidden">
            {documents.map((document) => (
              <Card key={document.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-ink">{document.title}</p>
                    <p className="truncate font-mono text-[11px] text-ink-muted" dir="ltr">
                      {document.reference_number}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                      STATUS_CLASSES[document.status],
                    )}
                  >
                    {t(`documents.generated.status.${document.status}`)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-divider pt-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">
                      {t('documents.generated.table.employee')}
                    </span>
                    <span className="truncate text-[12px] text-ink">{employeeNameOf(document)}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">
                      {t('documents.generated.table.template')}
                    </span>
                    <span className="truncate text-[12px] text-ink">
                      {document.template?.name ?? '—'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">
                      {t('documents.generated.table.generatedAt')}
                    </span>
                    <span className="nums font-mono text-[12px] text-ink">
                      {formatDate(document.generated_at, i18n.language)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    className="h-7 w-7 px-0"
                    aria-label={t('documents.generated.view')}
                    onClick={() => setViewTarget(document)}
                  >
                    <Eye className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                  </Button>
                  {document.file_path ? (
                    <Button
                      variant="ghost"
                      className="h-7 w-7 px-0"
                      aria-label={t('documents.generated.download')}
                      isLoading={downloadingId === document.id}
                      onClick={() => void handleDownload(document)}
                    >
                      <Download className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </Button>
                  ) : null}
                  {canFinalize && document.status === 'draft' ? (
                    <Button
                      variant="ghost"
                      className="h-7 w-7 px-0 hover:!text-emerald-600"
                      aria-label={t('documents.generated.finalize')}
                      onClick={() => setFinalizeTarget(document)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </Button>
                  ) : null}
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
      ) : null}

      <GenerateDocumentDialog open={generateOpen} onOpenChange={setGenerateOpen} />

      <GeneratedDocumentViewDialog
        document={viewTarget}
        onClose={() => setViewTarget(undefined)}
      />

      <ConfirmDialog
        open={finalizeTarget !== undefined}
        onOpenChange={(open) => !open && setFinalizeTarget(undefined)}
        title={t('documents.generated.finalizeConfirm.title')}
        description={t('documents.generated.finalizeConfirm.description')}
        isLoading={finalizeMutation.isPending}
        onConfirm={() => void handleFinalize()}
      />
    </div>
  );
}
