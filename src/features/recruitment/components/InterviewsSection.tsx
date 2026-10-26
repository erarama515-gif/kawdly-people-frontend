import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Pencil, Plus, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';
import { userFacingMessage } from '@/lib/api/errors';
import { useHasPermission } from '@/auth/session';
import { useCancelInterview, useInterviewList } from '../api/interviews';
import type { InterviewStatus, InterviewWire } from '../api/interviews';
import { InterviewFormDialog } from './InterviewFormDialog';
import { InterviewScorecardDialog } from './InterviewScorecardDialog';

const STATUS_CLASSES: Record<InterviewStatus, string> = {
  scheduled: 'bg-blue-50 text-blue-700',
  completed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-600',
  no_show: 'bg-red-50 text-red-700',
};

function formatScheduled(value: string, language: string): string {
  return new Date(value).toLocaleString(language.startsWith('ar') ? 'ar-EG' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface InterviewsSectionProps {
  candidateId: number;
}

/**
 * Interviews + score sheet panel rendered inside the candidate details dialog.
 * Every action is permission gated with the exact Spatie slugs the route file
 * enforces (`recruitment.interview.*`).
 */
export function InterviewsSection({ candidateId }: InterviewsSectionProps) {
  const { t, i18n } = useTranslation();
  const canView = useHasPermission('recruitment.interview.view');
  const canCreate = useHasPermission('recruitment.interview.create');
  const canEdit = useHasPermission('recruitment.interview.edit');

  const { state } = useInterviewList(canView ? candidateId : 0);
  const cancelMutation = useCancelInterview();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InterviewWire | undefined>(undefined);
  const [scoreTarget, setScoreTarget] = useState<InterviewWire | undefined>(undefined);
  const [cancelTarget, setCancelTarget] = useState<InterviewWire | undefined>(undefined);

  if (!canView) return null;

  const interviews = state.data?.data ?? [];

  function openAdd() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function openEdit(interview: InterviewWire) {
    setEditTarget(interview);
    setFormOpen(true);
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    try {
      await cancelMutation.mutateAsync(cancelTarget.id);
      toast.success(t('recruitment.interviews.cancelled'));
      setCancelTarget(undefined);
    } catch (error) {
      toast.error(userFacingMessage(error));
    }
  }

  return (
    <div className="mt-5 border-t border-divider pt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-body-sm font-semibold text-ink">{t('recruitment.interviews.title')}</h3>
        {canCreate ? (
          <Button variant="secondary" className="h-7 gap-1 px-2 text-[12px]" onClick={openAdd}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            {t('recruitment.interviews.add')}
          </Button>
        ) : null}
      </div>

      {state.error ? (
        <p className="mb-2 text-caption text-coral">
          {userFacingMessage(state.error) || t('recruitment.interviews.loadFailed')}
        </p>
      ) : null}

      {state.status === 'pending' && interviews.length === 0 ? (
        <div className="h-14 animate-pulse rounded-[3px] bg-hairline/60" />
      ) : null}

      {state.status !== 'pending' && interviews.length === 0 ? (
        <p className="text-caption text-ink-muted">{t('recruitment.interviews.empty')}</p>
      ) : null}

      <div className="flex flex-col gap-2">
        {interviews.map((interview) => {
          const interviewerName = interview.interviewer
            ? interview.interviewer.first_name_ar && interview.interviewer.last_name_ar
              ? `${interview.interviewer.first_name_ar} ${interview.interviewer.last_name_ar}`
              : `${interview.interviewer.first_name} ${interview.interviewer.last_name}`
            : t('recruitment.interviews.noInterviewer');
          const status = interview.status ?? 'scheduled';
          const isScheduled = status === 'scheduled';

          return (
            <div
              key={interview.id}
              className="rounded-[3px] border border-hairline bg-surface/40 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-navy/5 px-2.5 py-0.5 text-[11px] font-semibold text-navy">
                    {t(`recruitment.interviews.types.${interview.type}`)}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                      STATUS_CLASSES[status],
                    )}
                  >
                    {t(`recruitment.interviews.statuses.${status}`)}
                  </span>
                  <span className="nums font-mono text-[11px] text-ink-muted">
                    {formatScheduled(interview.scheduled_at, i18n.language)}
                  </span>
                </div>

                {canEdit ? (
                  <div className="flex items-center gap-1">
                    {isScheduled ? (
                      <>
                        <Button
                          variant="ghost"
                          className="h-7 w-7 px-0"
                          aria-label={t('recruitment.interviews.actions.edit')}
                          onClick={() => openEdit(interview)}
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-7 w-7 px-0 hover:!text-emerald-600"
                          aria-label={t('recruitment.interviews.actions.complete')}
                          onClick={() => setScoreTarget(interview)}
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-7 w-7 px-0 hover:!text-coral"
                          aria-label={t('recruitment.interviews.actions.cancel')}
                          onClick={() => setCancelTarget(interview)}
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-muted">
                <span>{interviewerName}</span>
                {interview.location ? <span>{interview.location}</span> : null}
                {interview.overall_score ? (
                  <span className="nums font-mono font-semibold text-ink">
                    {Number(interview.overall_score).toFixed(1)} / 10
                  </span>
                ) : null}
                {interview.recommendation ? (
                  <span className="font-semibold text-ink">
                    {t(`recruitment.interviews.recommendations.${interview.recommendation}`)}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <InterviewFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        candidateId={candidateId}
        interview={editTarget}
      />

      <InterviewScorecardDialog
        open={scoreTarget !== undefined}
        onOpenChange={(open) => !open && setScoreTarget(undefined)}
        interview={scoreTarget}
      />

      <ConfirmDialog
        open={cancelTarget !== undefined}
        onOpenChange={(open) => !open && setCancelTarget(undefined)}
        title={t('recruitment.interviews.cancelConfirm.title')}
        description={t('recruitment.interviews.cancelConfirm.description')}
        confirmVariant="danger"
        isLoading={cancelMutation.isPending}
        onConfirm={() => void confirmCancel()}
      />
    </div>
  );
}
