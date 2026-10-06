import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { userFacingMessage } from '@/lib/api/errors';
import { useDeleteJobPosting, useJobPostingList } from '../api/queries';
import type { JobPostingListParams, JobPostingStatus } from '../api/resource';
import type { JobPostingWire } from '../api/schema';
import { JobPostingFormDialog } from './JobPostingFormDialog';
import { pipelineStages } from '../data';

/**
 * The Recruitment module's job-postings page: live data backed by
 * `useJobPostingList`, Add/Edit via `JobPostingFormDialog`, delete via
 * `ConfirmDialog` + optimistic `useDeleteJobPosting`, and page controls via
 * the shared `Pagination`. Mirrors `EmployeesPage` exactly.
 *
 * The static `PipelineStage` mini-visualization is kept as-is — it is a
 * cosmetic widget unconnected to the job-postings CRUD (candidates pipeline
 * is out of scope for this task).
 */

const PER_PAGE = 10;

const STATUS_CLASSES: Record<JobPostingStatus, string> = {
  open: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-slate-100 text-slate-600',
  draft: 'bg-amber-50 text-amber-700',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: number | undefined; accent?: boolean }) {
  return (
    <Card className="flex flex-col gap-1 px-5 pb-4 pt-4">
      <span className="text-caption text-ink-muted">{label}</span>
      <span
        className={cn(
          'nums font-mono text-[32px] font-bold leading-[1.1] tracking-[-0.04em]',
          accent ? 'text-coral' : 'text-navy',
        )}
      >
        {value !== undefined ? value.toLocaleString() : '—'}
      </span>
    </Card>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: JobPostingStatus }) {
  const { t } = useTranslation();
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', STATUS_CLASSES[status])}>
      {t(`recruitment.status.${status}`)}
    </span>
  );
}

// ─── Row Actions ─────────────────────────────────────────────────────────────

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        className="h-7 w-7 px-0"
        aria-label={t('recruitment.editAction')}
        onClick={onEdit}
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        className="h-7 w-7 px-0 hover:!text-coral"
        aria-label={t('recruitment.deleteAction')}
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      </Button>
    </div>
  );
}

// ─── Filter Chips ─────────────────────────────────────────────────────────────

const FILTER_OPTIONS: Array<{ key: string; value: JobPostingStatus | 'all' }> = [
  { key: 'all', value: 'all' },
  { key: 'open', value: 'open' },
  { key: 'draft', value: 'draft' },
  { key: 'closed', value: 'closed' },
];

// ─── Pipeline Visualization (static / cosmetic) ───────────────────────────────

function Pipeline() {
  const { t } = useTranslation();
  return (
    <Card className="mb-8 px-5 py-5">
      <p className="mb-4 text-caption font-semibold uppercase tracking-wide text-ink-faint">
        {t('recruitment.hiringPipeline')}
      </p>
      <div className="flex items-center gap-0">
        {pipelineStages.map((stage, idx) => (
          <div key={stage.label} className="flex items-center">
            <div
              className={cn(
                'flex flex-col items-center justify-center rounded-[3px] border border-hairline bg-surface px-5 py-3 text-center',
                idx === 0 && 'border-navy bg-navy/5',
              )}
            >
              <span
                className={cn(
                  'nums font-mono text-[28px] font-bold leading-[1.1] tracking-[-0.04em]',
                  idx === 0 ? 'text-navy' : 'text-ink',
                )}
              >
                {stage.count}
              </span>
              <span className="mt-0.5 text-caption text-ink-muted">{stage.label}</span>
            </div>
            {idx < pipelineStages.length - 1 && (
              <span className="mx-2 select-none text-[20px] font-light text-ink-faint">→</span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function RecruitmentPage() {
  const { t } = useTranslation();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobPostingStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<JobPostingWire | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<JobPostingWire | undefined>(undefined);

  // Debounce the free-text search so every keystroke doesn't fire a request.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // A new search/filter invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const params = useMemo<JobPostingListParams>(
    () => ({
      page,
      perPage: PER_PAGE,
      search: search || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    [page, search, statusFilter],
  );

  const { state, refetch } = useJobPostingList(params);
  const { state: totalState } = useJobPostingList({ page: 1, perPage: 1 });
  const { state: openState } = useJobPostingList({ page: 1, perPage: 1, status: 'open' });
  const { state: closedState } = useJobPostingList({ page: 1, perPage: 1, status: 'closed' });

  const deleteMutation = useDeleteJobPosting(params);

  const postings = state.data?.data ?? [];
  const meta = state.data?.meta;

  function openAddForm() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function openEditForm(posting: JobPostingWire) {
    setEditTarget(posting);
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
        title={t('recruitment.title')}
        actions={
          <Button variant="primary" onClick={openAddForm}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            {t('recruitment.addJobPosting')}
          </Button>
        }
      />

      {/* Stat strip — only numbers genuinely derivable from the list endpoint */}
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t('recruitment.stat.totalPostings')} value={totalState.data?.meta.total} />
        <StatCard label={t('recruitment.stat.openPostings')} value={openState.data?.meta.total} accent />
        <StatCard label={t('recruitment.stat.closedPostings')} value={closedState.data?.meta.total} />
      </div>

      {/* Pipeline (static, cosmetic) */}
      <Pipeline />

      {/* Toolbar: search + status filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <label className="relative flex items-center">
          <span className="pointer-events-none absolute left-3 text-ink-faint">
            <Search className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <input
            type="search"
            placeholder={t('recruitment.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={cn(
              'h-9 rounded-full border border-hairline bg-surface pl-8 pr-4 text-[13px] text-ink placeholder:text-ink-faint',
              'focus:outline-none focus:ring-1 focus:ring-navy/40',
              'w-52',
            )}
          />
        </label>

        {/* Status filter chips */}
        <div className="flex items-center gap-1.5">
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
              {t(`recruitment.filter.${opt.key}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Load failure */}
      {state.error ? (
        <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>{userFacingMessage(state.error) || t('recruitment.loadFailed')}</span>
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {/* Initial load */}
      {state.status === 'pending' && postings.length === 0 ? (
        <Card className="px-5 py-10 text-center text-body-sm text-ink-muted">{t('common.loading')}</Card>
      ) : null}

      {/* Empty state */}
      {state.status !== 'pending' && postings.length === 0 && (
        <Card className="px-5 py-10 text-center text-body-sm text-ink-muted">{t('recruitment.emptySearch')}</Card>
      )}

      {postings.length > 0 && (
        <>
          {/* Desktop/tablet-landscape table */}
          <Card className="hidden lg:block">
            {/* Header */}
            <div className="border-b border-divider px-5 py-3">
              <div className="grid grid-cols-[2.5fr_1.5fr_1.5fr_1fr_1fr_auto] gap-4">
                {(['position', 'location', 'posted', 'status', 'employmentType'] as const).map((col) => (
                  <span key={col} className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                    {t(`recruitment.table.${col}`)}
                  </span>
                ))}
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('recruitment.table.actions')}
                </span>
              </div>
            </div>

            {postings.map((posting, idx) => (
              <div
                key={posting.id}
                className={cn(
                  'grid grid-cols-[2.5fr_1.5fr_1.5fr_1fr_1fr_auto] items-center gap-4 px-5 py-3',
                  idx < postings.length - 1 && 'border-b border-divider',
                  'transition-colors hover:bg-surface/60',
                )}
              >
                {/* Title */}
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-semibold text-ink">{posting.title}</p>
                </div>

                {/* Location */}
                <span className="truncate text-body-sm text-ink-muted">
                  {posting.location ?? '—'}
                </span>

                {/* Posted date */}
                <span className="nums font-mono text-[12px] text-ink-muted">
                  {posting.published_at ? formatDate(posting.published_at) : '—'}
                </span>

                {/* Status */}
                <StatusBadge status={posting.status} />

                {/* Employment type */}
                <span className="text-body-sm text-ink-muted">
                  {t(`recruitment.form.employmentTypeOptions.${posting.employment_type}`)}
                </span>

                {/* Actions */}
                <RowActions
                  onEdit={() => openEditForm(posting)}
                  onDelete={() => setDeleteTarget(posting)}
                />
              </div>
            ))}
          </Card>

          {/* Mobile/tablet-portrait cards */}
          <div className="flex flex-col gap-3 lg:hidden">
            {postings.map((posting) => (
              <Card key={posting.id} className="flex flex-col gap-3 p-4">
                {/* Title + status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-ink">{posting.title}</p>
                    {posting.location ? (
                      <p className="truncate text-caption text-ink-muted">{posting.location}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusBadge status={posting.status} />
                    <RowActions
                      onEdit={() => openEditForm(posting)}
                      onDelete={() => setDeleteTarget(posting)}
                    />
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3 border-t border-divider pt-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('recruitment.table.employmentType')}</span>
                    <span className="text-body-sm text-ink">
                      {t(`recruitment.form.employmentTypeOptions.${posting.employment_type}`)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('recruitment.table.posted')}</span>
                    <span className="nums font-mono text-[12px] text-ink">
                      {posting.published_at ? formatDate(posting.published_at) : '—'}
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

      <JobPostingFormDialog open={formOpen} onOpenChange={setFormOpen} posting={editTarget} />

      <ConfirmDialog
        open={deleteTarget !== undefined}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t('recruitment.deleteConfirm.title')}
        description={
          deleteTarget
            ? t('recruitment.deleteConfirm.description', { title: deleteTarget.title })
            : undefined
        }
        isLoading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
