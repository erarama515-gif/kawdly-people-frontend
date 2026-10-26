import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { toast } from '@/components/ui/Toast';
import { userFacingMessage } from '@/lib/api/errors';
import { useCompleteInterview } from '../api/interviews';
import type {
  InterviewRecommendation,
  InterviewWire,
} from '../api/interviews';

const REQUIRED = 'common.requiredField';

const RECOMMENDATIONS: readonly InterviewRecommendation[] = [
  'hire',
  'next_round',
  'hold',
  'reject',
];

const formSchema = z.object({
  overall_score: z
    .string()
    .min(1, REQUIRED)
    .refine((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 && parsed <= 10;
    }, 'recruitment.interviews.validation.scoreRange'),
  technical_score: z.string().refine((value) => {
    if (!value) return true;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5;
  }, 'recruitment.interviews.validation.competencyRange'),
  communication_score: z.string().refine((value) => {
    if (!value) return true;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5;
  }, 'recruitment.interviews.validation.competencyRange'),
  recommendation: z.string().min(1, REQUIRED),
  notes: z.string().trim().max(2000),
});

type FormValues = z.infer<typeof formSchema>;

const EMPTY_VALUES: FormValues = {
  overall_score: '',
  technical_score: '',
  communication_score: '',
  recommendation: 'hire',
  notes: '',
};

function translate(t: TFunction, message: string | undefined): string | undefined {
  return message ? t(message) : undefined;
}

export interface InterviewScorecardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interview: InterviewWire | undefined;
}

/**
 * Score sheet shown when an interviewer marks a scheduled interview complete.
 *
 * `overall_score` is kept on the same 0–10 scale the backend column and the
 * existing seeded rows use; the two competency ratings are 1–5 and are stored
 * in the interview's `feedback` JSON object.
 */
export function InterviewScorecardDialog({
  open,
  onOpenChange,
  interview,
}: InterviewScorecardDialogProps) {
  const { t } = useTranslation();
  const completeMutation = useCompleteInterview();
  const resolver = useMemo(() => zodResolver(formSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver,
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (open) {
      completeMutation.reset();
      reset({
        ...EMPTY_VALUES,
        overall_score:
          interview?.overall_score !== undefined ? String(Number(interview.overall_score)) : '',
        recommendation: interview?.recommendation ?? 'hire',
        notes: interview?.notes ?? '',
      });
    }
    // `completeMutation.reset` is stable; the reset only needs to run on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, interview, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) completeMutation.reset();
    onOpenChange(next);
  }

  async function onSubmit(values: FormValues) {
    if (!interview) return;

    try {
      await completeMutation.mutateAsync({
        id: interview.id,
        overallScore: Number(values.overall_score),
        technicalScore: values.technical_score ? Number(values.technical_score) : null,
        communicationScore: values.communication_score
          ? Number(values.communication_score)
          : null,
        recommendation: values.recommendation as InterviewRecommendation,
        notes: values.notes.trim() || null,
      });
      toast.success(t('recruitment.interviews.completed'));
      handleOpenChange(false);
    } catch {
      // The mutation stores the error for the inline alert below.
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={t('recruitment.interviews.scorecardTitle')}
        description={t('recruitment.interviews.scorecardHint')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={completeMutation.isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              form="interview-scorecard-form"
              variant="primary"
              isLoading={completeMutation.isPending}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form
          id="interview-scorecard-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          {completeMutation.error ? (
            <p
              role="alert"
              className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral"
            >
              {userFacingMessage(completeMutation.error)}
            </p>
          ) : null}

          <div className="grid grid-cols-3 gap-4">
            <Field
              label={t('recruitment.interviews.fields.overallScore')}
              htmlFor="scorecard_overall"
              required
              error={translate(t, errors.overall_score?.message)}
            >
              <Input
                id="scorecard_overall"
                type="number"
                min={0}
                max={10}
                step={0.5}
                invalid={!!errors.overall_score}
                {...register('overall_score')}
              />
            </Field>

            <Field
              label={t('recruitment.interviews.fields.technicalScore')}
              htmlFor="scorecard_technical"
              error={translate(t, errors.technical_score?.message)}
            >
              <Input
                id="scorecard_technical"
                type="number"
                min={1}
                max={5}
                step={1}
                invalid={!!errors.technical_score}
                {...register('technical_score')}
              />
            </Field>

            <Field
              label={t('recruitment.interviews.fields.communicationScore')}
              htmlFor="scorecard_communication"
              error={translate(t, errors.communication_score?.message)}
            >
              <Input
                id="scorecard_communication"
                type="number"
                min={1}
                max={5}
                step={1}
                invalid={!!errors.communication_score}
                {...register('communication_score')}
              />
            </Field>
          </div>

          <Field
            label={t('recruitment.interviews.fields.recommendation')}
            htmlFor="scorecard_recommendation"
            required
            error={translate(t, errors.recommendation?.message)}
          >
            <Select
              id="scorecard_recommendation"
              invalid={!!errors.recommendation}
              {...register('recommendation')}
            >
              {RECOMMENDATIONS.map((recommendation) => (
                <option key={recommendation} value={recommendation}>
                  {t(`recruitment.interviews.recommendations.${recommendation}`)}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={t('recruitment.interviews.fields.notes')}
            htmlFor="scorecard_notes"
            error={translate(t, errors.notes?.message)}
          >
            <Textarea
              id="scorecard_notes"
              rows={4}
              invalid={!!errors.notes}
              {...register('notes')}
            />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
