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
import { toast } from '@/components/ui/Toast';
import { useCreateJobLevel, useUpdateJobLevel } from '../api/queries';
import type { JobLevelInput } from '../api/resource';
import type { JobLevelWire } from '../api/schema';

/**
 * Add/Edit modal for one JobLevel record.
 *
 * Confirmed fields from StoreJobLevelRequest.php:
 *   company_id (required FK, attached server-side), name (required),
 *   sort_order (nullable integer). No code or salary fields on this resource
 *   (those live on JobGrade only) — confirmed from UpdateJobLevelRequest.php.
 *
 * Footer Save is wired via form="job-level-form" attribute.
 */

const REQUIRED = 'common.requiredField';

const jobLevelFormSchema = z.object({
  name: z.string().min(1, REQUIRED).max(255),
  sort_order: z.string(),
});

type JobLevelFormValues = z.infer<typeof jobLevelFormSchema>;

function buildDefaultValues(jobLevel: JobLevelWire | undefined): JobLevelFormValues {
  if (!jobLevel) {
    return {
      name: '',
      sort_order: '',
    };
  }
  return {
    name: jobLevel.name,
    sort_order: jobLevel.sort_order !== undefined ? String(jobLevel.sort_order) : '',
  };
}

function toJobLevelInput(values: JobLevelFormValues): JobLevelInput {
  return {
    name: values.name.trim(),
    sort_order: values.sort_order ? Number(values.sort_order) : null,
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

export interface JobLevelFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobLevel?: JobLevelWire | undefined;
}

export function JobLevelFormDialog({ open, onOpenChange, jobLevel }: JobLevelFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = jobLevel !== undefined;

  const createMutation = useCreateJobLevel();
  const updateMutation = useUpdateJobLevel();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  const resolver = useMemo(() => zodResolver(jobLevelFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<JobLevelFormValues>({
    resolver,
    defaultValues: buildDefaultValues(jobLevel),
  });

  useEffect(() => {
    if (open) reset(buildDefaultValues(jobLevel));
  }, [open, jobLevel, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: JobLevelFormValues) {
    const input = toJobLevelInput(values);
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: jobLevel.id, ...input });
      } else {
        await createMutation.mutateAsync(input);
      }
    } catch (error) {
      const failure = error as ApiError;
      toast.error(userFacingMessage(failure));
      const fieldErrors = fieldErrorsFrom(failure);
      for (const [field, message] of Object.entries(fieldErrors)) {
        setError(field as keyof JobLevelFormValues, { type: 'server', message });
      }
      return;
    }

    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('organization.jobLevel.editTitle') : t('organization.jobLevel.addTitle')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="job-level-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="job-level-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutationError ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          {/* Name */}
          <Field
            label={t('organization.jobLevel.form.name')}
            htmlFor="jl_name"
            required
            error={translate(t, errors.name?.message)}
          >
            <Input id="jl_name" invalid={!!errors.name} {...register('name')} />
          </Field>

          {/* Sort Order */}
          <Field
            label={t('organization.jobLevel.form.sortOrder')}
            htmlFor="jl_sort_order"
            error={translate(t, errors.sort_order?.message)}
          >
            <Input id="jl_sort_order" type="number" min="0" invalid={!!errors.sort_order} {...register('sort_order')} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
