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
import { useDepartmentList } from '@/features/organization/api/queries';
import { useCreateJobPosting, useUpdateJobPosting } from '../api/queries';
import type { JobPostingEmploymentType, JobPostingInput } from '../api/resource';
import type { JobPostingWire } from '../api/schema';

/**
 * Add/Edit modal for one job posting, built on `Dialog` + react-hook-form + zod —
 * matching the `EmployeeFormDialog` conventions exactly.
 *
 * Every control is a plain string (native `<select>`/`<input>` values are
 * always strings); validation runs on those strings, and `toJobPostingInput`
 * does the one-time conversion to the wire-shaped `JobPostingInput` on submit.
 *
 * Validation messages are translation keys resolved through `t()` at render time.
 * The footer Save button is wired via the HTML5 `form="job-posting-form"` attribute
 * (lives outside the `<form>` DOM-wise, since Dialog's `footer` prop renders in a
 * separate div).
 */

const REQUIRED = 'common.requiredField';

const EMPLOYMENT_TYPES: readonly JobPostingEmploymentType[] = [
  'full_time', 'part_time', 'contract', 'intern',
];

const jobPostingFormSchema = z.object({
  job_requisition_id: z.string().min(1, REQUIRED),
  title: z.string().trim().min(1, REQUIRED).max(255),
  description: z.string().trim().min(1, REQUIRED),
  requirements: z.string().trim().max(5000),
  skills: z.string().trim(),
  experience_min: z.string(),
  experience_max: z.string(),
  education_level: z.string().trim().max(100),
  salary_min: z.string(),
  salary_max: z.string(),
  location: z.string().trim().max(255),
  employment_type: z.string().min(1, REQUIRED),
  is_internal: z.string(),
  is_published: z.string(),
  published_at: z.string(),
  expires_at: z.string(),
});

type JobPostingFormValues = z.infer<typeof jobPostingFormSchema>;

function buildDefaultValues(posting: JobPostingWire | undefined): JobPostingFormValues {
  if (!posting) {
    return {
      job_requisition_id: '',
      title: '',
      description: '',
      requirements: '',
      skills: '',
      experience_min: '',
      experience_max: '',
      education_level: '',
      salary_min: '',
      salary_max: '',
      location: '',
      employment_type: 'full_time',
      is_internal: 'false',
      is_published: 'false',
      published_at: '',
      expires_at: '',
    };
  }

  return {
    job_requisition_id: String(posting.job_requisition_id),
    title: posting.title,
    description: posting.description,
    requirements: posting.requirements ?? '',
    skills: posting.skills.join(', '),
    experience_min: posting.experience_min !== undefined ? String(posting.experience_min) : '',
    experience_max: posting.experience_max !== undefined ? String(posting.experience_max) : '',
    education_level: posting.education_level ?? '',
    salary_min: posting.salary_min !== undefined ? String(posting.salary_min) : '',
    salary_max: posting.salary_max !== undefined ? String(posting.salary_max) : '',
    location: posting.location ?? '',
    employment_type: posting.employment_type,
    is_internal: posting.is_internal ? 'true' : 'false',
    is_published: posting.is_published ? 'true' : 'false',
    published_at: posting.published_at ? posting.published_at.slice(0, 10) : '',
    expires_at: posting.expires_at ? posting.expires_at.slice(0, 10) : '',
  };
}

function toJobPostingInput(values: JobPostingFormValues): JobPostingInput {
  return {
    job_requisition_id: Number(values.job_requisition_id),
    title: values.title.trim(),
    description: values.description.trim(),
    requirements: values.requirements.trim() || null,
    skills: values.skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    experience_min: values.experience_min ? Number(values.experience_min) : null,
    experience_max: values.experience_max ? Number(values.experience_max) : null,
    education_level: values.education_level.trim() || null,
    salary_min: values.salary_min ? Number(values.salary_min) : null,
    salary_max: values.salary_max ? Number(values.salary_max) : null,
    location: values.location.trim() || null,
    employment_type: values.employment_type as JobPostingEmploymentType,
    is_internal: values.is_internal === 'true',
    is_published: values.is_published === 'true',
    published_at: values.published_at || null,
    expires_at: values.expires_at || null,
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

export interface JobPostingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit (or pass `undefined`) to open in "Add Job Posting" mode. */
  posting?: JobPostingWire | undefined;
}

export function JobPostingFormDialog({ open, onOpenChange, posting }: JobPostingFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = posting !== undefined;

  const createMutation = useCreateJobPosting();
  const updateMutation = useUpdateJobPosting();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  const resolver = useMemo(() => zodResolver(jobPostingFormSchema), []);

  const { state: departmentState } = useDepartmentList({ page: 1, perPage: 200 });
  const departments = departmentState.data?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<JobPostingFormValues>({
    resolver,
    defaultValues: buildDefaultValues(posting),
  });

  // Re-seed the form every time the dialog opens.
  useEffect(() => {
    if (open) reset(buildDefaultValues(posting));
  }, [open, posting, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: JobPostingFormValues) {
    const input = toJobPostingInput(values);
    const result = isEdit
      ? await updateMutation.mutate({ id: posting.id, ...input })
      : await createMutation.mutate(input);

    if (result) {
      handleOpenChange(false);
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof JobPostingFormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('recruitment.form.editJobPosting') : t('recruitment.form.addJobPosting')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="job-posting-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="job-posting-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
            label={t('recruitment.form.title')}
            htmlFor="jp_title"
            required
            error={translate(t, errors.title?.message)}
          >
            <Input id="jp_title" invalid={!!errors.title} {...register('title')} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            {/* Employment Type */}
            <Field
              label={t('recruitment.form.employmentType')}
              htmlFor="jp_employment_type"
              required
              error={translate(t, errors.employment_type?.message)}
            >
              <Select id="jp_employment_type" invalid={!!errors.employment_type} {...register('employment_type')}>
                {EMPLOYMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`recruitment.form.employmentTypeOptions.${type}`)}
                  </option>
                ))}
              </Select>
            </Field>

            {/* Department (display only — drives the Job Requisition context) */}
            <Field
              label={t('recruitment.form.department')}
              htmlFor="jp_department"
              error={translate(t, errors.job_requisition_id?.message)}
            >
              <Select id="jp_department" invalid={!!errors.job_requisition_id} {...register('job_requisition_id')}>
                <option value="">{t('common.selectPlaceholder')}</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Location */}
          <Field
            label={t('recruitment.form.location')}
            htmlFor="jp_location"
            error={translate(t, errors.location?.message)}
          >
            <Input id="jp_location" invalid={!!errors.location} {...register('location')} />
          </Field>

          {/* Description */}
          <Field
            label={t('recruitment.form.description')}
            htmlFor="jp_description"
            required
            error={translate(t, errors.description?.message)}
          >
            <textarea
              id="jp_description"
              rows={4}
              className={[
                'w-full rounded-[3px] border px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint',
                'focus:outline-none focus:ring-1 focus:ring-navy/40',
                errors.description ? 'border-coral' : 'border-hairline',
              ].join(' ')}
              {...register('description')}
            />
          </Field>

          {/* Requirements */}
          <Field
            label={t('recruitment.form.requirements')}
            htmlFor="jp_requirements"
            error={translate(t, errors.requirements?.message)}
          >
            <textarea
              id="jp_requirements"
              rows={3}
              className={[
                'w-full rounded-[3px] border px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint',
                'focus:outline-none focus:ring-1 focus:ring-navy/40',
                errors.requirements ? 'border-coral' : 'border-hairline',
              ].join(' ')}
              {...register('requirements')}
            />
          </Field>

          {/* Skills (comma-separated) */}
          <Field
            label={t('recruitment.form.skills')}
            htmlFor="jp_skills"
            error={translate(t, errors.skills?.message)}
          >
            <Input
              id="jp_skills"
              placeholder={t('recruitment.form.skillsPlaceholder')}
              invalid={!!errors.skills}
              {...register('skills')}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            {/* Experience Min */}
            <Field
              label={t('recruitment.form.experienceMin')}
              htmlFor="jp_experience_min"
              error={translate(t, errors.experience_min?.message)}
            >
              <Input
                id="jp_experience_min"
                type="number"
                min={0}
                invalid={!!errors.experience_min}
                {...register('experience_min')}
              />
            </Field>

            {/* Experience Max */}
            <Field
              label={t('recruitment.form.experienceMax')}
              htmlFor="jp_experience_max"
              error={translate(t, errors.experience_max?.message)}
            >
              <Input
                id="jp_experience_max"
                type="number"
                min={0}
                invalid={!!errors.experience_max}
                {...register('experience_max')}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Salary Min */}
            <Field
              label={t('recruitment.form.salaryMin')}
              htmlFor="jp_salary_min"
              error={translate(t, errors.salary_min?.message)}
            >
              <Input
                id="jp_salary_min"
                type="number"
                min={0}
                invalid={!!errors.salary_min}
                {...register('salary_min')}
              />
            </Field>

            {/* Salary Max */}
            <Field
              label={t('recruitment.form.salaryMax')}
              htmlFor="jp_salary_max"
              error={translate(t, errors.salary_max?.message)}
            >
              <Input
                id="jp_salary_max"
                type="number"
                min={0}
                invalid={!!errors.salary_max}
                {...register('salary_max')}
              />
            </Field>
          </div>

          {/* Education Level */}
          <Field
            label={t('recruitment.form.educationLevel')}
            htmlFor="jp_education_level"
            error={translate(t, errors.education_level?.message)}
          >
            <Input id="jp_education_level" invalid={!!errors.education_level} {...register('education_level')} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            {/* Published At */}
            <Field
              label={t('recruitment.form.publishedAt')}
              htmlFor="jp_published_at"
              error={translate(t, errors.published_at?.message)}
            >
              <Input
                id="jp_published_at"
                type="date"
                invalid={!!errors.published_at}
                {...register('published_at')}
              />
            </Field>

            {/* Expires At */}
            <Field
              label={t('recruitment.form.expiresAt')}
              htmlFor="jp_expires_at"
              error={translate(t, errors.expires_at?.message)}
            >
              <Input
                id="jp_expires_at"
                type="date"
                invalid={!!errors.expires_at}
                {...register('expires_at')}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Is Internal */}
            <Field
              label={t('recruitment.form.isInternal')}
              htmlFor="jp_is_internal"
              error={translate(t, errors.is_internal?.message)}
            >
              <Select id="jp_is_internal" invalid={!!errors.is_internal} {...register('is_internal')}>
                <option value="false">{t('recruitment.form.no')}</option>
                <option value="true">{t('recruitment.form.yes')}</option>
              </Select>
            </Field>

            {/* Is Published */}
            <Field
              label={t('recruitment.form.isPublished')}
              htmlFor="jp_is_published"
              error={translate(t, errors.is_published?.message)}
            >
              <Select id="jp_is_published" invalid={!!errors.is_published} {...register('is_published')}>
                <option value="false">{t('recruitment.form.no')}</option>
                <option value="true">{t('recruitment.form.yes')}</option>
              </Select>
            </Field>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
