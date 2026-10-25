import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/form';
import { userFacingMessage } from '@/lib/api/errors';
import type { ApiError } from '@/lib/api/errors';
import { toast } from '@/components/ui/Toast';
import {
  useDepartmentList,
  useJobGradeList,
  useJobLevelList,
  useCreateJobPosition,
  useUpdateJobPosition,
} from '../api/queries';
import type { JobPositionInput } from '../api/resource';
import type { JobPositionWire } from '../api/schema';

/**
 * Add/Edit modal for one JobPosition record.
 *
 * Confirmed fields from StoreJobPositionRequest.php:
 *   company_id (required FK, attached server-side), department_id (nullable FK),
 *   title (required), title_ar, code, description (textarea),
 *   requirements (textarea), headcount (int min:1), is_active (boolean),
 *   job_grade_id (nullable FK, exists:job_grades,id),
 *   job_level_id (nullable FK, exists:job_levels,id).
 *
 * Department/JobGrade/JobLevel pickers reuse the existing useDepartmentList /
 * useJobGradeList / useJobLevelList hooks from queries.ts.
 * Footer Save is wired via form="job-position-form" attribute.
 */

const REQUIRED = 'common.requiredField';

const jobPositionFormSchema = z.object({
  department_id: z.string(),
  title: z.string().min(1, REQUIRED).max(255),
  title_ar: z.string().max(255),
  code: z.string().max(20),
  description: z.string(),
  requirements: z.string(),
  headcount: z.string(),
  job_grade_id: z.string(),
  job_level_id: z.string(),
  is_active: z.string(),
});

type JobPositionFormValues = z.infer<typeof jobPositionFormSchema>;

function buildDefaultValues(jobPosition: JobPositionWire | undefined): JobPositionFormValues {
  if (!jobPosition) {
    return {
      department_id: '',
      title: '',
      title_ar: '',
      code: '',
      description: '',
      requirements: '',
      headcount: '',
      job_grade_id: '',
      job_level_id: '',
      is_active: 'true',
    };
  }
  return {
    department_id: jobPosition.department_id !== undefined ? String(jobPosition.department_id) : '',
    title: jobPosition.title,
    title_ar: jobPosition.title_ar ?? '',
    code: jobPosition.code ?? '',
    description: jobPosition.description ?? '',
    requirements: jobPosition.requirements ?? '',
    headcount: jobPosition.headcount !== undefined ? String(jobPosition.headcount) : '',
    job_grade_id: jobPosition.job_grade_id !== undefined ? String(jobPosition.job_grade_id) : '',
    job_level_id: jobPosition.job_level_id !== undefined ? String(jobPosition.job_level_id) : '',
    is_active: jobPosition.is_active === false ? 'false' : 'true',
  };
}

function toJobPositionInput(values: JobPositionFormValues): JobPositionInput {
  return {
    department_id: values.department_id ? Number(values.department_id) : null,
    title: values.title.trim(),
    title_ar: values.title_ar.trim() || null,
    code: values.code.trim() || null,
    description: values.description.trim() || null,
    requirements: values.requirements.trim() || null,
    headcount: values.headcount ? Number(values.headcount) : null,
    job_grade_id: values.job_grade_id ? Number(values.job_grade_id) : null,
    job_level_id: values.job_level_id ? Number(values.job_level_id) : null,
    is_active: values.is_active === 'false' ? false : true,
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

export interface JobPositionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobPosition?: JobPositionWire | undefined;
}

export function JobPositionFormDialog({ open, onOpenChange, jobPosition }: JobPositionFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = jobPosition !== undefined;

  const createMutation = useCreateJobPosition();
  const updateMutation = useUpdateJobPosition();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  // Department/JobGrade/JobLevel pickers — reuse the existing list hooks
  const { state: deptState } = useDepartmentList({ page: 1, perPage: 200 });
  const departments = deptState.data?.data ?? [];
  const { state: jobGradeState } = useJobGradeList({ page: 1, perPage: 200 });
  const jobGrades = jobGradeState.data?.data ?? [];
  const { state: jobLevelState } = useJobLevelList({ page: 1, perPage: 200 });
  const jobLevels = jobLevelState.data?.data ?? [];

  const resolver = useMemo(() => zodResolver(jobPositionFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<JobPositionFormValues>({
    resolver,
    defaultValues: buildDefaultValues(jobPosition),
  });

  useEffect(() => {
    if (open) reset(buildDefaultValues(jobPosition));
  }, [open, jobPosition, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: JobPositionFormValues) {
    const input = toJobPositionInput(values);
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: jobPosition.id, ...input });
      } else {
        await createMutation.mutateAsync(input);
      }
    } catch (error) {
      const failure = error as ApiError;
      toast.error(userFacingMessage(failure));
      const fieldErrors = fieldErrorsFrom(failure);
      for (const [field, message] of Object.entries(fieldErrors)) {
        setError(field as keyof JobPositionFormValues, { type: 'server', message });
      }
      return;
    }

    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('organization.jobPosition.editTitle') : t('organization.jobPosition.addTitle')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="job-position-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="job-position-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutationError ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          {/* Department picker (nullable) */}
          <Field
            label={t('organization.jobPosition.form.department')}
            htmlFor="jp_department_id"
            error={translate(t, errors.department_id?.message)}
          >
            <Select id="jp_department_id" invalid={!!errors.department_id} {...register('department_id')}>
              <option value="">{t('organization.jobPosition.form.noDepartment')}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.code ? ` (${d.code})` : ''}
                </option>
              ))}
            </Select>
          </Field>

          {/* Title */}
          <Field
            label={t('organization.jobPosition.form.title')}
            htmlFor="jp_title"
            required
            error={translate(t, errors.title?.message)}
          >
            <Input id="jp_title" invalid={!!errors.title} {...register('title')} />
          </Field>

          {/* Title (Arabic) */}
          <Field
            label={t('organization.jobPosition.form.titleAr')}
            htmlFor="jp_title_ar"
            error={translate(t, errors.title_ar?.message)}
          >
            <Input id="jp_title_ar" dir="rtl" invalid={!!errors.title_ar} {...register('title_ar')} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            {/* Code */}
            <Field
              label={t('organization.jobPosition.form.code')}
              htmlFor="jp_code"
              error={translate(t, errors.code?.message)}
            >
              <Input id="jp_code" maxLength={20} invalid={!!errors.code} {...register('code')} />
            </Field>

            {/* Headcount */}
            <Field
              label={t('organization.jobPosition.form.headcount')}
              htmlFor="jp_headcount"
              error={translate(t, errors.headcount?.message)}
            >
              <Input id="jp_headcount" type="number" min="1" invalid={!!errors.headcount} {...register('headcount')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Job Grade */}
            <Field
              label={t('organization.jobPosition.form.jobGrade')}
              htmlFor="jp_job_grade_id"
              error={translate(t, errors.job_grade_id?.message)}
            >
              <Select id="jp_job_grade_id" invalid={!!errors.job_grade_id} {...register('job_grade_id')}>
                <option value="">{t('organization.jobPosition.form.noJobGrade')}</option>
                {jobGrades.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.name}
                  </option>
                ))}
              </Select>
            </Field>

            {/* Job Level */}
            <Field
              label={t('organization.jobPosition.form.jobLevel')}
              htmlFor="jp_job_level_id"
              error={translate(t, errors.job_level_id?.message)}
            >
              <Select id="jp_job_level_id" invalid={!!errors.job_level_id} {...register('job_level_id')}>
                <option value="">{t('organization.jobPosition.form.noJobLevel')}</option>
                {jobLevels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Description */}
          <Field
            label={t('organization.jobPosition.form.description')}
            htmlFor="jp_description"
            error={translate(t, errors.description?.message)}
          >
            <textarea
              id="jp_description"
              rows={3}
              className="w-full rounded border border-hairline bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-navy/40"
              {...register('description')}
            />
          </Field>

          {/* Requirements */}
          <Field
            label={t('organization.jobPosition.form.requirements')}
            htmlFor="jp_requirements"
            error={translate(t, errors.requirements?.message)}
          >
            <textarea
              id="jp_requirements"
              rows={3}
              className="w-full rounded border border-hairline bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-navy/40"
              {...register('requirements')}
            />
          </Field>

          {/* Active status */}
          <Field
            label={t('organization.jobPosition.form.isActive')}
            htmlFor="jp_is_active"
            error={translate(t, errors.is_active?.message)}
          >
            <Select id="jp_is_active" invalid={!!errors.is_active} {...register('is_active')}>
              <option value="true">{t('organization.jobPosition.form.activeOption')}</option>
              <option value="false">{t('organization.jobPosition.form.inactiveOption')}</option>
            </Select>
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
