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
import { useCreatePerformanceCycle, useUpdatePerformanceCycle } from '../api/queries';
import type { PerformanceCycleInput, PerformanceCycleStatus, PerformanceCycleType } from '../api/resource';
import type { PerformanceCycleWire } from '../api/schema';

/**
 * Add/Edit modal for one PerformanceCycle.
 *
 * All form values are plain strings (native <select>/<input> convention).
 * `toPerformanceCycleInput()` converts them to the wire-shaped
 * `PerformanceCycleInput` on submit.
 *
 * Save button wired via HTML5 `form="performance-cycle-form"` — lives in the
 * dialog footer, outside the <form> element.
 */

const REQUIRED = 'common.requiredField';

const CYCLE_TYPE_OPTIONS: readonly PerformanceCycleType[] = [
  'quarterly',
  'semi_annual',
  'annual',
];

const CYCLE_STATUS_OPTIONS: readonly PerformanceCycleStatus[] = [
  'draft',
  'active',
  'in_review',
  'completed',
];

const performanceCycleFormSchema = z.object({
  name: z.string().min(1, REQUIRED).max(255),
  type: z.string().min(1, REQUIRED),
  start_date: z.string().min(1, REQUIRED),
  end_date: z.string().min(1, REQUIRED),
  self_review_deadline: z.string().min(1, REQUIRED),
  manager_review_deadline: z.string().min(1, REQUIRED),
  status: z.string(),
});

type PerformanceCycleFormValues = z.infer<typeof performanceCycleFormSchema>;

function buildDefaultValues(cycle: PerformanceCycleWire | undefined): PerformanceCycleFormValues {
  if (!cycle) {
    const today = new Date().toISOString().slice(0, 10);
    return {
      name: '',
      type: 'annual',
      start_date: today,
      end_date: today,
      self_review_deadline: today,
      manager_review_deadline: today,
      status: 'draft',
    };
  }
  return {
    name: cycle.name,
    type: cycle.type,
    start_date: cycle.start_date.slice(0, 10),
    end_date: cycle.end_date.slice(0, 10),
    self_review_deadline: cycle.self_review_deadline.slice(0, 10),
    manager_review_deadline: cycle.manager_review_deadline.slice(0, 10),
    status: cycle.status ?? 'draft',
  };
}

function toPerformanceCycleInput(values: PerformanceCycleFormValues): PerformanceCycleInput {
  return {
    name: values.name.trim(),
    type: values.type as PerformanceCycleType,
    start_date: values.start_date,
    end_date: values.end_date,
    self_review_deadline: values.self_review_deadline,
    manager_review_deadline: values.manager_review_deadline,
    status: (values.status as PerformanceCycleStatus) || null,
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

export interface PerformanceCycleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit (or pass `undefined`) to open in "Add Cycle" mode. */
  cycle?: PerformanceCycleWire | undefined;
}

export function PerformanceCycleFormDialog({ open, onOpenChange, cycle }: PerformanceCycleFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = cycle !== undefined;

  const createMutation = useCreatePerformanceCycle();
  const updateMutation = useUpdatePerformanceCycle();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  const resolver = useMemo(() => zodResolver(performanceCycleFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<PerformanceCycleFormValues>({
    resolver,
    defaultValues: buildDefaultValues(cycle),
  });

  // Re-seed the form every time the dialog opens.
  useEffect(() => {
    if (open) reset(buildDefaultValues(cycle));
  }, [open, cycle, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: PerformanceCycleFormValues) {
    const input = toPerformanceCycleInput(values);
    const result = isEdit
      ? await updateMutation.mutate({ id: cycle.id, ...input })
      : await createMutation.mutate(input);

    if (result) {
      handleOpenChange(false);
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof PerformanceCycleFormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('performance.form.editCycleTitle') : t('performance.form.addCycleTitle')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="performance-cycle-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="performance-cycle-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutationError ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          {/* Name */}
          <Field
            label={t('performance.form.cycleName')}
            htmlFor="cycle_name"
            required
            error={translate(t, errors.name?.message)}
          >
            <Input id="cycle_name" invalid={!!errors.name} {...register('name')} />
          </Field>

          {/* Type */}
          <Field
            label={t('performance.form.cycleType')}
            htmlFor="cycle_type"
            required
            error={translate(t, errors.type?.message)}
          >
            <Select id="cycle_type" invalid={!!errors.type} {...register('type')}>
              {CYCLE_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {t(`performance.cycleTypeOptions.${opt}`)}
                </option>
              ))}
            </Select>
          </Field>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('performance.form.startDate')}
              htmlFor="cycle_start_date"
              required
              error={translate(t, errors.start_date?.message)}
            >
              <Input id="cycle_start_date" type="date" invalid={!!errors.start_date} {...register('start_date')} />
            </Field>
            <Field
              label={t('performance.form.endDate')}
              htmlFor="cycle_end_date"
              required
              error={translate(t, errors.end_date?.message)}
            >
              <Input id="cycle_end_date" type="date" invalid={!!errors.end_date} {...register('end_date')} />
            </Field>
          </div>

          {/* Deadlines */}
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('performance.form.selfReviewDeadline')}
              htmlFor="self_review_deadline"
              required
              error={translate(t, errors.self_review_deadline?.message)}
            >
              <Input
                id="self_review_deadline"
                type="date"
                invalid={!!errors.self_review_deadline}
                {...register('self_review_deadline')}
              />
            </Field>
            <Field
              label={t('performance.form.managerReviewDeadline')}
              htmlFor="manager_review_deadline"
              required
              error={translate(t, errors.manager_review_deadline?.message)}
            >
              <Input
                id="manager_review_deadline"
                type="date"
                invalid={!!errors.manager_review_deadline}
                {...register('manager_review_deadline')}
              />
            </Field>
          </div>

          {/* Status */}
          <Field
            label={t('performance.form.cycleStatus')}
            htmlFor="cycle_status"
            error={translate(t, errors.status?.message)}
          >
            <Select id="cycle_status" invalid={!!errors.status} {...register('status')}>
              <option value="">{t('common.selectPlaceholder')}</option>
              {CYCLE_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {t(`performance.cycleStatusOptions.${opt}`)}
                </option>
              ))}
            </Select>
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
