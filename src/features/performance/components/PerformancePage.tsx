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
import { toast } from '@/components/ui/Toast';
import { useHasPermission } from '@/auth/session';
import {
  usePerformanceCycleList,
  useDeletePerformanceCycle,
  usePerformanceReviewList,
  useDeletePerformanceReview,
} from '../api/queries';
import type {
  PerformanceCycleListParams,
  PerformanceCycleStatus,
  PerformanceReviewListParams,
  PerformanceReviewStatus,
  PerformanceReviewType,
} from '../api/resource';
import type { PerformanceCycleWire, PerformanceReviewWire } from '../api/schema';
import { PerformanceCycleFormDialog } from './PerformanceCycleFormDialog';
import { PerformanceReviewFormDialog } from './PerformanceReviewFormDialog';

/**
 * Performance live-data page.
 *
 * Section 1 (top banner): PerformanceCycles — card list with Add/Edit/Delete.
 *   The first active/in_review cycle is highlighted as the "current cycle"
 *   banner. Completion % is computed from two cheap perPage:1 queries
 *   (submitted+acknowledged / total for the selected cycle) — never fabricated.
 *
 * Section 2 (table): PerformanceReviews — filtered by selected cycle_id.
 *   ONE row per PerformanceReview record (employee, reviewer, review_type,
 *   overall_rating, status). This is a deliberate simplification vs. the old
 *   mock's self+manager pivot: the real backend stores one row per
 *   (cycle_id, employee_id, reviewer_id, review_type).
 *
 *   Filter chips for review_type and status scoped to the selected cycle.
 *
 * Stat strip: total cycles, active cycles, total reviews (for current scope),
 * and pending reviews — all read from meta.total via cheap perPage:1 queries.
 *
 * Old mock differences fixed (see resource.ts header for full list):
 *   - ReviewCycle.period/deadline → formatted client-side from start_date/end_date/manager_review_deadline.
 *   - ReviewCycle.completionPercent is NOT a real column — computed honestly.
 *   - ReviewCycle.status 'closed' doesn't exist → real: draft|active|in_review|completed.
 *   - EmployeeReview.department is not a column → resolved via employee relation.
 *   - selfRating/managerRating pivot removed → one row per PerformanceReview.
 *   - EmployeeReview.status 'completed' doesn't exist → real: pending|in_progress|submitted|acknowledged.
 */

const CYCLE_PER_PAGE = 10;
const REVIEW_PER_PAGE = 10;

// ─── Date formatting helpers ──────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatPeriod(startDate: string, endDate: string): string {
  return `${formatDate(startDate)} — ${formatDate(endDate)}`;
}

function initialsOf(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

// ─── Status badge styles ──────────────────────────────────────────────────────

const CYCLE_STATUS_STYLES: Record<PerformanceCycleStatus, string> = {
  draft:      'bg-slate-100 text-slate-600',
  active:     'bg-emerald-50 text-emerald-700',
  in_review:  'bg-amber-50 text-amber-700',
  completed:  'bg-sky-50 text-sky-700',
};

const REVIEW_STATUS_STYLES: Record<PerformanceReviewStatus, string> = {
  pending:      'bg-amber-50 text-amber-700',
  in_progress:  'bg-violet-50 text-violet-700',
  submitted:    'bg-sky-50 text-sky-700',
  acknowledged: 'bg-emerald-50 text-emerald-700',
};

function CycleStatusBadge({ status }: { status: PerformanceCycleStatus | undefined }) {
  const { t } = useTranslation();
  if (!status) return null;
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', CYCLE_STATUS_STYLES[status])}>
      {t(`performance.cycleStatusOptions.${status}`)}
    </span>
  );
}

function ReviewStatusBadge({ status }: { status: PerformanceReviewStatus | undefined }) {
  const { t } = useTranslation();
  if (!status) return <span className="text-body-sm text-ink-faint">—</span>;
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', REVIEW_STATUS_STYLES[status])}>
      {t(`performance.reviewStatusOptions.${status}`)}
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, suffix }: { label: string; value: number | undefined; suffix?: string }) {
  return (
    <Card className="flex flex-col gap-1 px-5 pb-4 pt-4">
      <span className="text-caption text-ink-muted">{label}</span>
      <span className="nums font-mono text-[32px] font-bold leading-[1.1] tracking-[-0.04em] text-navy">
        {value !== undefined ? value.toLocaleString() : '—'}
        {suffix && <span className="text-[20px] font-medium text-ink-muted">{suffix}</span>}
      </span>
    </Card>
  );
}

// ─── Row actions ──────────────────────────────────────────────────────────────

function RowActions({
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
}: {
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

// ─── Current Cycle Banner ─────────────────────────────────────────────────────

interface CycleBannerProps {
  cycle: PerformanceCycleWire;
  /** Ratio of (submitted + acknowledged) reviews to total reviews for this cycle. */
  completionPercent: number | undefined;
  onEdit?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
}

function CycleBanner({ cycle, completionPercent, onEdit, onDelete }: CycleBannerProps) {
  const { t } = useTranslation();
  return (
    <Card className="mb-6 overflow-hidden rounded-[3px]">
      <div className="bg-navy px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-caption font-semibold uppercase tracking-wide text-on-navy/60">
              {t('performance.activeCycleLabel')}
            </span>
            <h2 className="mt-1 text-body-md font-semibold text-on-navy">{cycle.name}</h2>
            <p className="mt-0.5 text-body-sm text-on-navy/70">
              {formatPeriod(cycle.start_date, cycle.end_date)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <CycleStatusBadge status={cycle.status} />
              <RowActions
                onEdit={onEdit}
                onDelete={onDelete}
                editLabel={t('performance.editCycleAction')}
                deleteLabel={t('performance.deleteCycleAction')}
              />
            </div>
            <div className="text-end">
              <p className="text-caption text-on-navy/60">{t('performance.deadline')}</p>
              <p className="text-body-sm font-semibold text-on-navy">
                {formatDate(cycle.manager_review_deadline)}
              </p>
            </div>
          </div>
        </div>

        {/* Completion progress — computed from meta.total queries */}
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-caption text-on-navy/70">{t('performance.completion')}</span>
            <span className="nums font-mono text-[13px] font-bold text-on-navy">
              {completionPercent !== undefined ? `${completionPercent}%` : '—'}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
            {completionPercent !== undefined && (
              <div
                className="h-full rounded-full bg-white/80 transition-all"
                style={{ width: `${completionPercent}%` }}
              />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Cycle Row (for list view) ────────────────────────────────────────────────

function CycleRow({
  cycle,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: {
  cycle: PerformanceCycleWire;
  isSelected: boolean;
  onSelect: () => void;
  onEdit?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        'grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-5 py-3',
        'border-b border-divider last:border-0',
        'hover:bg-surface/60 transition-colors cursor-pointer',
        isSelected && 'bg-surface',
      )}
      onClick={onSelect}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="truncate text-body-sm font-semibold text-ink">{cycle.name}</span>
        <span className="text-caption text-ink-muted">
          {formatPeriod(cycle.start_date, cycle.end_date)}
        </span>
      </div>
      <span className="text-caption text-ink-faint">
        {t(`performance.cycleTypeOptions.${cycle.type}`)}
      </span>
      <CycleStatusBadge status={cycle.status} />
      <div onClick={(e) => e.stopPropagation()}>
        <RowActions
          onEdit={onEdit}
          onDelete={onDelete}
          editLabel={t('performance.editCycleAction')}
          deleteLabel={t('performance.deleteCycleAction')}
        />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PerformancePage() {
  const { t } = useTranslation();

  // ── Cycle state ────
  const [cyclePage, setCyclePage] = useState(1);
  const [cycleFormOpen, setCycleFormOpen] = useState(false);
  const [editCycle, setEditCycle] = useState<PerformanceCycleWire | undefined>(undefined);
  const [deleteCycle, setDeleteCycle] = useState<PerformanceCycleWire | undefined>(undefined);
  /** The cycle whose reviews are shown in the table. */
  const [selectedCycleId, setSelectedCycleId] = useState<number | undefined>(undefined);

  const cycleParams = useMemo<PerformanceCycleListParams>(
    () => ({ page: cyclePage, perPage: CYCLE_PER_PAGE }),
    [cyclePage],
  );
  const { state: cycleState } = usePerformanceCycleList(cycleParams);
  // Cheap stat queries
  const { state: totalCyclesState } = usePerformanceCycleList({ page: 1, perPage: 1 });
  const { state: activeCyclesState } = usePerformanceCycleList({ page: 1, perPage: 1, status: 'active' });
  const deleteCycleMutation = useDeletePerformanceCycle(cycleParams);
  const canCreateCycle = useHasPermission('performance.performance_cycle.create');
  const canEditCycle = useHasPermission('performance.performance_cycle.edit');
  const canDeleteCycle = useHasPermission('performance.performance_cycle.delete');
  const canCreateReview = useHasPermission('performance.review.create');
  const canEditReview = useHasPermission('performance.review.edit');
  const canDeleteReview = useHasPermission('performance.review.delete');

  const cycles = cycleState.data?.data ?? [];
  const cycleMeta = cycleState.data?.meta;

  // Pick the first active (or in_review) cycle as "selected" when data first loads
  const firstActiveCycle = cycles.find((c) => c.status === 'active' || c.status === 'in_review');
  const effectiveSelectedCycleId = selectedCycleId ?? firstActiveCycle?.id;
  const selectedCycle = cycles.find((c) => c.id === effectiveSelectedCycleId) ?? cycles[0];

  // ── Review state ────
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [editReview, setEditReview] = useState<PerformanceReviewWire | undefined>(undefined);
  const [deleteReview, setDeleteReview] = useState<PerformanceReviewWire | undefined>(undefined);
  const [reviewTypeFilter, setReviewTypeFilter] = useState<PerformanceReviewType | undefined>(undefined);
  const [reviewStatusFilter, setReviewStatusFilter] = useState<PerformanceReviewStatus | undefined>(undefined);

  const reviewParams = useMemo<PerformanceReviewListParams>(
    () => ({
      page: reviewPage,
      perPage: REVIEW_PER_PAGE,
      cycle_id: effectiveSelectedCycleId,
      review_type: reviewTypeFilter,
      status: reviewStatusFilter,
    }),
    [reviewPage, effectiveSelectedCycleId, reviewTypeFilter, reviewStatusFilter],
  );
  const { state: reviewState } = usePerformanceReviewList(reviewParams);

  // Completion % — cheap perPage:1 queries for (submitted+acknowledged) / total
  const { state: totalReviewsState } = usePerformanceReviewList({
    page: 1,
    perPage: 1,
    cycle_id: effectiveSelectedCycleId,
  });
  const { state: submittedReviewsState } = usePerformanceReviewList({
    page: 1,
    perPage: 1,
    cycle_id: effectiveSelectedCycleId,
    status: 'submitted',
  });
  const { state: acknowledgedReviewsState } = usePerformanceReviewList({
    page: 1,
    perPage: 1,
    cycle_id: effectiveSelectedCycleId,
    status: 'acknowledged',
  });
  // Pending reviews stat
  const { state: pendingReviewsState } = usePerformanceReviewList({
    page: 1,
    perPage: 1,
    cycle_id: effectiveSelectedCycleId,
    status: 'pending',
  });

  const deleteReviewMutation = useDeletePerformanceReview(reviewParams);

  const reviews = reviewState.data?.data ?? [];
  const reviewMeta = reviewState.data?.meta;

  // Compute completionPercent honestly from three cheap queries
  const totalReviewCount = totalReviewsState.data?.meta.total;
  const submittedCount = submittedReviewsState.data?.meta.total ?? 0;
  const acknowledgedCount = acknowledgedReviewsState.data?.meta.total ?? 0;
  const doneCount = submittedCount + acknowledgedCount;
  const completionPercent =
    totalReviewCount !== undefined && totalReviewCount > 0
      ? Math.round((doneCount / totalReviewCount) * 100)
      : totalReviewCount === 0
        ? 0
        : undefined;

  // ── Cycle actions ────

  function openAddCycle() {
    setEditCycle(undefined);
    setCycleFormOpen(true);
  }

  function openEditCycle(cycle: PerformanceCycleWire) {
    setEditCycle(cycle);
    setCycleFormOpen(true);
  }

  async function confirmDeleteCycle() {
    if (!deleteCycle) return;

    try {
      await deleteCycleMutation.mutateAsync(deleteCycle.id);
      setDeleteCycle(undefined);
    } catch (error) {
      toast.error(userFacingMessage(error));
    }
  }

  // ── Review actions ────

  function openAddReview() {
    setEditReview(undefined);
    setReviewFormOpen(true);
  }

  function openEditReview(review: PerformanceReviewWire) {
    setEditReview(review);
    setReviewFormOpen(true);
  }

  async function confirmDeleteReview() {
    if (!deleteReview) return;

    try {
      await deleteReviewMutation.mutateAsync(deleteReview.id);
      setDeleteReview(undefined);
    } catch (error) {
      toast.error(userFacingMessage(error));
    }
  }

  function handleReviewTypeFilterChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setReviewTypeFilter(val === '' ? undefined : (val as PerformanceReviewType));
    setReviewPage(1);
  }

  function handleReviewStatusFilterChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setReviewStatusFilter(val === '' ? undefined : (val as PerformanceReviewStatus));
    setReviewPage(1);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t('performance.title')}
        actions={
          canCreateCycle ? (
            <Button variant="primary" onClick={openAddCycle}>
              <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              {t('performance.addCycle')}
            </Button>
          ) : undefined
        }
      />

      {/* ── Stat strip ──────────────────────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={t('performance.stat.totalCycles')}
          value={totalCyclesState.data?.meta.total}
        />
        <StatCard
          label={t('performance.stat.activeCycles')}
          value={activeCyclesState.data?.meta.total}
        />
        <StatCard
          label={t('performance.stat.totalReviews')}
          value={totalReviewCount}
        />
        <StatCard
          label={t('performance.stat.pendingReviews')}
          value={pendingReviewsState.data?.meta.total}
        />
      </div>

      {/* ── Active cycle banner ──────────────────────────────────────────────── */}
      {selectedCycle ? (
        <CycleBanner
          cycle={selectedCycle}
          completionPercent={completionPercent}
          onEdit={canEditCycle ? () => openEditCycle(selectedCycle) : undefined}
          onDelete={canDeleteCycle ? () => setDeleteCycle(selectedCycle) : undefined}
        />
      ) : cycleState.status === 'success' && cycles.length === 0 ? (
        <Card className="mb-6 flex items-center justify-center px-5 py-10">
          <p className="text-body-sm text-ink-muted">{t('performance.noCycles')}</p>
        </Card>
      ) : null}

      {/* ── Cycle list ──────────────────────────────────────────────────────── */}
      <div className="mb-8 flex items-center justify-between gap-4">
        <h3 className="text-body-md font-semibold text-ink">{t('performance.allCyclesTitle')}</h3>
      </div>

      {cycleState.status === 'error' ? (
        <Card className="mb-6 px-5 py-4">
          <p className="text-caption text-coral">{userFacingMessage(cycleState.error)}</p>
        </Card>
      ) : (
        <Card className="mb-8 overflow-hidden">
          {cycleState.status === 'pending' ? (
            <SkeletonTable />
          ) : cycles.length === 0 ? (
            <div className="flex items-center justify-center px-5 py-10">
              <p className="text-body-sm text-ink-muted">{t('performance.noCycles')}</p>
            </div>
          ) : (
            <>
              {cycles.map((cycle) => (
                <CycleRow
                  key={cycle.id}
                  cycle={cycle}
                  isSelected={cycle.id === effectiveSelectedCycleId}
                  onSelect={() => {
                    setSelectedCycleId(cycle.id);
                    setReviewPage(1);
                  }}
                  onEdit={canEditCycle ? () => openEditCycle(cycle) : undefined}
                  onDelete={canDeleteCycle ? () => setDeleteCycle(cycle) : undefined}
                />
              ))}
              {cycleMeta && cycleMeta.last_page > 1 && (
                <div className="border-t border-divider px-5 py-3">
                  <Pagination
                    currentPage={cycleParams.page ?? 1}
                    lastPage={cycleMeta.last_page}
                    total={cycleMeta.total}
                    perPage={CYCLE_PER_PAGE}
                    onPageChange={setCyclePage}
                  />
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* ── Reviews section ─────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-body-md font-semibold text-ink">
          {t('performance.reviewsTitle')}
          {selectedCycle ? (
            <span className="ms-2 text-body-sm font-normal text-ink-muted">— {selectedCycle.name}</span>
          ) : null}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter: review type */}
          <Select
            id="review_type_filter"
            value={reviewTypeFilter ?? ''}
            onChange={handleReviewTypeFilterChange}
            className="h-8 w-40 text-[13px]"
          >
            <option value="">{t('performance.allReviewTypes')}</option>
            {(['self', 'manager', 'peer', 'direct_report'] as const).map((opt) => (
              <option key={opt} value={opt}>
                {t(`performance.reviewTypeOptions.${opt}`)}
              </option>
            ))}
          </Select>

          {/* Filter: review status */}
          <Select
            id="review_status_filter"
            value={reviewStatusFilter ?? ''}
            onChange={handleReviewStatusFilterChange}
            className="h-8 w-40 text-[13px]"
          >
            <option value="">{t('performance.allReviewStatuses')}</option>
            {(['pending', 'in_progress', 'submitted', 'acknowledged'] as const).map((opt) => (
              <option key={opt} value={opt}>
                {t(`performance.reviewStatusOptions.${opt}`)}
              </option>
            ))}
          </Select>

          {canCreateReview ? (
            <Button variant="primary" onClick={openAddReview} disabled={!effectiveSelectedCycleId}>
              <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              {t('performance.addReview')}
            </Button>
          ) : null}
        </div>
      </div>

      {reviewState.status === 'error' ? (
        <Card className="px-5 py-4">
          <p className="text-caption text-coral">{userFacingMessage(reviewState.error)}</p>
        </Card>
      ) : (
        <>
          {/* Desktop / tablet-landscape table */}
          <Card className="hidden lg:block">
            {/* Table header */}
            <div className="border-b border-divider px-5 py-3">
              <div className="grid grid-cols-[2.5fr_2fr_1fr_1fr_1.2fr_auto] gap-4 items-center">
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('performance.table.employee')}
                </span>
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('performance.table.reviewer')}
                </span>
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('performance.table.reviewType')}
                </span>
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint text-end">
                  {t('performance.table.rating')}
                </span>
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('performance.table.status')}
                </span>
                <span className="sr-only">{t('common.actions')}</span>
              </div>
            </div>

            {/* Table body */}
            {reviewState.status === 'pending' ? (
              <SkeletonTable />
            ) : reviews.length === 0 ? (
              <div className="flex items-center justify-center px-5 py-10">
                <p className="text-body-sm text-ink-muted">{t('performance.noReviews')}</p>
              </div>
            ) : (
              reviews.map((review, idx) => {
                const emp = review.employee;
                const rev = review.reviewer;
                return (
                  <div
                    key={review.id}
                    className={cn(
                      'grid grid-cols-[2.5fr_2fr_1fr_1fr_1.2fr_auto] items-center gap-4 px-5 py-3',
                      idx < reviews.length - 1 && 'border-b border-divider',
                      'hover:bg-surface/60 transition-colors',
                    )}
                  >
                    {/* Employee — resolved via relation, no fabricated department */}
                    <div className="flex items-center gap-2 min-w-0">
                      {emp ? (
                        <>
                          <Avatar
                            initials={initialsOf(emp.first_name, emp.last_name)}
                            photo={emp.photo}
                            size={32}
                          />
                          <span className="truncate text-body-sm font-semibold text-ink">
                            {emp.first_name} {emp.last_name}
                          </span>
                        </>
                      ) : (
                        <span className="text-body-sm text-ink-faint">#{review.employee_id}</span>
                      )}
                    </div>

                    {/* Reviewer */}
                    <div className="flex items-center gap-2 min-w-0">
                      {rev ? (
                        <>
                          <Avatar
                            initials={initialsOf(rev.first_name, rev.last_name)}
                            photo={rev.photo}
                            size={32}
                          />
                          <span className="truncate text-body-sm text-ink">
                            {rev.first_name} {rev.last_name}
                          </span>
                        </>
                      ) : (
                        <span className="text-body-sm text-ink-faint">#{review.reviewer_id}</span>
                      )}
                    </div>

                    {/* Review type */}
                    <span className="text-body-sm text-ink-muted">
                      {t(`performance.reviewTypeOptions.${review.review_type}`)}
                    </span>

                    {/* Overall rating */}
                    <div className="text-end">
                      {review.overall_rating != null ? (
                        <span className="nums font-mono text-body-sm font-semibold text-ink">
                          {parseFloat(review.overall_rating).toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-body-sm text-ink-faint">—</span>
                      )}
                    </div>

                    {/* Status */}
                    <ReviewStatusBadge status={review.status} />

                    {/* Actions */}
                    <RowActions
                      onEdit={canEditReview ? () => openEditReview(review) : undefined}
                      onDelete={canDeleteReview ? () => setDeleteReview(review) : undefined}
                      editLabel={t('performance.editReviewAction')}
                      deleteLabel={t('performance.deleteReviewAction')}
                    />
                  </div>
                );
              })
            )}

            {reviewMeta && reviewMeta.last_page > 1 && (
              <div className="border-t border-divider px-5 py-3">
                <Pagination
                  currentPage={reviewParams.page ?? 1}
                  lastPage={reviewMeta.last_page}
                  total={reviewMeta.total}
                  perPage={REVIEW_PER_PAGE}
                  onPageChange={setReviewPage}
                />
              </div>
            )}
          </Card>

          {/* Mobile / tablet-portrait cards */}
          <div className="flex flex-col gap-3 lg:hidden">
            {reviewState.status === 'pending' ? (
              <SkeletonTable />
            ) : reviews.length === 0 ? (
              <Card className="flex items-center justify-center px-5 py-10">
                <p className="text-body-sm text-ink-muted">{t('performance.noReviews')}</p>
              </Card>
            ) : (
              reviews.map((review) => {
                const emp = review.employee;
                const rev = review.reviewer;
                return (
                  <Card key={review.id} className="flex flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {emp ? (
                          <>
                            <Avatar
                              initials={initialsOf(emp.first_name, emp.last_name)}
                              photo={emp.photo}
                              size={36}
                            />
                            <p className="truncate text-body-sm font-semibold text-ink">
                              {emp.first_name} {emp.last_name}
                            </p>
                          </>
                        ) : (
                          <span className="text-body-sm text-ink-faint">#{review.employee_id}</span>
                        )}
                      </div>
                      <ReviewStatusBadge status={review.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-t border-divider pt-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-caption text-ink-faint">{t('performance.table.reviewer')}</span>
                        {rev ? (
                          <span className="text-body-sm text-ink">
                            {rev.first_name} {rev.last_name}
                          </span>
                        ) : (
                          <span className="text-body-sm text-ink-faint">—</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-caption text-ink-faint">{t('performance.table.reviewType')}</span>
                        <span className="text-body-sm text-ink">
                          {t(`performance.reviewTypeOptions.${review.review_type}`)}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-caption text-ink-faint">{t('performance.table.rating')}</span>
                        {review.overall_rating != null ? (
                          <span className="nums font-mono text-body-sm font-semibold text-ink">
                            {parseFloat(review.overall_rating).toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-body-sm text-ink-faint">—</span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end border-t border-divider pt-2">
                      <RowActions
                        onEdit={canEditReview ? () => openEditReview(review) : undefined}
                        onDelete={canDeleteReview ? () => setDeleteReview(review) : undefined}
                        editLabel={t('performance.editReviewAction')}
                        deleteLabel={t('performance.deleteReviewAction')}
                      />
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ── Dialogs ──────────────────────────────────────────────────────────── */}

      {/* Cycle form */}
      <PerformanceCycleFormDialog
        open={cycleFormOpen}
        onOpenChange={setCycleFormOpen}
        cycle={editCycle}
      />

      {/* Delete cycle confirm */}
      <ConfirmDialog
        open={deleteCycle !== undefined}
        onOpenChange={(open) => { if (!open) setDeleteCycle(undefined); }}
        title={t('performance.deleteCycleTitle')}
        description={
          deleteCycle
            ? t('performance.deleteCycleDesc', { name: deleteCycle.name })
            : ''
        }
        confirmLabel={t('common.delete')}
        onConfirm={confirmDeleteCycle}
        isLoading={deleteCycleMutation.isPending}
      />

      {/* Review form */}
      <PerformanceReviewFormDialog
        open={reviewFormOpen}
        onOpenChange={setReviewFormOpen}
        review={editReview}
        defaultCycleId={effectiveSelectedCycleId}
      />

      {/* Delete review confirm */}
      <ConfirmDialog
        open={deleteReview !== undefined}
        onOpenChange={(open) => { if (!open) setDeleteReview(undefined); }}
        title={t('performance.deleteReviewTitle')}
        description={
          deleteReview
            ? t('performance.deleteReviewDesc', {
                employee: deleteReview.employee
                  ? `${deleteReview.employee.first_name} ${deleteReview.employee.last_name}`
                  : `#${String(deleteReview.employee_id)}`,
              })
            : ''
        }
        confirmLabel={t('common.delete')}
        onConfirm={confirmDeleteReview}
        isLoading={deleteReviewMutation.isPending}
      />
    </div>
  );
}
