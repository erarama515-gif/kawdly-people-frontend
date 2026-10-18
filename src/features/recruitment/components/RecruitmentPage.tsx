import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Search, Trash2, UserCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { SkeletonTable } from '@/components/ui/SkeletonTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/form';
import { userFacingMessage } from '@/lib/api/errors';
import {
  useBranchList,
  useDepartmentList,
  useJobPositionList,
} from '@/features/organization/api/queries';
import { useDeleteJobPosting, useJobPostingList } from '../api/queries';
import type { JobPostingListParams, JobPostingStatus } from '../api/resource';
import type { JobPostingWire } from '../api/schema';
import { JobPostingFormDialog } from './JobPostingFormDialog';
import {
  usePipelineStats,
  useOfferCandidates,
  useConvertToEmployee,
} from '../api/pipelineQueries';
import type { CandidateWire, ConvertToEmployeeInput } from '../api/pipelineQueries';

/**
 * The Recruitment module's job-postings page: live data backed by
 * `useJobPostingList`, Add/Edit via `JobPostingFormDialog`, delete via
 * `ConfirmDialog` + optimistic `useDeleteJobPosting`, and page controls via
 * the shared `Pagination`. Mirrors `EmployeesPage` exactly.
 *
 * The `PipelineStage` mini-visualization is backed entirely by real DB data
 * via `usePipelineStats`. While the first fetch is in flight (or on error) it
 * shows a dash per stage rather than a fabricated number.
 *
 * The "Convert to Employee" panel lists offer/hired-stage candidates and lets
 * HR promote them with a single click via `useConvertToEmployee`.
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

// ─── Pipeline Visualization (live data, graceful fallback) ────────────────────

interface PipelineProps {
  stages: Array<{ label: string; count: number | undefined }>;
  isLoading: boolean;
}

function Pipeline({ stages, isLoading }: PipelineProps) {
  const { t } = useTranslation();
  return (
    <Card className="mb-8 px-5 py-5">
      <p className="mb-4 text-caption font-semibold uppercase tracking-wide text-ink-faint">
        {t('recruitment.hiringPipeline')}
      </p>
      <div className="flex items-center gap-0">
        {stages.map((stage, idx) => (
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
                  isLoading && 'opacity-40',
                  idx === 0 ? 'text-navy' : 'text-ink',
                )}
              >
                {stage.count !== undefined ? stage.count.toLocaleString() : '—'}
              </span>
              <span className="mt-0.5 text-caption text-ink-muted">{stage.label}</span>
            </div>
            {idx < stages.length - 1 && (
              <span className="mx-2 select-none text-[20px] font-light text-ink-faint">→</span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Convert to Employee Dialog ───────────────────────────────────────────────

interface ConvertDialogProps {
  candidate: CandidateWire | undefined;
  onClose: () => void;
}

function ConvertToEmployeeDialog({ candidate, onClose }: ConvertDialogProps) {
  const { t } = useTranslation();
  const convertMutation = useConvertToEmployee();

  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    branch_id: '',
    department_id: '',
    job_position_id: '',
    joining_date: today,
    employment_type: 'full_time' as ConvertToEmployeeInput['employment_type'],
    work_location: 'office' as ConvertToEmployeeInput['work_location'],
  });

  const { state: branchState } = useBranchList({ page: 1, perPage: 200 });
  const branches = branchState.data?.data ?? [];
  const { state: departmentState } = useDepartmentList({ page: 1, perPage: 200 });
  const departments = departmentState.data?.data ?? [];
  const { state: positionState } = useJobPositionList({
    page: 1,
    perPage: 200,
    departmentId: form.department_id ? Number(form.department_id) : undefined,
  });
  const positions = positionState.data?.data ?? [];

  if (!candidate) return null;

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleDepartmentChange(value: string) {
    // Changing department invalidates whatever position was previously
    // selected — mirrors `EmployeeFormDialog`'s cascade reset.
    setForm((prev) => ({ ...prev, department_id: value, job_position_id: '' }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!candidate) return;
    const result = await convertMutation.mutate({
      candidateId: candidate.id,
      branch_id: Number(form.branch_id),
      department_id: Number(form.department_id),
      job_position_id: Number(form.job_position_id),
      joining_date: form.joining_date,
      employment_type: form.employment_type,
      work_location: form.work_location,
    });
    if (result !== undefined || convertMutation.error === undefined) {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="w-full max-w-md p-6 shadow-xl">
        <h2 className="mb-4 text-body-sm font-semibold text-ink">
          {t('recruitment.convertToEmployee.title', {
            name: `${candidate.first_name} ${candidate.last_name}`,
            defaultValue: `Convert ${candidate.first_name} ${candidate.last_name} to Employee`,
          })}
        </h2>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-caption text-ink-muted">
            {t('employees.form.branch')}
            <Select
              required
              value={form.branch_id}
              onChange={(e) => handleChange('branch_id', e.target.value)}
            >
              <option value="">{t('common.selectPlaceholder')}</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-caption text-ink-muted">
            {t('employees.form.department')}
            <Select
              required
              value={form.department_id}
              onChange={(e) => handleDepartmentChange(e.target.value)}
            >
              <option value="">{t('common.selectPlaceholder')}</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-caption text-ink-muted">
            {t('employees.form.jobPosition')}
            <Select
              required
              value={form.job_position_id}
              onChange={(e) => handleChange('job_position_id', e.target.value)}
            >
              <option value="">{t('common.selectPlaceholder')}</option>
              {positions.map((position) => (
                <option key={position.id} value={position.id}>{position.title}</option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-caption text-ink-muted">
            {t('recruitment.convertToEmployee.joiningDate', { defaultValue: 'Joining Date' })}
            <input
              required
              type="date"
              value={form.joining_date}
              onChange={(e) => handleChange('joining_date', e.target.value)}
              className="rounded border border-hairline px-2 py-1 text-body-sm text-ink focus:outline-none focus:ring-1 focus:ring-navy/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-caption text-ink-muted">
            {t('recruitment.convertToEmployee.employmentType', { defaultValue: 'Employment Type' })}
            <select
              value={form.employment_type}
              onChange={(e) => handleChange('employment_type', e.target.value)}
              className="rounded border border-hairline px-2 py-1 text-body-sm text-ink focus:outline-none focus:ring-1 focus:ring-navy/40"
            >
              <option value="full_time">Full Time</option>
              <option value="part_time">Part Time</option>
              <option value="contract">Contract</option>
              <option value="intern">Intern</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-caption text-ink-muted">
            {t('recruitment.convertToEmployee.workLocation', { defaultValue: 'Work Location' })}
            <select
              value={form.work_location}
              onChange={(e) => handleChange('work_location', e.target.value)}
              className="rounded border border-hairline px-2 py-1 text-body-sm text-ink focus:outline-none focus:ring-1 focus:ring-navy/40"
            >
              <option value="office">Office</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </label>

          {convertMutation.error ? (
            <p className="text-body-sm text-coral">
              {userFacingMessage(convertMutation.error) ||
                t('recruitment.convertToEmployee.failed', { defaultValue: 'Conversion failed. Please try again.' })}
            </p>
          ) : null}

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={convertMutation.isPending}>
              {convertMutation.isPending
                ? t('common.loading')
                : t('recruitment.convertToEmployee.confirm', { defaultValue: 'Convert to Employee' })}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ─── Offer/Hired Candidates Panel ─────────────────────────────────────────────

function OfferCandidatesPanel() {
  const { t } = useTranslation();
  const { state } = useOfferCandidates();
  const [convertTarget, setConvertTarget] = useState<CandidateWire | undefined>(undefined);

  const candidates = state.data ?? [];

  if (state.status === 'pending') {
    return (
      <Card className="mb-8 px-5 py-5">
        <p className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
          {t('recruitment.offerPanel.title', { defaultValue: 'Ready to Convert' })}
        </p>
        <div className="mt-4 h-24 animate-pulse rounded bg-hairline" />
      </Card>
    );
  }

  if (candidates.length === 0) return null;

  return (
    <Card className="mb-8 px-5 py-5">
      <p className="mb-4 text-caption font-semibold uppercase tracking-wide text-ink-faint">
        {t('recruitment.offerPanel.title', { defaultValue: 'Ready to Convert' })}
      </p>

      <div className="flex flex-col divide-y divide-divider">
        {candidates.map((candidate) => (
          <div key={candidate.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-body-sm font-semibold text-ink">
                {candidate.first_name} {candidate.last_name}
              </p>
              <p className="truncate text-caption text-ink-muted">{candidate.email}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                  candidate.stage === 'offer'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-blue-50 text-blue-700',
                )}
              >
                {candidate.stage}
              </span>
              <Button
                variant="secondary"
                className="h-7 gap-1 px-2 text-[12px]"
                onClick={() => setConvertTarget(candidate)}
              >
                <UserCheck className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                {t('recruitment.convertToEmployee.action', { defaultValue: 'Convert' })}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <ConvertToEmployeeDialog
        candidate={convertTarget}
        onClose={() => setConvertTarget(undefined)}
      />
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

  // Pipeline stats — live from DB, falls back to the static mock while loading.
  const { state: pipelineState } = usePipelineStats();

  const deleteMutation = useDeleteJobPosting(params);

  const postings = state.data?.data ?? [];
  const meta = state.data?.meta;

  // Build the pipeline display array.
  // When real data is available use it; while loading or on error show a dash
  // per stage rather than any fabricated number (never fabricate statistics).
  const liveStages = pipelineState.data?.stages;
  const pipelineDisplayStages: Array<{ label: string; count: number | undefined }> = [
    { label: 'Applied',   count: liveStages?.applied },
    { label: 'Screening', count: liveStages?.screening },
    { label: 'Interview', count: liveStages?.interview },
    { label: 'Offer',     count: liveStages?.offer },
  ];

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

      {/* Pipeline — real data from usePipelineStats, static fallback while loading */}
      <Pipeline
        stages={pipelineDisplayStages}
        isLoading={pipelineState.status === 'pending'}
      />

      {/* Offer/Hired candidates ready for conversion */}
      <OfferCandidatesPanel />

      {/* Toolbar: search + status filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <label className="relative flex items-center">
          <span className="pointer-events-none absolute start-3 text-ink-faint">
            <Search className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <input
            type="search"
            placeholder={t('recruitment.searchPlaceholder')}
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
        <SkeletonTable />
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
