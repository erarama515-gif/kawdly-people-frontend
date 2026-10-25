import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Search, Trash2, UserCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonTable } from '@/components/ui/SkeletonTable';
import { userFacingMessage } from '@/lib/api/errors';
import { useHasPermission } from '@/auth/session';
import { useJobPostingList } from '../api/queries';
import {
  useCandidateList,
  useUpdateCandidateStage,
  useDeleteCandidate,
} from '../api/pipelineQueries';
import type { CandidateStage, CandidateWire } from '../api/pipelineQueries';
import { ConvertToEmployeeDialog } from './ConvertToEmployeeDialog';
import { CandidateDetailsDialog } from './CandidateDetailsDialog';

const PER_PAGE = 10;

const STAGE_CLASSES: Record<CandidateStage, string> = {
  applied:   'bg-slate-100 text-slate-700',
  screening: 'bg-purple-50 text-purple-700',
  interview: 'bg-blue-50 text-blue-700',
  technical: 'bg-cyan-50 text-cyan-700',
  hr:        'bg-indigo-50 text-indigo-700',
  offer:     'bg-emerald-50 text-emerald-700',
  hired:     'bg-teal-50 text-teal-700',
  rejected:  'bg-red-50 text-red-700',
  withdrawn: 'bg-zinc-100 text-zinc-600',
};

const STAGE_OPTIONS: CandidateStage[] = [
  'applied',
  'screening',
  'interview',
  'technical',
  'hr',
  'offer',
  'hired',
  'rejected',
];

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ar-EG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function initialsOf(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function CandidatesSection() {
  const { t } = useTranslation();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<CandidateStage | 'all'>('all');
  const [jobFilter, setJobFilter] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);

  const [selectedCandidate, setSelectedCandidate] = useState<CandidateWire | undefined>(undefined);
  const [convertTarget, setConvertTarget] = useState<CandidateWire | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<CandidateWire | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, stageFilter, jobFilter]);

  const params = useMemo(
    () => ({
      page,
      perPage: PER_PAGE,
      search: search || undefined,
      stage: stageFilter,
      job_posting_id: jobFilter,
    }),
    [page, search, stageFilter, jobFilter],
  );

  const { state, refetch } = useCandidateList(params);
  const { state: jobPostingsState } = useJobPostingList({ page: 1, perPage: 100 });
  const jobPostings = jobPostingsState.data?.data ?? [];

  const updateStageMutation = useUpdateCandidateStage();
  const deleteMutation = useDeleteCandidate();

  const canEdit = useHasPermission('recruitment.candidate.edit');
  const canDelete = useHasPermission('recruitment.candidate.delete');
  const canConvert = useHasPermission('recruitment.convert_to_employee.create');

  const candidates = state.data?.data ?? [];
  const meta = state.data?.meta;

  async function handleStageChange(candidateId: number, nextStage: CandidateStage) {
    await updateStageMutation.mutate({ candidateId, stage: nextStage });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await deleteMutation.mutate(deleteTarget.id);
    if (result !== undefined || deleteMutation.error === undefined) {
      setDeleteTarget(undefined);
    }
  }

  return (
    <div className="flex flex-col">
      {/* Toolbar: Search + Job Filter + Stage Filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <label className="relative flex items-center">
          <span className="pointer-events-none absolute start-3 text-ink-faint">
            <Search className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <input
            type="search"
            placeholder={t('recruitment.candidate.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={cn(
              'h-9 rounded-full border border-hairline bg-surface ps-8 pe-4 text-[13px] text-ink placeholder:text-ink-faint',
              'focus:outline-none focus:ring-1 focus:ring-navy/40',
              'w-56',
            )}
          />
        </label>

        {/* Job Posting Select */}
        <select
          value={jobFilter ?? ''}
          onChange={(e) => setJobFilter(e.target.value ? Number(e.target.value) : undefined)}
          className="h-9 rounded-full border border-hairline bg-surface px-3 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-navy/40"
        >
          <option value="">{t('recruitment.candidate.filterAllJobs')}</option>
          {jobPostings.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title}
            </option>
          ))}
        </select>

        {/* Stage Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', ...STAGE_OPTIONS] as const).map((stage) => (
            <button
              key={stage}
              type="button"
              onClick={() => setStageFilter(stage)}
              className={cn(
                'rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors',
                stageFilter === stage
                  ? 'border-navy bg-navy text-on-navy'
                  : 'border-hairline bg-surface text-ink-muted hover:border-navy/40 hover:text-ink',
              )}
            >
              {t(`recruitment.candidate.stages.${stage}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {state.error ? (
        <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>{userFacingMessage(state.error) || t('recruitment.loadFailed')}</span>
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {/* Loading state */}
      {state.status === 'pending' && candidates.length === 0 ? <SkeletonTable /> : null}

      {/* Empty state */}
      {state.status !== 'pending' && candidates.length === 0 && (
        <Card className="px-5 py-10 text-center text-body-sm text-ink-muted">
          {t('recruitment.candidate.empty')}
        </Card>
      )}

      {/* Candidates Data Table */}
      {candidates.length > 0 && (
        <>
          <Card className="hidden lg:block">
            {/* Header */}
            <div className="border-b border-divider px-5 py-3">
              <div className="grid grid-cols-[2.2fr_1.8fr_1.4fr_1fr_1.2fr_auto] items-center gap-4">
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('recruitment.candidate.table.candidate')}
                </span>
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('recruitment.candidate.table.job')}
                </span>
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('recruitment.candidate.table.stage')}
                </span>
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('recruitment.candidate.table.score')}
                </span>
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('recruitment.candidate.table.applied')}
                </span>
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint text-end">
                  {t('recruitment.candidate.table.actions')}
                </span>
              </div>
            </div>

            {/* Rows */}
            {candidates.map((c, idx) => {
              const initials = initialsOf(c.first_name, c.last_name);
              const scoreNum = c.match_score !== undefined && c.match_score !== null ? Number(c.match_score) : undefined;
              const isReadyForHire = (c.stage === 'offer' || c.stage === 'hired') && !c.converted_employee_id;

              return (
                <div
                  key={c.id}
                  className={cn(
                    'grid grid-cols-[2.2fr_1.8fr_1.4fr_1fr_1.2fr_auto] items-center gap-4 px-5 py-3 transition-colors hover:bg-surface/60',
                    idx < candidates.length - 1 && 'border-b border-divider',
                  )}
                >
                  {/* Candidate Info */}
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar initials={initials} size={36} />
                    <div className="min-w-0">
                      <p className="truncate text-body-sm font-semibold text-ink">
                        {c.first_name} {c.last_name}
                      </p>
                      <p className="truncate text-caption text-ink-muted">{c.email}</p>
                    </div>
                  </div>

                  {/* Job Posting Title */}
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-medium text-ink">
                      {c.job_posting?.title || `#${c.job_posting_id ?? '—'}`}
                    </p>
                    {c.source ? (
                      <span className="text-caption text-ink-faint capitalize">{c.source}</span>
                    ) : null}
                  </div>

                  {/* Stage badge + quick change */}
                  <div>
                    {canEdit ? (
                      <select
                        value={c.stage}
                        onChange={(e) => void handleStageChange(c.id, e.target.value as CandidateStage)}
                        disabled={updateStageMutation.isPending}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-[11px] font-semibold border-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-navy/40',
                          STAGE_CLASSES[c.stage],
                        )}
                      >
                        {STAGE_OPTIONS.map((st) => (
                          <option key={st} value={st}>
                            {t(`recruitment.candidate.stages.${st}`)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', STAGE_CLASSES[c.stage])}>
                        {t(`recruitment.candidate.stages.${c.stage}`)}
                      </span>
                    )}
                  </div>

                  {/* Match Score */}
                  <div>
                    {scoreNum !== undefined ? (
                      <span
                        className={cn(
                          'nums font-mono text-[12px] font-bold px-2 py-0.5 rounded',
                          scoreNum >= 75
                            ? 'bg-emerald-50 text-emerald-700'
                            : scoreNum >= 50
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {scoreNum}%
                      </span>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </div>

                  {/* Applied Date */}
                  <span className="nums font-mono text-[12px] text-ink-muted">
                    {formatDate(c.applied_at)}
                  </span>

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-1.5">
                    {/* View Details */}
                    <Button
                      variant="ghost"
                      className="h-8 w-8 px-0 text-ink-muted hover:text-ink"
                      title={t('recruitment.candidate.actions.details')}
                      onClick={() => setSelectedCandidate(c)}
                    >
                      <Eye className="h-4 w-4" strokeWidth={1.75} />
                    </Button>

                    {/* Convert to Employee (if offer/hired) */}
                    {isReadyForHire && canConvert ? (
                      <Button
                        variant="secondary"
                        className="h-7 gap-1 px-2.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                        title={t('recruitment.candidate.actions.convert')}
                        onClick={() => setConvertTarget(c)}
                      >
                        <UserCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {t('recruitment.candidate.actions.convert')}
                      </Button>
                    ) : c.converted_employee_id ? (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 font-medium">
                        {t('recruitment.candidate.actions.converted')}
                      </span>
                    ) : null}

                    {/* Delete */}
                    {canDelete ? (
                      <Button
                        variant="ghost"
                        className="h-8 w-8 px-0 text-ink-muted hover:!text-coral"
                        title={t('recruitment.candidate.actions.delete')}
                        onClick={() => setDeleteTarget(c)}
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </Card>

          {/* Mobile view */}
          <div className="flex flex-col gap-3 lg:hidden">
            {candidates.map((c) => {
              const initials = initialsOf(c.first_name, c.last_name);
              const isReadyForHire = (c.stage === 'offer' || c.stage === 'hired') && !c.converted_employee_id;

              return (
                <Card key={c.id} className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar initials={initials} size={36} />
                      <div>
                        <p className="text-body-sm font-semibold text-ink">
                          {c.first_name} {c.last_name}
                        </p>
                        <p className="text-caption text-ink-muted">{c.email}</p>
                      </div>
                    </div>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', STAGE_CLASSES[c.stage])}>
                      {t(`recruitment.candidate.stages.${c.stage}`)}
                    </span>
                  </div>

                  <div className="border-t border-divider pt-2 text-caption text-ink-muted">
                    <p className="font-medium text-ink">
                      {c.job_posting?.title || `#${c.job_posting_id ?? '—'}`}
                    </p>
                    <p>{formatDate(c.applied_at)}</p>
                  </div>

                  <div className="flex items-center justify-between border-t border-divider pt-2">
                    <Button
                      variant="ghost"
                      className="h-7 px-2 text-[12px]"
                      onClick={() => setSelectedCandidate(c)}
                    >
                      <Eye className="h-3.5 w-3.5 me-1" />
                      {t('recruitment.candidate.actions.details')}
                    </Button>

                    <div className="flex items-center gap-2">
                      {isReadyForHire && canConvert ? (
                        <Button
                          variant="secondary"
                          className="h-7 px-2 text-[12px] bg-emerald-50 text-emerald-700"
                          onClick={() => setConvertTarget(c)}
                        >
                          <UserCheck className="h-3.5 w-3.5 me-1" />
                          {t('recruitment.candidate.actions.convert')}
                        </Button>
                      ) : null}

                      {canDelete ? (
                        <Button
                          variant="ghost"
                          className="h-7 w-7 px-0 hover:!text-coral"
                          onClick={() => setDeleteTarget(c)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {meta && meta.last_page > 1 && (
            <div className="mt-4 flex justify-end">
              <Pagination
                currentPage={page}
                lastPage={meta.last_page}
                onPageChange={setPage}
                total={meta.total}
                perPage={PER_PAGE}
              />
            </div>
          )}
        </>
      )}

      {/* Candidate Details Dialog */}
      <CandidateDetailsDialog
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(undefined)}
      />

      {/* Convert to Employee Dialog */}
      <ConvertToEmployeeDialog
        candidate={convertTarget}
        onClose={() => setConvertTarget(undefined)}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t('recruitment.candidate.deleteConfirm.title')}
        description={
          deleteTarget
            ? t('recruitment.candidate.deleteConfirm.description', {
                name: `${deleteTarget.first_name} ${deleteTarget.last_name}`,
              })
            : undefined
        }
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
