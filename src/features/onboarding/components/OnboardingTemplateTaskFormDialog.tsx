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
import {
  useCreateOnboardingTemplateTask,
  useUpdateOnboardingTemplateTask,
} from '../api/queries';
import type {
  OnboardingOwnerType,
  OnboardingTemplateTaskInput,
} from '../api/resource';
import type { OnboardingTemplateTaskWire } from '../api/schema';

/**
 * Add/Edit modal for one OnboardingTemplateTask, built on Dialog + react-hook-form
 * + zod — same pattern as OnboardingInstanceFormDialog.
 *
 * `template_id` is supplied by the parent (the selected template in OnboardingPage)
 * and is NOT user-editable in this dialog.
 */

const REQUIRED = 'common.requiredField';

const OWNER_TYPES: readonly OnboardingOwnerType[] = ['hr', 'it', 'manager', 'employee', 'admin', 'finance'];

const FORM_ID = 'onboarding-template-task-form';

const schema = z.object({
  title: z.string().min(1, REQUIRED).max(255),
  description: z.string(),
  owner_type: z.string().min(1, REQUIRED),
  due_days_offset: z.string(),
  is_required: z.boolean(),
  sort_order: z.string(),
});

type FormValues = z.infer<typeof schema>;

function buildDefaultValues(task: OnboardingTemplateTaskWire | undefined): FormValues {
  if (!task) {
    return {
      title: '',
      description: '',
      owner_type: 'hr',
      due_days_offset: '',
      is_required: false,
      sort_order: '',
    };
  }
  return {
    title: task.title,
    description: task.description ?? '',
    owner_type: task.owner_type,
    due_days_offset: task.due_days_offset !== undefined ? String(task.due_days_offset) : '',
    is_required: task.is_required ?? false,
    sort_order: task.sort_order !== undefined ? String(task.sort_order) : '',
  };
}

function toInput(values: FormValues, templateId: number): OnboardingTemplateTaskInput {
  return {
    template_id: templateId,
    title: values.title,
    description: values.description || null,
    owner_type: values.owner_type as OnboardingOwnerType,
    due_days_offset: values.due_days_offset !== '' ? Number(values.due_days_offset) : null,
    is_required: values.is_required,
    sort_order: values.sort_order !== '' ? Number(values.sort_order) : null,
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

export interface OnboardingTemplateTaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: number;
  /** Omit (or pass `undefined`) to open in "New Task" mode. */
  task?: OnboardingTemplateTaskWire | undefined;
}

export function OnboardingTemplateTaskFormDialog({
  open,
  onOpenChange,
  templateId,
  task,
}: OnboardingTemplateTaskFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = task !== undefined;

  const createMutation = useCreateOnboardingTemplateTask();
  const updateMutation = useUpdateOnboardingTemplateTask();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  const resolver = useMemo(() => zodResolver(schema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver,
    defaultValues: buildDefaultValues(task),
  });

  // Re-seed the form every time the dialog opens.
  useEffect(() => {
    if (open) reset(buildDefaultValues(task));
  }, [open, task, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: FormValues) {
    const input = toInput(values, templateId);
    const result = isEdit
      ? await updateMutation.mutate({ id: task.id, ...input })
      : await createMutation.mutate(input);

    if (result) {
      handleOpenChange(false);
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof FormValues, { type: 'server', message });
    }
  }

  const isRequiredValue = watch('is_required');

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('onboarding.templateTask.editTitle') : t('onboarding.templateTask.addTitle')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              form={FORM_ID}
              variant="primary"
              isLoading={isPending}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form
          id={FORM_ID}
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

          {/* Title */}
          <Field
            label={t('onboarding.templateTask.form.title')}
            htmlFor="tt_title"
            required
            error={translate(t, errors.title?.message)}
          >
            <Input
              id="tt_title"
              type="text"
              invalid={!!errors.title}
              {...register('title')}
            />
          </Field>

          {/* Description */}
          <Field
            label={t('onboarding.templateTask.form.description')}
            htmlFor="tt_description"
            error={translate(t, errors.description?.message)}
          >
            <Textarea
              id="tt_description"
              rows={3}
              invalid={!!errors.description}
              {...register('description')}
            />
          </Field>

          {/* Owner type + Is Required row */}
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('onboarding.templateTask.form.ownerType')}
              htmlFor="tt_owner_type"
              required
              error={translate(t, errors.owner_type?.message)}
            >
              <Select id="tt_owner_type" invalid={!!errors.owner_type} {...register('owner_type')}>
                {OWNER_TYPES.map((ot) => (
                  <option key={ot} value={ot}>
                    {t(`onboarding.templateTask.ownerTypeOptions.${ot}`)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={t('onboarding.templateTask.form.isRequired')}
              htmlFor="tt_is_required"
              error={translate(t, errors.is_required?.message)}
            >
              <label className="flex h-9 cursor-pointer items-center gap-2">
                <input
                  id="tt_is_required"
                  type="checkbox"
                  checked={isRequiredValue}
                  onChange={(e) => setValue('is_required', e.target.checked)}
                  className="h-4 w-4 rounded border-hairline accent-navy"
                />
                <span className="text-body-sm text-ink">
                  {t('onboarding.templateTask.form.isRequired')}
                </span>
              </label>
            </Field>
          </div>

          {/* Due days offset + Sort order row */}
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('onboarding.templateTask.form.dueDaysOffset')}
              htmlFor="tt_due_days_offset"
              error={translate(t, errors.due_days_offset?.message)}
            >
              <Input
                id="tt_due_days_offset"
                type="number"
                invalid={!!errors.due_days_offset}
                {...register('due_days_offset')}
              />
            </Field>

            <Field
              label={t('onboarding.templateTask.form.sortOrder')}
              htmlFor="tt_sort_order"
              error={translate(t, errors.sort_order?.message)}
            >
              <Input
                id="tt_sort_order"
                type="number"
                invalid={!!errors.sort_order}
                {...register('sort_order')}
              />
            </Field>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
