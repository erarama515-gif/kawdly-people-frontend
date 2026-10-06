import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/form';
import { userFacingMessage } from '@/lib/api/errors';
import type { ApiError } from '@/lib/api/errors';
import { useCreateCareerPathLevel, useUpdateCareerPathLevel } from '../api/queries';
import type { CareerPathLevelInput } from '../api/resource';
import type { CareerPathLevelWire } from '../api/schema';

/**
 * Add/Edit modal for one career-path level.
 *
 * Fields (all verified against StoreCareerPathLevelRequest):
 *   - career_path_id       — required int FK
 *   - job_position_id      — required int FK
 *   - level_order          — nullable int ≥ 0
 *   - min_experience_years — nullable int ≥ 0
 *   - required_competencies   — required array (comma-separated in form, split on submit)
 *   - required_certifications — nullable array (comma-separated in form, split on submit)
 *
 * When the dialog is opened from a CareerPath card, `defaultCareerPathId` is
 * pre-filled so the user does not need to type it.
 *
 * The Save button is wired via HTML5 `form="career-path-level-form"` because it
 * lives outside the `<form>` DOM node (in the DialogContent footer) — required pattern.
 */

const REQUIRED = 'common.requiredField';

const careerPathLevelFormSchema = z.object({
  career_path_id: z.string().min(1, REQUIRED),
  job_position_id: z.string().min(1, REQUIRED),
  level_order: z.string(),
  min_experience_years: z.string(),
  required_competencies: z.string().min(1, REQUIRED),
  required_certifications: z.string(),
});

type CareerPathLevelFormValues = z.infer<typeof careerPathLevelFormSchema>;

function buildDefaultValues(
  level: CareerPathLevelWire | undefined,
  defaultCareerPathId: number | undefined,
): CareerPathLevelFormValues {
  if (!level) {
    return {
      career_path_id: defaultCareerPathId !== undefined ? String(defaultCareerPathId) : '',
      job_position_id: '',
      level_order: '',
      min_experience_years: '',
      required_competencies: '',
      required_certifications: '',
    };
  }
  return {
    career_path_id: String(level.career_path_id),
    job_position_id: String(level.job_position_id),
    level_order: level.level_order !== undefined ? String(level.level_order) : '',
    min_experience_years:
      level.min_experience_years !== undefined ? String(level.min_experience_years) : '',
    required_competencies: (level.required_competencies ?? []).join(', '),
    required_certifications: (level.required_certifications ?? []).join(', '),
  };
}

function splitTags(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function toCareerPathLevelInput(values: CareerPathLevelFormValues): CareerPathLevelInput {
  return {
    career_path_id: Number(values.career_path_id),
    job_position_id: Number(values.job_position_id),
    level_order: values.level_order.trim() ? Number(values.level_order) : null,
    min_experience_years: values.min_experience_years.trim()
      ? Number(values.min_experience_years)
      : null,
    required_competencies: splitTags(values.required_competencies),
    required_certifications: values.required_certifications.trim()
      ? splitTags(values.required_certifications)
      : null,
  };
}

function fieldErrorsFrom(error: ApiError | undefined): Record<string, string> {
  if (!error || error.status !== 422) return {};
  const body = error.body as { errors?: Record<string, string[]> } | undefined;
  if (!body?.errors) return {};
  const result: Record<string, string> = {};
  for (const [field, messages] of Object.entries(body.errors)) {
    if (messages[0]) result[field] = messages[0];
  }
  return result;
}

function translate(t: TFunction, message: string | undefined): string | undefined {
  return message ? t(message) : undefined;
}

export interface CareerPathLevelFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit (or pass `undefined`) to open in "Add Level" mode. */
  level?: CareerPathLevelWire | undefined;
  /**
   * Pre-fills the `career_path_id` field when the dialog is opened from a
   * specific CareerPath card. Ignored when `level` is provided (edit mode).
   */
  defaultCareerPathId?: number | undefined;
}

export function CareerPathLevelFormDialog({
  open,
  onOpenChange,
  level,
  defaultCareerPathId,
}: CareerPathLevelFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = level !== undefined;

  const createMutation = useCreateCareerPathLevel();
  const updateMutation = useUpdateCareerPathLevel();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  const resolver = useMemo(() => zodResolver(careerPathLevelFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CareerPathLevelFormValues>({
    resolver,
    defaultValues: buildDefaultValues(level, defaultCareerPathId),
  });

  // Re-seed the form every time the dialog opens.
  useEffect(() => {
    if (open) reset(buildDefaultValues(level, defaultCareerPathId));
  }, [open, level, defaultCareerPathId, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: CareerPathLevelFormValues) {
    const input = toCareerPathLevelInput(values);
    const result = isEdit
      ? await updateMutation.mutate({ id: level.id, ...input })
      : await createMutation.mutate(input);

    if (result) {
      handleOpenChange(false);
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof CareerPathLevelFormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('career.editLevel') : t('career.addLevel')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              form="career-path-level-form"
              variant="primary"
              isLoading={isPending}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form
          id="career-path-level-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          {mutationError ? (
            <p
              role="alert"
              className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral"
            >
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            {/* Career Path ID */}
            <Field
              label={t('career.levelForm.careerPathId')}
              htmlFor="career_path_id"
              required
              error={translate(t, errors.career_path_id?.message)}
            >
              <Input
                id="career_path_id"
                type="number"
                min="1"
                invalid={!!errors.career_path_id}
                {...register('career_path_id')}
              />
            </Field>

            {/* Job Position ID */}
            <Field
              label={t('career.levelForm.jobPositionId')}
              htmlFor="job_position_id"
              required
              error={translate(t, errors.job_position_id?.message)}
            >
              <Input
                id="job_position_id"
                type="number"
                min="1"
                invalid={!!errors.job_position_id}
                {...register('job_position_id')}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Level Order */}
            <Field
              label={t('career.levelForm.levelOrder')}
              htmlFor="level_order"
              error={translate(t, errors.level_order?.message)}
            >
              <Input
                id="level_order"
                type="number"
                min="0"
                invalid={!!errors.level_order}
                {...register('level_order')}
              />
            </Field>

            {/* Min Experience Years */}
            <Field
              label={t('career.levelForm.minExperienceYears')}
              htmlFor="min_experience_years"
              error={translate(t, errors.min_experience_years?.message)}
            >
              <Input
                id="min_experience_years"
                type="number"
                min="0"
                invalid={!!errors.min_experience_years}
                {...register('min_experience_years')}
              />
            </Field>
          </div>

          {/* Required Competencies */}
          <Field
            label={t('career.levelForm.requiredCompetencies')}
            htmlFor="required_competencies"
            required
            error={translate(t, errors.required_competencies?.message)}
          >
            <Input
              id="required_competencies"
              placeholder={t('career.levelForm.tagsPlaceholder')}
              invalid={!!errors.required_competencies}
              {...register('required_competencies')}
            />
          </Field>

          {/* Required Certifications */}
          <Field
            label={t('career.levelForm.requiredCertifications')}
            htmlFor="required_certifications"
            error={translate(t, errors.required_certifications?.message)}
          >
            <Input
              id="required_certifications"
              placeholder={t('career.levelForm.tagsPlaceholder')}
              invalid={!!errors.required_certifications}
              {...register('required_certifications')}
            />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
