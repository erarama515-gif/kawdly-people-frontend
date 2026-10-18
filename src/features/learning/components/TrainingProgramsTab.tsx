import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { SkeletonTable } from '@/components/ui/SkeletonTable';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { userFacingMessage } from '@/lib/api/errors';
import {
  useTrainingProgramList,
  useDeleteTrainingProgram,
} from '../api/queries';
import type { TrainingProgramListParams, TrainingProgramStatus, TrainingProgramType } from '../api/resource';
import type { TrainingProgramWire } from '../api/schema';
import { TrainingProgramFormDialog } from './TrainingProgramFormDialog';
import { TrainingEnrollmentsDialog } from './TrainingEnrollmentsDialog';

/**
 * The "Programs" tab of `LearningPage` — the TrainingProgram live-data view.
 * Mirrors `ContractsPage`:
 * - `useTrainingProgramList` for data
 * - Add/Edit via `TrainingProgramFormDialog`
 * - Delete via `ConfirmDialog` + optimistic `useDeleteTrainingProgram`
 * - Per-program enrollments via `TrainingEnrollmentsDialog` (row action)
 * - `Pagination` for page controls
 * - Debounced search (title)
 * - Status + type filter chips (real backend values)
 * - HONEST stat cards backed by cheap `perPage:1` queries reading `meta.total`
 *
 * Deviations from the old mock page:
 *  - Status enum changed from `active|scheduled|completed|draft` → real
 *    backend values `planned|ongoing|completed|cancelled`.
 *  - Trainer is a single `trainer_name` string; `trainerInitials`/
 *    `trainerPhoto` (mock-only) are gone. Initials are derived client-side from
 *    the name string if you want a visual — currently plain text.
 *  - `enrolled` / `EnrolledBar` are dropped: enrollment counts live on
 *    `TrainingEnrollment` rows, reachable through the per-row enrollments dialog.
 *    `max_participants` is shown as a plain number instead.
 *  - Stat cards replaced with HONEST counts: total / planned / ongoing /
 *    completed (all derived from `meta.total` on cheap filtered queries).
 */

const PER_PAGE = 10;

const STATUS_CLASSES: Record<TrainingProgramStatus, string> = {
  planned: 'bg-sky-50 text-sky-700',
  ongoing: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-surface text-ink-muted border border-divider',
  cancelled: 'bg-red-50 text-red-700',
};

const TYPE_CLASSES: Record<TrainingProgramType, string> = {
  internal: 'bg-sky-50 text-sky-700',
  external: 'bg-violet-50 text-violet-700',
  online: 'bg-emerald-50 text-emerald-700',
};

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | undefined;
  accent?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-1 px-5 pb-4 pt-4">
      <span className="text-caption text-ink-muted">{label}</span>
      <span
        className={cn(
          'nums font-mono text-[32px] font-bold leading-[1.1] tracking-[-0.04em]',
          accent ? 'text-emerald-600' : 'text-navy',
        )}
      >
        {value !== undefined ? value.toLocaleString() : '—'}
      </span>
    </Card>
  );
}

// ─── Type Badge ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: TrainingProgramType }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
        TYPE_CLASSES[type],
      )}
    >
      {t(`learning.typeOptions.${type}`)}
    </span>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TrainingProgramStatus | undefined }) {
  const { t } = useTranslation();
  if (!status) return null;
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
        STATUS_CLASSES[status],
      )}
    >
      {t(`learning.statusOptions.${status}`)}
    </span>
  );
}

// ─── Row Actions ──────────────────────────────────────────────────────────────

function RowActions({
  onEnrollments,
  enrollmentsLabel,
  onEdit,
  onDelete,
}: {
  onEnrollments: () => void;
  enrollmentsLabel: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        className="h-7 w-7 px-0 hover:!text-sky-600"
        aria-label={enrollmentsLabel}
        onClick={onEnrollments}
      >
        <Users className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        className="h-7 w-7 px-0"
        aria-label={t('learning.editAction')}
        onClick={onEdit}
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        className="h-7 w-7 px-0 hover:!text-coral"
        aria-label={t('learning.deleteAction')}
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      </Button>
    </div>
  );
}

// ─── Status Filter Options ────────────────────────────────────────────────────

const STATUS_FILTER_OPTIONS: Array<{ key: string; value: TrainingProgramStatus | 'all' }> = [
  { key: 'all', value: 'all' },
  { key: 'planned', value: 'planned' },
  { key: 'ongoing', value: 'ongoing' },
  { key: 'completed', value: 'completed' },
  { key: 'cancelled', value: 'cancelled' },
];

// ─── Tab ──────────────────────────────────────────────────────────────────────

export function TrainingProgramsTab() {
  const { t } = useTranslation();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TrainingProgramStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TrainingProgramType | 'all'>('all');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TrainingProgramWire | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<TrainingProgramWire | undefined>(undefined);
  /** The program whose enrollment breakdown dialog is open. */
  const [enrollmentsTarget, setEnrollmentsTarget] = useState<TrainingProgramWire | undefined>(
    undefined,
  );

  // Debounce the free-text search so every keystroke doesn't fire a request.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // A new search/filter invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, typeFilter]);

  const params = useMemo<TrainingProgramListParams>(
    () => ({
      page,
      perPage: PER_PAGE,
      search: search || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      type: typeFilter === 'all' ? undefined : typeFilter,
    }),
    [page, search, statusFilter, typeFilter],
  );

  const { state, refetch } = useTrainingProgramList(params);

  // HONEST stat cards — each is a cheap perPage:1 call reading only meta.total.
  const { state: totalState } = useTrainingProgramList({ page: 1, perPage: 1 });
  const { state: plannedState } = useTrainingProgramList({ page: 1, perPage: 1, status: 'planned' });
  const { state: ongoingState } = useTrainingProgramList({ page: 1, perPage: 1, status: 'ongoing' });
  const { state: completedState } = useTrainingProgramList({ page: 1, perPage: 1, status: 'completed' });

  const deleteMutation = useDeleteTrainingProgram(params);

  const programs = state.data?.data ?? [];
  const meta = state.data?.meta;

  function openAddForm() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function openEditForm(program: TrainingProgramWire) {
    setEditTarget(program);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await deleteMutation.mutate(deleteTarget.id);
    if (result !== undefined || deleteMutation.error === undefined) setDeleteTarget(undefined);
  }

  return (
    <div className="flex flex-col">
      {/* Stat strip — honest counts derived from perPage:1 meta.total */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t('learning.stat.total')} value={totalState.data?.meta.total} />
        <StatCard label={t('learning.stat.planned')} value={plannedState.data?.meta.total} />
        <StatCard
          label={t('learning.stat.ongoing')}
          value={ongoingState.data?.meta.total}
          accent
        />
        <StatCard label={t('learning.stat.completed')} value={completedState.data?.meta.total} />
      </div>

      {/* Toolbar: search + status filters + type filters + add */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <label className="relative flex items-center">
          <span className="pointer-events-none absolute start-3 text-ink-faint">
            <Search className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <input
            type="search"
            placeholder={t('learning.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={cn(
              'h-9 rounded-full border border-hairline bg-surface ps-8 pe-4 text-[13px] text-ink placeholder:text-ink-faint',
              'focus:outline-none focus:ring-1 focus:ring-navy/40',
              'w-52',
            )}
          />
        </label>

        {/* Status filter chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTER_OPTIONS.map((opt) => (
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
                ? t('learning.filter.all')
                : t(`learning.statusOptions.${opt.value}`)}
            </button>
          ))}
        </div>

        {/* Type filter chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', 'internal', 'external', 'online'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={cn(
                'rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors',
                typeFilter === type
                  ? 'border-navy bg-navy text-on-navy'
                  : 'border-hairline bg-surface text-ink-muted hover:border-navy/40 hover:text-ink',
              )}
            >
              {type === 'all'
                ? t('learning.filter.allTypes')
                : t(`learning.typeOptions.${type}`)}
            </button>
          ))}
        </div>

        <Button variant="primary" className="ms-auto" onClick={openAddForm}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          {t('learning.addProgram')}
        </Button>
      </div>

      {/* Load failure */}
      {state.error ? (
        <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>
            {state.error ? userFacingMessage(state.error) || t('learning.loadFailed') : t('learning.loadFailed')}
          </span>
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {/* Initial load */}
      {state.status === 'pending' && programs.length === 0 ? (
        <SkeletonTable />
      ) : null}

      {/* Empty state */}
      {state.status !== 'pending' && programs.length === 0 && (
        <Card className="px-5 py-10 text-center text-body-sm text-ink-muted">
          {t('learning.emptySearch')}
        </Card>
      )}

      {programs.length > 0 && (
        <>
          {/* Programs table — desktop/tablet-landscape */}
          <Card className="hidden lg:block">
            {/* Header */}
            <div className="border-b border-divider px-5 py-3">
              <div className="grid grid-cols-[2.5fr_1fr_1fr_1.5fr_1fr_1fr_1fr_auto] gap-4">
                {(
                  [
                    'program',
                    'category',
                    'type',
                    'trainer',
                    'startDate',
                    'endDate',
                    'status',
                  ] as const
                ).map((col) => (
                  <span
                    key={col}
                    className="text-caption font-semibold uppercase tracking-wide text-ink-faint"
                  >
                    {t(`learning.table.${col}`)}
                  </span>
                ))}
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('learning.table.actions')}
                </span>
              </div>
            </div>

            {programs.map((program, idx) => (
              <div
                key={program.id}
                className={cn(
                  'grid grid-cols-[2.5fr_1fr_1fr_1.5fr_1fr_1fr_1fr_auto] items-center gap-4 px-5 py-3',
                  idx < programs.length - 1 && 'border-b border-divider',
                  'hover:bg-surface/60 transition-colors',
                )}
              >
                {/* Title + optional max_participants */}
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-semibold text-ink">{program.title}</p>
                  {program.max_participants !== undefined ? (
                    <p className="text-caption text-ink-faint">
                      {t('learning.table.maxParticipants', {
                        count: program.max_participants,
                      })}
                    </p>
                  ) : null}
                </div>

                {/* Category */}
                <span className="text-body-sm text-ink-muted">{program.category ?? '—'}</span>

                {/* Type badge */}
                <div>
                  <TypeBadge type={program.type} />
                </div>

                {/* Trainer name */}
                <span className="truncate text-body-sm text-ink">
                  {program.trainer_name ?? '—'}
                </span>

                {/* Start date */}
                <span className="nums font-mono text-[12px] text-ink-muted">
                  {formatDate(program.start_date)}
                </span>

                {/* End date */}
                <span className="nums font-mono text-[12px] text-ink-muted">
                  {formatDate(program.end_date)}
                </span>

                {/* Status badge */}
                <div>
                  <StatusBadge status={program.status} />
                </div>

                {/* Actions */}
                <RowActions
                  onEnrollments={() => setEnrollmentsTarget(program)}
                  enrollmentsLabel={t('learning.enrollment.actionsLabel')}
                  onEdit={() => openEditForm(program)}
                  onDelete={() => setDeleteTarget(program)}
                />
              </div>
            ))}
          </Card>

          {/* Program cards — mobile/tablet-portrait */}
          <div className="flex flex-col gap-3 lg:hidden">
            {programs.map((program) => (
              <Card key={program.id} className="flex flex-col gap-3 p-4">
                {/* Identity + status + actions */}
                <div className="flex items-start justify-between gap-3">
                  <p className="truncate text-body-sm font-semibold text-ink">{program.title}</p>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusBadge status={program.status} />
                    <RowActions
                      onEnrollments={() => setEnrollmentsTarget(program)}
                      enrollmentsLabel={t('learning.enrollment.actionsLabel')}
                      onEdit={() => openEditForm(program)}
                      onDelete={() => setDeleteTarget(program)}
                    />
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3 border-t border-divider pt-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">
                      {t('learning.table.category')}
                    </span>
                    <span className="text-body-sm text-ink">{program.category ?? '—'}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">
                      {t('learning.table.type')}
                    </span>
                    <TypeBadge type={program.type} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">
                      {t('learning.table.trainer')}
                    </span>
                    <span className="text-body-sm text-ink">{program.trainer_name ?? '—'}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">
                      {t('learning.table.startDate')}
                    </span>
                    <span className="nums font-mono text-[12px] text-ink">
                      {formatDate(program.start_date)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">
                      {t('learning.table.endDate')}
                    </span>
                    <span className="nums font-mono text-[12px] text-ink">
                      {formatDate(program.end_date)}
                    </span>
                  </div>
                  {program.max_participants !== undefined ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-caption text-ink-faint">
                        {t('learning.table.seats')}
                      </span>
                      <span className="nums font-mono text-[12px] text-ink">
                        {program.max_participants}
                      </span>
                    </div>
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
      )}

      <TrainingProgramFormDialog open={formOpen} onOpenChange={setFormOpen} program={editTarget} />

      <TrainingEnrollmentsDialog
        open={enrollmentsTarget !== undefined}
        onOpenChange={(open) => {
          if (!open) setEnrollmentsTarget(undefined);
        }}
        trainingProgram={enrollmentsTarget}
      />

      <ConfirmDialog
        open={deleteTarget !== undefined}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t('learning.deleteConfirm.title')}
        description={
          deleteTarget
            ? t('learning.deleteConfirm.description', {
                name: deleteTarget.title,
              })
            : undefined
        }
        isLoading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
