import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { userFacingMessage } from '@/lib/api/errors';
import type { ApiError } from '@/lib/api/errors';
import { useJobPositionList } from '@/features/organization/api/queries';
import { useCreateLearningPath, useUpdateLearningPath } from '../api/queries';
import type { LearningPathInput } from '../api/resource';
import type { LearningPathWire } from '../api/schema';

/**
 * Add/Edit modal for one LearningPath, built on `Dialog` + react-hook-form +
 * zod — the same library combination as `TrainingProgramFormDialog` and
 * `CareerPathFormDialog`.
 *
 * `from_position_id` / `to_position_id` are optional `job_position` FKs, fed
 * by the cross-feature `useJobPositionList` picker (same convention as the
 * Employee/Organization dialogs). The Save button lives in the dialog footer
 * and is wired via the HTML5 `form="learning-path-form"` attribute.
 */

const REQUIRED = 'common.requiredField';

const learningPathFormSchema = z.object({
  name: z.string().trim().min(1, REQUIRED).max(255),
  description: z.string(),
  from_position_id: z.string(),
  to_position_id: z.string(),
});

type LearningPathFormValues = z.infer<typeof learningPathFormSchema>;

function buildDefaultValues(path: LearningPathWire | undefined): LearningPathFormValues {
  if (!path) {
    return { name: '', description: '', from_position_id: '', to_position_id: '' };
  }
  return {
    name: path.name,
    description: path.description ?? '',
    from_position_id: path.from_position_id !== undefined ? String(path.from_position_id) : '',
    to_position_id: path.to_position_id !== undefined ? String(path.to_position_id) : '',
  };
}

function toLearningPathInput(values: LearningPathFormValues): LearningPathInput {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    from_position_id: values.from_position_id ? Number(values.from_position_id) : null,
    to_position_id: values.to_position_id ? Number(values.to_position_id) : null,
  };
}

/** Pulls Laravel's `{errors: {field: [message]}}` 422 body into RHF field errors. */
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

export interface LearningPathFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit (or pass `undefined`) to open in "Add Learning Path" mode. */
  path?: LearningPathWire | undefined;
}

export function LearningPathFormDialog({ open, onOpenChange, path }: LearningPathFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = path !== undefined;

  const createMutation = useCreateLearningPath();
  const updateMutation = useUpdateLearningPath();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  // Job-position picker — cross-feature, unrestricted (any position).
  const { state: positionState } = useJobPositionList({ page: 1, perPage: 200 });
  const positions = positionState.data?.data ?? [];

  const resolver = useMemo(() => zodResolver(learningPathFormSchema), []);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<LearningPathFormValues>({ resolver, defaultValues: buildDefaultValues(path) });

  // Re-seed the form every time the dialog opens.
  useEffect(() => {
    if (open) reset(buildDefaultValues(path));
  }, [open, path, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: LearningPathFormValues) {
    const input = toLearningPathInput(values);
    const result = isEdit
      ? await updateMutation.mutate({ id: path.id, ...input })
      : await createMutation.mutate(input);

    if (result) {
      handleOpenChange(false);
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof LearningPathFormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('learning.path.edit') : t('learning.path.add')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="learning-path-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="learning-path-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutationError ? (
            <p
              role="alert"
              className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral"
            >
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          <Field
            label={t('learning.path.form.name')}
            htmlFor="lp_name"
            required
            error={translate(t, errors.name?.message)}
          >
            <Input id="lp_name" invalid={!!errors.name} {...register('name')} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('learning.path.form.fromPosition')}
              htmlFor="lp_from_position_id"
              error={translate(t, errors.from_position_id?.message)}
            >
              <Select id="lp_from_position_id" invalid={!!errors.from_position_id} {...register('from_position_id')}>
                <option value="">{t('learning.path.form.noPosition')}</option>
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.title}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={t('learning.path.form.toPosition')}
              htmlFor="lp_to_position_id"
              error={translate(t, errors.to_position_id?.message)}
            >
              <Select id="lp_to_position_id" invalid={!!errors.to_position_id} {...register('to_position_id')}>
                <option value="">{t('learning.path.form.noPosition')}</option>
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.title}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label={t('learning.path.form.description')}
            htmlFor="lp_description"
            error={translate(t, errors.description?.message)}
          >
            <Textarea
              id="lp_description"
              rows={3}
              invalid={!!errors.description}
              {...register('description')}
            />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
