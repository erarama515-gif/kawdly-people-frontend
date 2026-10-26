import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import type { CandidateWire } from '../api/pipelineQueries';
import { InterviewsSection } from './InterviewsSection';

export interface CandidateDetailsDialogProps {
  candidate: CandidateWire | undefined;
  onClose: () => void;
}

export function CandidateDetailsDialog({ candidate, onClose }: CandidateDetailsDialogProps) {
  const { t } = useTranslation();

  if (!candidate) return null;

  const initials = `${candidate.first_name.charAt(0)}${candidate.last_name.charAt(0)}`.toUpperCase();
  const rawScore = candidate.match_score;
  const scoreNum = rawScore !== undefined && rawScore !== null ? Number(rawScore) : undefined;

  function formatDate(isoDate?: string | null): string {
    if (!isoDate) return '—';
    return new Date(isoDate).toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="scrollbar-slim max-h-[calc(100vh-32px)] w-full max-w-2xl overflow-y-auto p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3 border-b border-divider pb-4">
          <Avatar initials={initials} size={40} />
          <div>
            <h2 className="text-body font-bold text-ink">
              {candidate.first_name} {candidate.last_name}
            </h2>
            <p className="text-caption text-ink-muted">{candidate.email}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-caption text-ink-faint">{t('recruitment.candidate.details.phone')}</span>
              <p className="nums font-mono text-body-sm text-ink">{candidate.phone || '—'}</p>
            </div>
            <div>
              <span className="text-caption text-ink-faint">{t('recruitment.candidate.details.source')}</span>
              <p className="text-body-sm text-ink">{candidate.source || '—'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-caption text-ink-faint">{t('recruitment.candidate.details.matchScore')}</span>
              <p className="nums font-mono text-body-sm font-semibold text-emerald-700">
                {scoreNum !== undefined ? `${scoreNum}%` : '—'}
              </p>
            </div>
            <div>
              <span className="text-caption text-ink-faint">{t('recruitment.candidate.details.appliedDate')}</span>
              <p className="text-caption text-ink-muted">{formatDate(candidate.applied_at)}</p>
            </div>
          </div>

          <div>
            <span className="text-caption text-ink-faint">{t('recruitment.candidate.table.job')}</span>
            <p className="text-body-sm font-medium text-ink">
              {candidate.job_posting?.title || `#${candidate.job_posting_id ?? '—'}`}
            </p>
          </div>

          <div className="mt-2 rounded-md border border-hairline bg-surface/50 p-3">
            <span className="block mb-1 text-caption font-semibold text-ink-muted">
              {t('recruitment.candidate.details.notes')}
            </span>
            <p className="whitespace-pre-wrap text-caption text-ink leading-relaxed">
              {candidate.notes || t('recruitment.candidate.details.noNotes')}
            </p>
          </div>

          <InterviewsSection candidateId={candidate.id} />
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            {t('recruitment.candidate.details.close')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
