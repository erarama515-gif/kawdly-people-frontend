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
import { useEmployeeList } from '@/features/employees/api/queries';
import { useCreateSuccessionPlan, useUpdateSuccessionPlan } from '../api/queries';
import type { SuccessionPlanInput, SuccessionReadiness } from '../api/resource';
import type { SuccessionPlanWire } from '../api/schema';

/**
 * Add/Edit modal for one succession plan row.
 *
 * Key schema notes vs. old mock:
 *  - ONE successor per row (not an array) — `successor_id` is a required FK.
 *  - `current_holder_id` is nullable (the position may be vacant).
 *  - `readiness` is the real backend enum: ready_now | ready_1_year | ready_2_years | development_needed.
 *  - `job_position_id` is a required int FK — shown as a number input for now
 *    (a dedicated job-position picker is a follow-up).
 *  - `updated_by` hardcoded to 1 as placeholder, like Contracts' `created_by: 1`.
 *
 * Employee pickers use `useEmployeeList({ page:1, perPage:100 })` — exact same
 * pattern as `AttendanceFormDialog`.
 *
 * Save button wired via HTML5 `form="succession-plan-form"` (lives in footer, outside <form>).
 */

const REQUIRED = 'common.requiredField';

const READINESS_OPTIONS: readonly SuccessionReadiness[] = [
  'ready_now',
  'ready_1_year',
  'ready_2_years',
  'development_needed',
];

const successionPlanFormSchema = z.object({
  job_position_id: z.string().min(1, REQUIRED),
  current_holder_id: z.string(),
  successor_id: z.string().min(1, REQUIRED),
  readiness: z.string().min(1, REQUIRED),
  readiness_score: z.string(),
  development_plan: z.string(),
  notes: z.string(),
});

type SuccessionPlanFormValues = z.infer<typeof successionPlanFormSchema>;

function buildDefaultValues(plan: SuccessionPlanWire | undefined): SuccessionPlanFormValues {
  if (!plan) {
    return {
      job_position_id: '',
      current_holder_id: '',
      successor_id: '',
      readiness: 'ready_now',
      readiness_score: '',
      development_plan: '',
      notes: '',
    };
  }
  return {
    job_position_id: String(plan.job_position_id),
    current_holder_id: plan.current_holder_id !== undefined ? String(plan.current_holder_id) : '',
    successor_id: String(plan.successor_id),
    readiness: plan.readiness,
    readiness_score: plan.readiness_score !== undefined ? String(plan.readiness_score) : '',
    development_plan: plan.development_plan ?? '',
    notes: plan.notes ?? '',
  };
}

function toSuccessionPlanInput(values: SuccessionPlanFormValues): SuccessionPlanInput {
  return {
    job_position_id: Number(values.job_position_id),
    current_holder_id: values.current_holder_id.trim() ? Number(values.current_holder_id) : null,
    successor_id: Number(values.successor_id),
    readiness: values.readiness as SuccessionReadiness,
    readiness_score: values.readiness_score.trim() ? Number(values.readiness_score) : null,
    development_plan: values.development_plan.trim() || null,
    notes: values.notes.trim() || null,
    // `updated_by` required by backend; placeholder until auth is wired.
    updated_by: 1,
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

export interface SuccessionPlanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit (or pass `undefined`) to open in "New Plan" mode. */
  plan?: SuccessionPlanWire | undefined;
}

export function SuccessionPlanFormDialog({ open, onOpenChange, plan }: SuccessionPlanFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = plan !== undefined;

  const createMutation = useCreateSuccessionPlan();
  const updateMutation = useUpdateSuccessionPlan();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  // Employee pickers: first 100, same pattern as AttendanceFormDialog.
  const { state: employeeState } = useEmployeeList({ page: 1, perPage: 100 });
  const employees = employeeState.data?.data ?? [];

  const resolver = useMemo(() => zodResolver(successionPlanFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<SuccessionPlanFormValues>({
    resolver,
    defaultValues: buildDefaultValues(plan),
  });

  // Re-seed the form every time the dialog opens.
  useEffect(() => {
    if (open) reset(buildDefaultValues(plan));
  }, [open, plan, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: SuccessionPlanFormValues) {
    const input = toSuccessionPlanInput(values);
    const result = isEdit
      ? await updateMutation.mutate({ id: plan.id, ...input })
      : await createMutation.mutate(input);

    if (result) {
      handleOpenChange(false);
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof SuccessionPlanFormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('career.editPlan') : t('career.newPlan')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="succession-plan-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="succession-plan-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutationError ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          {/* Job Position ID — numeric input; a dedicated picker is a follow-up */}
          <Field
            label={t('career.form.jobPositionId')}
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

          {/* Current holder picker (nullable — position may be vacant) */}
          <Field
            label={t('career.form.currentHolder')}
            htmlFor="current_holder_id"
            error={translate(t, errors.current_holder_id?.message)}
          >
            <Select id="current_holder_id" invalid={!!errors.current_holder_id} {...register('current_holder_id')}>
              <option value="">{t('career.form.vacant')}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} — {emp.employee_number}
                </option>
              ))}
            </Select>
          </Field>

          {/* Successor picker (required) */}
          <Field
            label={t('career.form.successor')}
            htmlFor="successor_id"
            required
            error={translate(t, errors.successor_id?.message)}
          >
            <Select id="successor_id" invalid={!!errors.successor_id} {...register('successor_id')}>
              <option value="">{t('common.selectPlaceholder')}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} — {emp.employee_number}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            {/* Readiness */}
            <Field
              label={t('career.form.readiness')}
              htmlFor="readiness"
              required
              error={translate(t, errors.readiness?.message)}
            >
              <Select id="readiness" invalid={!!errors.readiness} {...register('readiness')}>
                {READINESS_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`career.readinessOptions.${r}`)}
                  </option>
                ))}
              </Select>
            </Field>

            {/* Readiness score */}
            <Field
              label={t('career.form.readinessScore')}
              htmlFor="readiness_score"
              error={translate(t, errors.readiness_score?.message)}
            >
              <Input
                id="readiness_score"
                type="number"
                min="0"
                max="100"
                invalid={!!errors.readiness_score}
                {...register('readiness_score')}
              />
            </Field>
          </div>

          {/* Development plan */}
          <Field
            label={t('career.form.developmentPlan')}
            htmlFor="development_plan"
            error={translate(t, errors.development_plan?.message)}
          >
            <Input id="development_plan" invalid={!!errors.development_plan} {...register('development_plan')} />
          </Field>

          {/* Notes */}
          <Field
            label={t('career.form.notes')}
            htmlFor="notes"
            error={translate(t, errors.notes?.message)}
          >
            <Input id="notes" invalid={!!errors.notes} {...register('notes')} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
