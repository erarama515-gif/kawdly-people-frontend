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
import { useEmployeeList } from '@/features/employees/api/queries';
import { useCreatePerformanceReview, useUpdatePerformanceReview } from '../api/queries';
import type {
  PerformanceReviewInput,
  PerformanceReviewStatus,
  PerformanceReviewType,
} from '../api/resource';
import type { PerformanceReviewWire } from '../api/schema';

/**
 * Add/Edit modal for one PerformanceReview.
 *
 * All form values are plain strings. `toPerformanceReviewInput()` converts
 * them to the wire-shaped `PerformanceReviewInput` on submit.
 *
 * `employee_id` and `reviewer_id` pickers use `useEmployeeList({page:1,perPage:100})`
 * — exact same pattern as `AttendanceFormDialog` and `SuccessionPlanFormDialog`.
 * Display: "First Last — EMP-NUMBER".
 *
 * `cycle_id` is passed in as a prop (the currently-selected cycle's ID) when
 * adding a new review. For edit, it is read from the existing record.
 *
 * Save button wired via HTML5 `form="performance-review-form"`.
 */

const REQUIRED = 'common.requiredField';

const REVIEW_TYPE_OPTIONS: readonly PerformanceReviewType[] = [
  'self',
  'manager',
  'peer',
  'direct_report',
];

const REVIEW_STATUS_OPTIONS: readonly PerformanceReviewStatus[] = [
  'pending',
  'in_progress',
  'submitted',
  'acknowledged',
];

const performanceReviewFormSchema = z.object({
  cycle_id: z.string().min(1, REQUIRED),
  employee_id: z.string().min(1, REQUIRED),
  reviewer_id: z.string().min(1, REQUIRED),
  review_type: z.string().min(1, REQUIRED),
  overall_rating: z.string(),
  strengths: z.string(),
  improvements: z.string(),
  comments: z.string(),
  status: z.string(),
  submitted_at: z.string(),
});

type PerformanceReviewFormValues = z.infer<typeof performanceReviewFormSchema>;

function buildDefaultValues(
  review: PerformanceReviewWire | undefined,
  defaultCycleId: number | undefined,
): PerformanceReviewFormValues {
  if (!review) {
    return {
      cycle_id: defaultCycleId !== undefined ? String(defaultCycleId) : '',
      employee_id: '',
      reviewer_id: '',
      review_type: 'self',
      overall_rating: '',
      strengths: '',
      improvements: '',
      comments: '',
      status: 'pending',
      submitted_at: '',
    };
  }
  return {
    cycle_id: String(review.cycle_id),
    employee_id: String(review.employee_id),
    reviewer_id: String(review.reviewer_id),
    review_type: review.review_type,
    overall_rating: review.overall_rating !== undefined ? String(review.overall_rating) : '',
    strengths: review.strengths ?? '',
    improvements: review.improvements ?? '',
    comments: review.comments ?? '',
    status: review.status ?? 'pending',
    submitted_at: review.submitted_at ? review.submitted_at.slice(0, 10) : '',
  };
}

function toPerformanceReviewInput(values: PerformanceReviewFormValues): PerformanceReviewInput {
  return {
    cycle_id: Number(values.cycle_id),
    employee_id: Number(values.employee_id),
    reviewer_id: Number(values.reviewer_id),
    review_type: values.review_type as PerformanceReviewType,
    overall_rating: values.overall_rating.trim() ? Number(values.overall_rating) : null,
    strengths: values.strengths.trim() || null,
    improvements: values.improvements.trim() || null,
    comments: values.comments.trim() || null,
    status: (values.status as PerformanceReviewStatus) || null,
    submitted_at: values.submitted_at.trim() || null,
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

export interface PerformanceReviewFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit (or pass `undefined`) to open in "Add Review" mode. */
  review?: PerformanceReviewWire | undefined;
  /** Pre-fill cycle_id when adding a new review under a specific cycle. */
  defaultCycleId?: number | undefined;
}

export function PerformanceReviewFormDialog({
  open,
  onOpenChange,
  review,
  defaultCycleId,
}: PerformanceReviewFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = review !== undefined;

  const createMutation = useCreatePerformanceReview();
  const updateMutation = useUpdatePerformanceReview();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  // Employee pickers: first 100 employees — same pattern as AttendanceFormDialog.
  const { state: employeeState } = useEmployeeList({ page: 1, perPage: 100 });
  const employees = employeeState.data?.data ?? [];

  const resolver = useMemo(() => zodResolver(performanceReviewFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<PerformanceReviewFormValues>({
    resolver,
    defaultValues: buildDefaultValues(review, defaultCycleId),
  });

  // Re-seed the form every time the dialog opens.
  useEffect(() => {
    if (open) reset(buildDefaultValues(review, defaultCycleId));
  }, [open, review, defaultCycleId, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: PerformanceReviewFormValues) {
    const input = toPerformanceReviewInput(values);
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: review.id, ...input });
      } else {
        await createMutation.mutateAsync(input);
      }
    } catch (error) {
      const failure = error as ApiError;
      toast.error(userFacingMessage(failure));
      const fieldErrors = fieldErrorsFrom(failure);
      for (const [field, message] of Object.entries(fieldErrors)) {
        setError(field as keyof PerformanceReviewFormValues, { type: 'server', message });
      }
      return;
    }

    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('performance.form.editReviewTitle') : t('performance.form.addReviewTitle')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="performance-review-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="performance-review-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutationError ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          {/* Employee picker */}
          <Field
            label={t('performance.form.employee')}
            htmlFor="review_employee_id"
            required
            error={translate(t, errors.employee_id?.message)}
          >
            <Select id="review_employee_id" invalid={!!errors.employee_id} {...register('employee_id')}>
              <option value="">{t('common.selectPlaceholder')}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} — {emp.employee_number}
                </option>
              ))}
            </Select>
          </Field>

          {/* Reviewer picker */}
          <Field
            label={t('performance.form.reviewer')}
            htmlFor="review_reviewer_id"
            required
            error={translate(t, errors.reviewer_id?.message)}
          >
            <Select id="review_reviewer_id" invalid={!!errors.reviewer_id} {...register('reviewer_id')}>
              <option value="">{t('common.selectPlaceholder')}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} — {emp.employee_number}
                </option>
              ))}
            </Select>
          </Field>

          {/* Review type + Status */}
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('performance.form.reviewType')}
              htmlFor="review_type"
              required
              error={translate(t, errors.review_type?.message)}
            >
              <Select id="review_type" invalid={!!errors.review_type} {...register('review_type')}>
                {REVIEW_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {t(`performance.reviewTypeOptions.${opt}`)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={t('performance.form.reviewStatus')}
              htmlFor="review_status"
              error={translate(t, errors.status?.message)}
            >
              <Select id="review_status" invalid={!!errors.status} {...register('status')}>
                <option value="">{t('common.selectPlaceholder')}</option>
                {REVIEW_STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {t(`performance.reviewStatusOptions.${opt}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Overall rating + Submitted at */}
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('performance.form.overallRating')}
              htmlFor="overall_rating"
              error={translate(t, errors.overall_rating?.message)}
            >
              <Input
                id="overall_rating"
                type="number"
                step="0.1"
                min="0"
                max="999.9"
                invalid={!!errors.overall_rating}
                {...register('overall_rating')}
              />
            </Field>

            <Field
              label={t('performance.form.submittedAt')}
              htmlFor="submitted_at"
              error={translate(t, errors.submitted_at?.message)}
            >
              <Input
                id="submitted_at"
                type="date"
                invalid={!!errors.submitted_at}
                {...register('submitted_at')}
              />
            </Field>
          </div>

          {/* Strengths */}
          <Field
            label={t('performance.form.strengths')}
            htmlFor="strengths"
            error={translate(t, errors.strengths?.message)}
          >
            <Input id="strengths" invalid={!!errors.strengths} {...register('strengths')} />
          </Field>

          {/* Improvements */}
          <Field
            label={t('performance.form.improvements')}
            htmlFor="improvements"
            error={translate(t, errors.improvements?.message)}
          >
            <Input id="improvements" invalid={!!errors.improvements} {...register('improvements')} />
          </Field>

          {/* Comments */}
          <Field
            label={t('performance.form.comments')}
            htmlFor="comments"
            error={translate(t, errors.comments?.message)}
          >
            <Input id="comments" invalid={!!errors.comments} {...register('comments')} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
