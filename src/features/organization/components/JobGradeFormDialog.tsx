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
import { useCreateJobGrade, useUpdateJobGrade } from '../api/queries';
import type { JobGradeInput } from '../api/resource';
import type { JobGradeWire } from '../api/schema';

/**
 * Add/Edit modal for one JobGrade record.
 *
 * Confirmed fields from StoreJobGradeRequest.php:
 *   company_id (required FK, attached server-side), name (required, max:100),
 *   code (nullable, max:20), min_salary/mid_salary/max_salary (nullable
 *   integer, min:0), sort_order (nullable integer).
 *
 * Footer Save is wired via form="job-grade-form" attribute.
 */

const REQUIRED = 'common.requiredField';

const jobGradeFormSchema = z.object({
  name: z.string().min(1, REQUIRED).max(100),
  code: z.string().max(20),
  min_salary: z.string(),
  mid_salary: z.string(),
  max_salary: z.string(),
  sort_order: z.string(),
});

type JobGradeFormValues = z.infer<typeof jobGradeFormSchema>;

function buildDefaultValues(jobGrade: JobGradeWire | undefined): JobGradeFormValues {
  if (!jobGrade) {
    return {
      name: '',
      code: '',
      min_salary: '',
      mid_salary: '',
      max_salary: '',
      sort_order: '',
    };
  }
  return {
    name: jobGrade.name,
    code: jobGrade.code ?? '',
    min_salary: jobGrade.min_salary !== undefined ? String(jobGrade.min_salary) : '',
    mid_salary: jobGrade.mid_salary !== undefined ? String(jobGrade.mid_salary) : '',
    max_salary: jobGrade.max_salary !== undefined ? String(jobGrade.max_salary) : '',
    sort_order: jobGrade.sort_order !== undefined ? String(jobGrade.sort_order) : '',
  };
}

function toJobGradeInput(values: JobGradeFormValues): JobGradeInput {
  return {
    name: values.name.trim(),
    code: values.code.trim() || null,
    min_salary: values.min_salary ? Number(values.min_salary) : null,
    mid_salary: values.mid_salary ? Number(values.mid_salary) : null,
    max_salary: values.max_salary ? Number(values.max_salary) : null,
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

export interface JobGradeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobGrade?: JobGradeWire | undefined;
}

export function JobGradeFormDialog({ open, onOpenChange, jobGrade }: JobGradeFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = jobGrade !== undefined;

  const createMutation = useCreateJobGrade();
  const updateMutation = useUpdateJobGrade();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  const resolver = useMemo(() => zodResolver(jobGradeFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<JobGradeFormValues>({
    resolver,
    defaultValues: buildDefaultValues(jobGrade),
  });

  useEffect(() => {
    if (open) reset(buildDefaultValues(jobGrade));
  }, [open, jobGrade, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: JobGradeFormValues) {
    const input = toJobGradeInput(values);
    const result = isEdit
      ? await updateMutation.mutate({ id: jobGrade.id, ...input })
      : await createMutation.mutate(input);

    if (result) {
      handleOpenChange(false);
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof JobGradeFormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('organization.jobGrade.editTitle') : t('organization.jobGrade.addTitle')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="job-grade-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="job-grade-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutationError ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          {/* Name */}
          <Field
            label={t('organization.jobGrade.form.name')}
            htmlFor="jg_name"
            required
            error={translate(t, errors.name?.message)}
          >
            <Input id="jg_name" maxLength={100} invalid={!!errors.name} {...register('name')} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            {/* Code */}
            <Field
              label={t('organization.jobGrade.form.code')}
              htmlFor="jg_code"
              error={translate(t, errors.code?.message)}
            >
              <Input id="jg_code" maxLength={20} invalid={!!errors.code} {...register('code')} />
            </Field>

            {/* Sort Order */}
            <Field
              label={t('organization.jobGrade.form.sortOrder')}
              htmlFor="jg_sort_order"
              error={translate(t, errors.sort_order?.message)}
            >
              <Input id="jg_sort_order" type="number" min="0" invalid={!!errors.sort_order} {...register('sort_order')} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Min Salary */}
            <Field
              label={t('organization.jobGrade.form.minSalary')}
              htmlFor="jg_min_salary"
              error={translate(t, errors.min_salary?.message)}
            >
              <Input id="jg_min_salary" type="number" min="0" invalid={!!errors.min_salary} {...register('min_salary')} />
            </Field>

            {/* Mid Salary */}
            <Field
              label={t('organization.jobGrade.form.midSalary')}
              htmlFor="jg_mid_salary"
              error={translate(t, errors.mid_salary?.message)}
            >
              <Input id="jg_mid_salary" type="number" min="0" invalid={!!errors.mid_salary} {...register('mid_salary')} />
            </Field>

            {/* Max Salary */}
            <Field
              label={t('organization.jobGrade.form.maxSalary')}
              htmlFor="jg_max_salary"
              error={translate(t, errors.max_salary?.message)}
            >
              <Input id="jg_max_salary" type="number" min="0" invalid={!!errors.max_salary} {...register('max_salary')} />
            </Field>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
