import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { SkeletonTable } from '@/components/ui/SkeletonTable';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/form';
import { userFacingMessage } from '@/lib/api/errors';
import { useJobPositionList } from '@/features/organization/api/queries';
import {
  useLearningPathList,
  useDeleteLearningPath,
  useLearningPathStepList,
} from '../api/queries';
import type { LearningPathListParams } from '../api/resource';
import type { LearningPathWire } from '../api/schema';
import { LearningPathFormDialog } from './LearningPathFormDialog';
import { LearningPathStepsDialog } from './LearningPathStepsDialog';

/**
 * The "Learning Paths" tab of `LearningPage` — the LearningPath live-data view.
 * Same shape as `TrainingProgramsTab`:
 * - `useLearningPathList` for data
 * - Add/Edit via `LearningPathFormDialog`
 * - Delete via `ConfirmDialog` + optimistic `useDeleteLearningPath`
 * - Per-path steps via `LearningPathStepsDialog` (row action)
 * - `Pagination` for page controls
 * - A `from_position_id` structural filter (job-position picker)
 * - HONEST stat cards backed by cheap `perPage:1` queries reading `meta.total`
 */

const PER_PAGE = 10;

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

// ─── Row Actions ──────────────────────────────────────────────────────────────

function RowActions({
  onSteps,
  onEdit,
  onDelete,
}: {
  onSteps: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        className="h-7 w-7 px-0 hover:!text-sky-600"
        aria-label={t('learning.path.stepsAction')}
        onClick={onSteps}
      >
        <ListTree className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        className="h-7 w-7 px-0"
        aria-label={t('learning.path.editAction')}
        onClick={onEdit}
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        className="h-7 w-7 px-0 hover:!text-coral"
        aria-label={t('learning.path.deleteAction')}
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      </Button>
    </div>
  );
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

export function LearningPathsTab() {
  const { t } = useTranslation();

  const [page, setPage] = useState(1);
  const [fromPositionFilter, setFromPositionFilter] = useState<number | undefined>(undefined);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LearningPathWire | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<LearningPathWire | undefined>(undefined);
  /** The path whose step breakdown dialog is open. */
  const [stepsTarget, setStepsTarget] = useState<LearningPathWire | undefined>(undefined);

  // A new filter invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [fromPositionFilter]);

  const params = useMemo<LearningPathListParams>(
    () => ({ page, perPage: PER_PAGE, from_position_id: fromPositionFilter }),
    [page, fromPositionFilter],
  );

  const { state, refetch } = useLearningPathList(params);

  // HONEST stat cards — each is a cheap perPage:1 call reading only meta.total.
  const { state: totalState } = useLearningPathList({ page: 1, perPage: 1 });
  const { state: stepsState } = useLearningPathStepList({ page: 1, perPage: 1 });
  const { state: requiredStepsState } = useLearningPathStepList({ page: 1, perPage: 1, is_required: true });

  // Job-position picker, reused both as the filter and for name resolution.
  const { state: positionState } = useJobPositionList({ page: 1, perPage: 200 });
  const positions = positionState.data?.data ?? [];
  const positionTitles = useMemo(
    () => new Map(positions.map((position) => [position.id, position.title])),
    [positions],
  );

  const deleteMutation = useDeleteLearningPath(params);

  const paths = state.data?.data ?? [];
  const meta = state.data?.meta;

  function positionLabel(id: number | undefined, ref: { title: string } | undefined): string {
    if (ref) return ref.title;
    if (id === undefined) return '—';
    return positionTitles.get(id) ?? `#${id}`;
  }

  function openAddForm() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function openEditForm(path: LearningPathWire) {
    setEditTarget(path);
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
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label={t('learning.path.stat.total')} value={totalState.data?.meta.total} />
        <StatCard label={t('learning.path.stat.steps')} value={stepsState.data?.meta.total} accent />
        <StatCard label={t('learning.path.stat.required')} value={requiredStepsState.data?.meta.total} />
      </div>

      {/* Toolbar: structural filter + add */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          className="h-9 w-60"
          value={fromPositionFilter === undefined ? '' : String(fromPositionFilter)}
          onChange={(e) => setFromPositionFilter(e.target.value === '' ? undefined : Number(e.target.value))}
          aria-label={t('learning.path.filterByFromPosition')}
        >
          <option value="">{t('learning.path.allPositions')}</option>
          {positions.map((position) => (
            <option key={position.id} value={position.id}>
              {position.title}
            </option>
          ))}
        </Select>

        <Button variant="primary" className="ms-auto" onClick={openAddForm}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          {t('learning.path.add')}
        </Button>
      </div>

      {/* Load failure */}
      {state.error ? (
        <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>{userFacingMessage(state.error) || t('learning.path.loadFailed')}</span>
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {/* Initial load */}
      {state.status === 'pending' && paths.length === 0 ? <SkeletonTable /> : null}

      {/* Empty state */}
      {state.status !== 'pending' && paths.length === 0 && (
        <Card className="px-5 py-10 text-center text-body-sm text-ink-muted">
          {t('learning.path.empty')}
        </Card>
      )}

      {paths.length > 0 && (
        <>
          {/* Paths table — desktop/tablet-landscape */}
          <Card className="hidden lg:block">
            <div className="border-b border-divider px-5 py-3">
              <div className="grid grid-cols-[2.5fr_1.25fr_1.25fr_2fr_auto] gap-4">
                {(['name', 'from', 'to', 'description'] as const).map((col) => (
                  <span
                    key={col}
                    className="text-caption font-semibold uppercase tracking-wide text-ink-faint"
                  >
                    {t(`learning.path.table.${col}`)}
                  </span>
                ))}
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('learning.path.table.actions')}
                </span>
              </div>
            </div>

            {paths.map((path, idx) => (
              <div
                key={path.id}
                className={cn(
                  'grid grid-cols-[2.5fr_1.25fr_1.25fr_2fr_auto] items-center gap-4 px-5 py-3',
                  idx < paths.length - 1 && 'border-b border-divider',
                  'transition-colors hover:bg-surface/60',
                )}
              >
                <span className="truncate text-body-sm font-semibold text-ink">{path.name}</span>
                <span className="truncate text-body-sm text-ink-muted">
                  {positionLabel(path.from_position_id, path.fromPosition)}
                </span>
                <span className="truncate text-body-sm text-ink-muted">
                  {positionLabel(path.to_position_id, path.toPosition)}
                </span>
                <span className="truncate text-body-sm text-ink-muted">{path.description ?? '—'}</span>
                <RowActions
                  onSteps={() => setStepsTarget(path)}
                  onEdit={() => openEditForm(path)}
                  onDelete={() => setDeleteTarget(path)}
                />
              </div>
            ))}
          </Card>

          {/* Path cards — mobile/tablet-portrait */}
          <div className="flex flex-col gap-3 lg:hidden">
            {paths.map((path) => (
              <Card key={path.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="truncate text-body-sm font-semibold text-ink">{path.name}</p>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <RowActions
                      onSteps={() => setStepsTarget(path)}
                      onEdit={() => openEditForm(path)}
                      onDelete={() => setDeleteTarget(path)}
                    />
                  </div>
                </div>

                {path.description ? (
                  <p className="text-caption text-ink-muted">{path.description}</p>
                ) : null}

                <div className="grid grid-cols-2 gap-3 border-t border-divider pt-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('learning.path.table.from')}</span>
                    <span className="text-body-sm text-ink">
                      {positionLabel(path.from_position_id, path.fromPosition)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('learning.path.table.to')}</span>
                    <span className="text-body-sm text-ink">
                      {positionLabel(path.to_position_id, path.toPosition)}
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

      <LearningPathFormDialog open={formOpen} onOpenChange={setFormOpen} path={editTarget} />

      <LearningPathStepsDialog
        open={stepsTarget !== undefined}
        onOpenChange={(open) => {
          if (!open) setStepsTarget(undefined);
        }}
        path={stepsTarget}
      />

      <ConfirmDialog
        open={deleteTarget !== undefined}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t('learning.path.deleteConfirm.title')}
        description={
          deleteTarget
            ? t('learning.path.deleteConfirm.description', { name: deleteTarget.name })
            : undefined
        }
        isLoading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
