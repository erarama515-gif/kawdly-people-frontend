import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { SkeletonTable } from '@/components/ui/SkeletonTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/form';
import { userFacingMessage } from '@/lib/api/errors';
import { useHasPermission } from '@/auth/session';
import {
  useCareerPathList,
  useDeleteCareerPath,
  useCareerPathLevelList,
  useDeleteCareerPathLevel,
  useSuccessionPlanList,
  useDeleteSuccessionPlan,
} from '../api/queries';
import type {
  CareerPathListParams,
  CareerPathLevelListParams,
  SuccessionPlanListParams,
  SuccessionReadiness,
} from '../api/resource';
import type { CareerPathWire, CareerPathLevelWire, SuccessionPlanWire } from '../api/schema';
import { CareerPathFormDialog } from './CareerPathFormDialog';
import { CareerPathLevelFormDialog } from './CareerPathLevelFormDialog';
import { SuccessionPlanFormDialog } from './SuccessionPlanFormDialog';

/**
 * Career & Succession live-data page.
 *
 * Section 1: Career Paths — card grid with Add/Edit/Delete.
 *   - No `description` field (not in real backend).
 *   - No `levelsCount` stat: the real `/api/v1/career-paths` index endpoint does
 *     not support `?include=levels`, so there is no reliable count; the stat was
 *     dropped from cards rather than fabricated. CareerPathLevel CRUD is a
 *     follow-up feature (out of scope for this task).
 *
 * Section 2: Succession Plans — table with Add/Edit/Delete.
 *   - ONE row per successor (real schema) not grouped by position.
 *   - Readiness enum: ready_now | ready_1_year | ready_2_years | development_needed.
 *
 * Stat cards: total career paths + total succession plans read from
 * `meta.total` via cheap `perPage:1` queries — never fabricated numbers.
 * `readyNow` count uses a server-side `readiness=ready_now` filter, which the
 * real backend supports via `SuccessionPlanListParams.readiness`.
 */

const CAREER_PATH_PER_PAGE = 12;
const CAREER_PATH_LEVEL_PER_PAGE = 10;
const SUCCESSION_PER_PAGE = 10;

// ─── Readiness badge ──────────────────────────────────────────────────────────

const READINESS_STYLES: Record<SuccessionReadiness, string> = {
  ready_now:          'bg-emerald-50 text-emerald-700',
  ready_1_year:       'bg-amber-50 text-amber-700',
  ready_2_years:      'bg-sky-50 text-sky-700',
  development_needed: 'bg-surface text-ink-muted border border-divider',
};

function ReadinessBadge({ readiness }: { readiness: SuccessionReadiness }) {
  const { t } = useTranslation();
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', READINESS_STYLES[readiness])}>
      {t(`career.readinessOptions.${readiness}`)}
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

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

// ─── Row Actions ──────────────────────────────────────────────────────────────

function RowActions({ onEdit, onDelete, editLabel, deleteLabel }: {
  onEdit?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
  editLabel: string;
  deleteLabel: string;
}) {
  return (
    <div className="flex items-center gap-1">
      {onEdit ? (
        <Button variant="ghost" className="h-7 w-7 px-0" aria-label={editLabel} onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      ) : null}
      {onDelete ? (
        <Button
          variant="ghost"
          className="h-7 w-7 px-0 hover:!text-coral"
          aria-label={deleteLabel}
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

function initialsOf(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

// ─── Career Path Card ─────────────────────────────────────────────────────────

function CareerPathCard({
  path,
  onEdit,
  onDelete,
}: {
  path: CareerPathWire;
  onEdit?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  return (
    <Card className="flex flex-col gap-3 p-5">
      {/* Family label */}
      {path.job_family ? (
        <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
          {path.job_family}
        </span>
      ) : (
        <span className="text-caption text-ink-faint">&nbsp;</span>
      )}

      {/* Name */}
      <h3 className="text-body font-semibold text-ink">{path.name}</h3>

      {/* Footer: actions */}
      <div className="mt-auto flex items-center justify-end border-t border-divider pt-3">
        <RowActions
          onEdit={onEdit}
          onDelete={onDelete}
          editLabel={t('career.editPathAction')}
          deleteLabel={t('career.deletePathAction')}
        />
      </div>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CareerPage() {
  const { t } = useTranslation();

  // ── Career paths state ────
  const [pathPage, setPathPage] = useState(1);
  const [pathFormOpen, setPathFormOpen] = useState(false);
  const [editPath, setEditPath] = useState<CareerPathWire | undefined>(undefined);
  const [deletePath, setDeletePath] = useState<CareerPathWire | undefined>(undefined);

  const pathParams = useMemo<CareerPathListParams>(
    () => ({ page: pathPage, perPage: CAREER_PATH_PER_PAGE }),
    [pathPage],
  );
  const { state: pathState, refetch: refetchPaths } = useCareerPathList(pathParams);
  // Cheap stat — reads only meta.total
  const { state: totalPathState } = useCareerPathList({ page: 1, perPage: 1 });
  const deletePathMutation = useDeleteCareerPath(pathParams);

  const paths = pathState.data?.data ?? [];
  const pathMeta = pathState.data?.meta;

  // ── Career path levels state ────
  const [levelPage, setLevelPage] = useState(1);
  const [levelFormOpen, setLevelFormOpen] = useState(false);
  const [editLevel, setEditLevel] = useState<CareerPathLevelWire | undefined>(undefined);
  const [deleteLevel, setDeleteLevel] = useState<CareerPathLevelWire | undefined>(undefined);
  /** `undefined` means "all paths"; a number filters by that career_path_id. */
  const [levelCareerPathFilter, setLevelCareerPathFilter] = useState<number | undefined>(undefined);

  const levelParams = useMemo<CareerPathLevelListParams>(
    () => ({
      page: levelPage,
      perPage: CAREER_PATH_LEVEL_PER_PAGE,
      career_path_id: levelCareerPathFilter,
    }),
    [levelPage, levelCareerPathFilter],
  );
  const { state: levelState, refetch: refetchLevels } = useCareerPathLevelList(levelParams);
  const deleteLevelMutation = useDeleteCareerPathLevel(levelParams);

  const levels = levelState.data?.data ?? [];
  const levelMeta = levelState.data?.meta;

  // ── Career path level actions ────

  function openAddLevel() {
    setEditLevel(undefined);
    setLevelFormOpen(true);
  }

  function openEditLevel(level: CareerPathLevelWire) {
    setEditLevel(level);
    setLevelFormOpen(true);
  }

  async function confirmDeleteLevel() {
    if (!deleteLevel) return;
    const result = await deleteLevelMutation.mutate(deleteLevel.id);
    if (result !== undefined || deleteLevelMutation.error === undefined) setDeleteLevel(undefined);
  }

  function handleLevelCareerPathFilterChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setLevelCareerPathFilter(val === '' ? undefined : Number(val));
    setLevelPage(1);
  }

  // ── Succession plans state ────
  const [planPage, setPlanPage] = useState(1);
  const [planFormOpen, setPlanFormOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<SuccessionPlanWire | undefined>(undefined);
  const [deletePlan, setDeletePlan] = useState<SuccessionPlanWire | undefined>(undefined);

  const planParams = useMemo<SuccessionPlanListParams>(
    () => ({ page: planPage, perPage: SUCCESSION_PER_PAGE }),
    [planPage],
  );
  const { state: planState, refetch: refetchPlans } = useSuccessionPlanList(planParams);
  // Cheap stat queries
  const { state: totalPlanState } = useSuccessionPlanList({ page: 1, perPage: 1 });
  const { state: readyNowState } = useSuccessionPlanList({ page: 1, perPage: 1, readiness: 'ready_now' });
  const deletePlanMutation = useDeleteSuccessionPlan(planParams);
  const canCreatePath = useHasPermission('career.career_path.create');
  const canEditPath = useHasPermission('career.career_path.edit');
  const canDeletePath = useHasPermission('career.career_path.delete');
  const canCreatePlan = useHasPermission('career.succession_plan.create');
  const canEditPlan = useHasPermission('career.succession_plan.edit');
  const canDeletePlan = useHasPermission('career.succession_plan.delete');

  const plans = planState.data?.data ?? [];
  const planMeta = planState.data?.meta;

  // ── Career path actions ────

  function openAddPath() {
    setEditPath(undefined);
    setPathFormOpen(true);
  }

  function openEditPath(path: CareerPathWire) {
    setEditPath(path);
    setPathFormOpen(true);
  }

  async function confirmDeletePath() {
    if (!deletePath) return;
    const result = await deletePathMutation.mutate(deletePath.id);
    if (result !== undefined || deletePathMutation.error === undefined) setDeletePath(undefined);
  }

  // ── Succession plan actions ────

  function openAddPlan() {
    setEditPlan(undefined);
    setPlanFormOpen(true);
  }

  function openEditPlan(plan: SuccessionPlanWire) {
    setEditPlan(plan);
    setPlanFormOpen(true);
  }

  async function confirmDeletePlan() {
    if (!deletePlan) return;
    const result = await deletePlanMutation.mutate(deletePlan.id);
    if (result !== undefined || deletePlanMutation.error === undefined) setDeletePlan(undefined);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t('career.title')}
        actions={
          canCreatePath ? (
            <Button variant="primary" onClick={openAddPath}>
              <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              {t('career.addPath')}
            </Button>
          ) : undefined
        }
      />

      {/* ── Stat strip ───────────────────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label={t('career.stat.careerPaths')} value={totalPathState.data?.meta.total} />
        <StatCard label={t('career.stat.successionPlans')} value={totalPlanState.data?.meta.total} />
        <StatCard label={t('career.stat.readyNow')} value={readyNowState.data?.meta.total} accent />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1: Career Paths
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-body font-semibold text-ink">{t('career.careerPaths')}</h2>
          {canCreatePath ? (
            <Button variant="secondary" onClick={openAddPath}>
              <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              {t('career.addPath')}
            </Button>
          ) : null}
        </div>

        {/* Load failure */}
        {pathState.error ? (
          <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
            <span>{userFacingMessage(pathState.error) || t('career.loadFailedPaths')}</span>
            <Button variant="secondary" onClick={() => void refetchPaths()}>
              {t('common.retry')}
            </Button>
          </Card>
        ) : null}

        {/* Initial load */}
        {pathState.status === 'pending' && paths.length === 0 ? (
          <SkeletonTable />
        ) : null}

        {/* Empty state */}
        {pathState.status !== 'pending' && paths.length === 0 && !pathState.error ? (
          <Card className="px-5 py-10 text-center text-body-sm text-ink-muted">{t('career.emptyPaths')}</Card>
        ) : null}

        {paths.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {paths.map((path) => (
                <CareerPathCard
                  key={path.id}
                  path={path}
                  onEdit={canEditPath ? () => openEditPath(path) : undefined}
                  onDelete={canDeletePath ? () => setDeletePath(path) : undefined}
                />
              ))}
            </div>

            {pathMeta ? (
              <Pagination
                currentPage={pathMeta.current_page}
                lastPage={pathMeta.last_page}
                total={pathMeta.total}
                perPage={pathMeta.per_page}
                onPageChange={setPathPage}
              />
            ) : null}
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2: Succession Plans
      ═══════════════════════════════════════════════════════════════════ */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-body font-semibold text-ink">{t('career.successionPlans')}</h2>
          {canCreatePlan ? (
            <Button variant="primary" onClick={openAddPlan}>
              <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              {t('career.newPlan')}
            </Button>
          ) : null}
        </div>

        {/* Load failure */}
        {planState.error ? (
          <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
            <span>{userFacingMessage(planState.error) || t('career.loadFailedPlans')}</span>
            <Button variant="secondary" onClick={() => void refetchPlans()}>
              {t('common.retry')}
            </Button>
          </Card>
        ) : null}

        {/* Initial load */}
        {planState.status === 'pending' && plans.length === 0 ? (
          <SkeletonTable />
        ) : null}

        {/* Empty state */}
        {planState.status !== 'pending' && plans.length === 0 && !planState.error ? (
          <Card className="px-5 py-10 text-center text-body-sm text-ink-muted">{t('career.emptyPlans')}</Card>
        ) : null}

        {plans.length > 0 && (
          <>
            {/* Desktop/tablet table */}
            <Card className="hidden lg:block">
              {/* Header */}
              <div className="border-b border-divider px-5 py-3">
                <div className="grid grid-cols-[1.5fr_2fr_2fr_1.5fr_80px_auto] gap-4">
                  {(['position', 'currentHolder', 'successor', 'readiness', 'score'] as const).map((col) => (
                    <span key={col} className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                      {t(`career.table.${col}`)}
                    </span>
                  ))}
                  <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                    {t('career.table.actions')}
                  </span>
                </div>
              </div>

              {/* Rows */}
              {plans.map((plan, idx) => {
                const positionLabel = plan.job_position
                  ? plan.job_position.title
                  : `#${plan.job_position_id}`;

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      'grid grid-cols-[1.5fr_2fr_2fr_1.5fr_80px_auto] items-center gap-4 px-5 py-3',
                      idx < plans.length - 1 && 'border-b border-divider',
                      'hover:bg-surface/60 transition-colors',
                    )}
                  >
                    {/* Position */}
                    <span className="truncate text-body-sm font-semibold text-ink">{positionLabel}</span>

                    {/* Current holder */}
                    {plan.current_holder ? (
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar
                          initials={initialsOf(plan.current_holder.first_name, plan.current_holder.last_name)}
                          photo={plan.current_holder.photo}
                          size={28}
                        />
                        <span className="truncate text-body-sm text-ink">
                          {plan.current_holder.first_name} {plan.current_holder.last_name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-body-sm text-ink-faint">—</span>
                    )}

                    {/* Successor */}
                    {plan.successor ? (
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar
                          initials={initialsOf(plan.successor.first_name, plan.successor.last_name)}
                          photo={plan.successor.photo}
                          size={28}
                        />
                        <span className="truncate text-body-sm text-ink">
                          {plan.successor.first_name} {plan.successor.last_name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-body-sm text-ink-faint">—</span>
                    )}

                    {/* Readiness */}
                    <ReadinessBadge readiness={plan.readiness} />

                    {/* Score */}
                    <span className={cn('nums font-mono text-body-sm', plan.readiness_score !== undefined ? 'font-semibold text-ink' : 'text-ink-faint')}>
                      {plan.readiness_score !== undefined ? (
                        <>
                          {plan.readiness_score}
                          <span className="font-normal text-ink-faint">/100</span>
                        </>
                      ) : '—'}
                    </span>

                    {/* Actions */}
                    <RowActions
                      onEdit={canEditPlan ? () => openEditPlan(plan) : undefined}
                      onDelete={canDeletePlan ? () => setDeletePlan(plan) : undefined}
                      editLabel={t('career.editPlanAction')}
                      deleteLabel={t('career.deletePlanAction')}
                    />
                  </div>
                );
              })}
            </Card>

            {/* Mobile/tablet cards */}
            <div className="flex flex-col gap-3 lg:hidden">
              {plans.map((plan) => {
                const positionLabel = plan.job_position
                  ? plan.job_position.title
                  : `#${plan.job_position_id}`;

                return (
                  <Card key={plan.id} className="flex flex-col gap-3 p-4">
                    {/* Position + readiness */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-body-sm font-semibold text-ink">{positionLabel}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <ReadinessBadge readiness={plan.readiness} />
                        <RowActions
                          onEdit={canEditPlan ? () => openEditPlan(plan) : undefined}
                          onDelete={canDeletePlan ? () => setDeletePlan(plan) : undefined}
                          editLabel={t('career.editPlanAction')}
                          deleteLabel={t('career.deletePlanAction')}
                        />
                      </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-3 border-t border-divider pt-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-caption text-ink-faint">{t('career.table.currentHolder')}</span>
                        {plan.current_holder ? (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Avatar
                              initials={initialsOf(plan.current_holder.first_name, plan.current_holder.last_name)}
                              photo={plan.current_holder.photo}
                              size={20}
                            />
                            <span className="truncate text-body-sm text-ink">
                              {plan.current_holder.first_name} {plan.current_holder.last_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-body-sm text-ink-faint">—</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-caption text-ink-faint">{t('career.table.successor')}</span>
                        {plan.successor ? (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Avatar
                              initials={initialsOf(plan.successor.first_name, plan.successor.last_name)}
                              photo={plan.successor.photo}
                              size={20}
                            />
                            <span className="truncate text-body-sm text-ink">
                              {plan.successor.first_name} {plan.successor.last_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-body-sm text-ink-faint">—</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-caption text-ink-faint">{t('career.table.score')}</span>
                        <span className="nums font-mono text-[12px] text-ink">
                          {plan.readiness_score !== undefined ? `${plan.readiness_score}/100` : '—'}
                        </span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {planMeta ? (
              <Pagination
                currentPage={planMeta.current_page}
                lastPage={planMeta.last_page}
                total={planMeta.total}
                perPage={planMeta.per_page}
                onPageChange={setPlanPage}
              />
            ) : null}
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3: Career Path Levels
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-body font-semibold text-ink">{t('career.levels')}</h2>
          <div className="flex items-center gap-3">
            {/* Career-path filter */}
            <Select
              id="level-career-path-filter"
              value={levelCareerPathFilter !== undefined ? String(levelCareerPathFilter) : ''}
              onChange={handleLevelCareerPathFilterChange}
              className="h-8 min-w-[180px] text-body-sm"
            >
              <option value="">{t('career.levelFilter.allPaths')}</option>
              {/* Use paths already loaded in Section 1 for the dropdown */}
              {paths.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>

            {canCreatePath ? (
              <Button variant="secondary" onClick={openAddLevel}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                {t('career.addLevel')}
              </Button>
            ) : null}
          </div>
        </div>

        {/* Load failure */}
        {levelState.error ? (
          <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
            <span>{userFacingMessage(levelState.error) || t('career.loadFailedLevels')}</span>
            <Button variant="secondary" onClick={() => void refetchLevels()}>
              {t('common.retry')}
            </Button>
          </Card>
        ) : null}

        {/* Initial load */}
        {levelState.status === 'pending' && levels.length === 0 ? (
          <SkeletonTable />
        ) : null}

        {/* Empty state */}
        {levelState.status !== 'pending' && levels.length === 0 && !levelState.error ? (
          <Card className="px-5 py-10 text-center text-body-sm text-ink-muted">{t('career.emptyLevels')}</Card>
        ) : null}

        {levels.length > 0 && (
          <>
            {/* Desktop/tablet table */}
            <Card className="hidden lg:block">
              {/* Header */}
              <div className="border-b border-divider px-5 py-3">
                <div className="grid grid-cols-[1.5fr_2fr_60px_80px_2fr_2fr_auto] gap-4">
                  {(
                    ['careerPath', 'jobPosition', 'order', 'minExp', 'competencies', 'certifications'] as const
                  ).map((col) => (
                    <span
                      key={col}
                      className="text-caption font-semibold uppercase tracking-wide text-ink-faint"
                    >
                      {t(`career.levelTable.${col}`)}
                    </span>
                  ))}
                  <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                    {t('career.table.actions')}
                  </span>
                </div>
              </div>

              {/* Rows */}
              {levels.map((lvl, idx) => {
                const pathLabel = lvl.career_path ? lvl.career_path.name : `#${lvl.career_path_id}`;
                const posLabel = lvl.job_position ? lvl.job_position.title : `#${lvl.job_position_id}`;
                const competencies = (lvl.required_competencies ?? []).join(', ') || '—';
                const certifications = (lvl.required_certifications ?? []).join(', ') || '—';

                return (
                  <div
                    key={lvl.id}
                    className={cn(
                      'grid grid-cols-[1.5fr_2fr_60px_80px_2fr_2fr_auto] items-center gap-4 px-5 py-3',
                      idx < levels.length - 1 && 'border-b border-divider',
                      'hover:bg-surface/60 transition-colors',
                    )}
                  >
                    <span className="truncate text-body-sm font-semibold text-ink">{pathLabel}</span>
                    <span className="truncate text-body-sm text-ink">{posLabel}</span>
                    <span className="nums font-mono text-body-sm text-ink-muted">
                      {lvl.level_order !== undefined ? lvl.level_order : '—'}
                    </span>
                    <span className="nums font-mono text-body-sm text-ink-muted">
                      {lvl.min_experience_years !== undefined ? `${lvl.min_experience_years} yr` : '—'}
                    </span>
                    <span className="truncate text-body-sm text-ink-muted">{competencies}</span>
                    <span className="truncate text-body-sm text-ink-muted">{certifications}</span>
                    <RowActions
                      onEdit={canEditPath ? () => openEditLevel(lvl) : undefined}
                      onDelete={canDeletePath ? () => setDeleteLevel(lvl) : undefined}
                      editLabel={t('career.editLevelAction')}
                      deleteLabel={t('career.deleteLevelAction')}
                    />
                  </div>
                );
              })}
            </Card>

            {/* Mobile/tablet cards */}
            <div className="flex flex-col gap-3 lg:hidden">
              {levels.map((lvl) => {
                const pathLabel = lvl.career_path ? lvl.career_path.name : `#${lvl.career_path_id}`;
                const posLabel = lvl.job_position ? lvl.job_position.title : `#${lvl.job_position_id}`;

                return (
                  <Card key={lvl.id} className="flex flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-body-sm font-semibold text-ink">{pathLabel}</p>
                        <p className="truncate text-caption text-ink-muted">{posLabel}</p>
                      </div>
                      <RowActions
                        onEdit={canEditPath ? () => openEditLevel(lvl) : undefined}
                        onDelete={canDeletePath ? () => setDeleteLevel(lvl) : undefined}
                        editLabel={t('career.editLevelAction')}
                        deleteLabel={t('career.deleteLevelAction')}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-t border-divider pt-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-caption text-ink-faint">{t('career.levelTable.order')}</span>
                        <span className="nums font-mono text-[12px] text-ink">
                          {lvl.level_order !== undefined ? lvl.level_order : '—'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-caption text-ink-faint">{t('career.levelTable.minExp')}</span>
                        <span className="nums font-mono text-[12px] text-ink">
                          {lvl.min_experience_years !== undefined ? `${lvl.min_experience_years} yr` : '—'}
                        </span>
                      </div>
                      <div className="col-span-2 flex flex-col gap-0.5">
                        <span className="text-caption text-ink-faint">{t('career.levelTable.competencies')}</span>
                        <span className="text-[12px] text-ink-muted">
                          {(lvl.required_competencies ?? []).join(', ') || '—'}
                        </span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {levelMeta ? (
              <Pagination
                currentPage={levelMeta.current_page}
                lastPage={levelMeta.last_page}
                total={levelMeta.total}
                perPage={levelMeta.per_page}
                onPageChange={setLevelPage}
              />
            ) : null}
          </>
        )}
      </div>

      {/* ── Career path dialogs ───────────────────────────────────────────── */}
      <CareerPathFormDialog
        open={pathFormOpen}
        onOpenChange={setPathFormOpen}
        path={editPath}
      />

      <ConfirmDialog
        open={deletePath !== undefined}
        onOpenChange={(open) => !open && setDeletePath(undefined)}
        title={t('career.deletePathConfirm.title')}
        description={
          deletePath
            ? t('career.deletePathConfirm.description', { name: deletePath.name })
            : undefined
        }
        isLoading={deletePathMutation.isPending}
        onConfirm={() => void confirmDeletePath()}
      />

      {/* ── Succession plan dialogs ───────────────────────────────────────── */}
      <SuccessionPlanFormDialog
        open={planFormOpen}
        onOpenChange={setPlanFormOpen}
        plan={editPlan}
      />

      <ConfirmDialog
        open={deletePlan !== undefined}
        onOpenChange={(open) => !open && setDeletePlan(undefined)}
        title={t('career.deletePlanConfirm.title')}
        description={
          deletePlan
            ? t('career.deletePlanConfirm.description', {
                position: deletePlan.job_position
                  ? deletePlan.job_position.title
                  : `#${deletePlan.job_position_id}`,
              })
            : undefined
        }
        isLoading={deletePlanMutation.isPending}
        onConfirm={() => void confirmDeletePlan()}
      />

      {/* ── Career path level dialogs ─────────────────────────────────────── */}
      <CareerPathLevelFormDialog
        open={levelFormOpen}
        onOpenChange={setLevelFormOpen}
        level={editLevel}
        defaultCareerPathId={levelCareerPathFilter}
      />

      <ConfirmDialog
        open={deleteLevel !== undefined}
        onOpenChange={(open) => !open && setDeleteLevel(undefined)}
        title={t('career.deleteLevelConfirm.title')}
        description={
          deleteLevel
            ? t('career.deleteLevelConfirm.description', {
                path: deleteLevel.career_path
                  ? deleteLevel.career_path.name
                  : `#${deleteLevel.career_path_id}`,
                order:
                  deleteLevel.level_order !== undefined ? String(deleteLevel.level_order) : '?',
              })
            : undefined
        }
        isLoading={deleteLevelMutation.isPending}
        onConfirm={() => void confirmDeleteLevel()}
      />
    </div>
  );
}
