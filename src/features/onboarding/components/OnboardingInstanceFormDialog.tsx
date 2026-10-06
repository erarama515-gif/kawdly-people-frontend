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
import {
  useCreateOnboardingInstance,
  useUpdateOnboardingInstance,
} from '../api/queries';
import { useOnboardingTemplateList } from '../api/queries';
import type {
  OnboardingInstanceInput,
  OnboardingInstanceStatus,
  OnboardingType,
} from '../api/resource';
import type { OnboardingInstanceWire } from '../api/schema';

/**
 * Add/Edit modal for one OnboardingInstance, built on Dialog + react-hook-form
 * + zod — same library combination as AttendanceFormDialog.
 *
 * Key notes:
 * - Employee picker: native <select> fed by useEmployeeList({ page:1, perPage:100 }),
 *   labelled "First Last — EMP-NUMBER" per project convention.
 * - Template picker: native <select> fed by useOnboardingTemplateList({ perPage:100 }),
 *   labelled by template name.
 * - All form fields are plain strings; toOnboardingInstanceInput() does the
 *   one-time conversion to the wire-shaped OnboardingInstanceInput on submit.
 * - fieldErrorsFrom() maps Laravel 422 errors to RHF setError.
 * - Save button wired via HTML5 form="onboarding-instance-form" attribute.
 */

const REQUIRED = 'common.requiredField';

const INSTANCE_TYPES: readonly OnboardingType[] = ['onboarding', 'offboarding'];
const INSTANCE_STATUSES: readonly OnboardingInstanceStatus[] = ['in_progress', 'completed', 'cancelled'];

const onboardingInstanceFormSchema = z.object({
  employee_id: z.string().min(1, REQUIRED),
  template_id: z.string().min(1, REQUIRED),
  type: z.string().min(1, REQUIRED),
  status: z.string(),
  started_at: z.string().min(1, REQUIRED),
  completed_at: z.string(),
});

type OnboardingInstanceFormValues = z.infer<typeof onboardingInstanceFormSchema>;

function buildDefaultValues(instance: OnboardingInstanceWire | undefined): OnboardingInstanceFormValues {
  if (!instance) {
    return {
      employee_id: '',
      template_id: '',
      type: 'onboarding',
      status: '',
      started_at: new Date().toISOString().slice(0, 10),
      completed_at: '',
    };
  }

  return {
    employee_id: String(instance.employee_id),
    template_id: String(instance.template_id),
    type: instance.type,
    status: instance.status ?? '',
    started_at: instance.started_at.slice(0, 10),
    completed_at: instance.completed_at ? instance.completed_at.slice(0, 10) : '',
  };
}

function toOnboardingInstanceInput(values: OnboardingInstanceFormValues): OnboardingInstanceInput {
  return {
    employee_id: Number(values.employee_id),
    template_id: Number(values.template_id),
    type: values.type as OnboardingType,
    status: values.status ? (values.status as OnboardingInstanceStatus) : null,
    started_at: values.started_at,
    completed_at: values.completed_at || null,
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

export interface OnboardingInstanceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit (or pass `undefined`) to open in "New Instance" mode. */
  instance?: OnboardingInstanceWire | undefined;
}

export function OnboardingInstanceFormDialog({
  open,
  onOpenChange,
  instance,
}: OnboardingInstanceFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = instance !== undefined;

  const createMutation = useCreateOnboardingInstance();
  const updateMutation = useUpdateOnboardingInstance();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  // Employee picker (stable cross-feature hook)
  const { state: employeeState } = useEmployeeList({ page: 1, perPage: 100 });
  const employees = employeeState.data?.data ?? [];

  // Template picker (read-only, all types)
  const { state: templateState } = useOnboardingTemplateList({ perPage: 100 });
  const templates = templateState.data?.data ?? [];

  const resolver = useMemo(() => zodResolver(onboardingInstanceFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<OnboardingInstanceFormValues>({
    resolver,
    defaultValues: buildDefaultValues(instance),
  });

  // Re-seed the form every time the dialog opens.
  useEffect(() => {
    if (open) reset(buildDefaultValues(instance));
  }, [open, instance, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: OnboardingInstanceFormValues) {
    const input = toOnboardingInstanceInput(values);
    const result = isEdit
      ? await updateMutation.mutate({ id: instance.id, ...input })
      : await createMutation.mutate(input);

    if (result) {
      handleOpenChange(false);
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof OnboardingInstanceFormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('onboarding.form.editTitle') : t('onboarding.form.addTitle')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              form="onboarding-instance-form"
              variant="primary"
              isLoading={isPending}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form
          id="onboarding-instance-form"
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

          {/* Employee picker */}
          <Field
            label={t('onboarding.form.employee')}
            htmlFor="employee_id"
            required
            error={translate(t, errors.employee_id?.message)}
          >
            <Select id="employee_id" invalid={!!errors.employee_id} {...register('employee_id')}>
              <option value="">{t('common.selectPlaceholder')}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} — {emp.employee_number}
                </option>
              ))}
            </Select>
          </Field>

          {/* Template picker */}
          <Field
            label={t('onboarding.form.template')}
            htmlFor="template_id"
            required
            error={translate(t, errors.template_id?.message)}
          >
            <Select id="template_id" invalid={!!errors.template_id} {...register('template_id')}>
              <option value="">{t('common.selectPlaceholder')}</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
            </Select>
          </Field>

          {/* Type + Status row */}
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('onboarding.form.type')}
              htmlFor="type"
              required
              error={translate(t, errors.type?.message)}
            >
              <Select id="type" invalid={!!errors.type} {...register('type')}>
                {INSTANCE_TYPES.map((tp) => (
                  <option key={tp} value={tp}>
                    {t(`onboarding.typeOptions.${tp}`)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={t('onboarding.form.status')}
              htmlFor="status"
              error={translate(t, errors.status?.message)}
            >
              <Select id="status" invalid={!!errors.status} {...register('status')}>
                <option value="">{t('common.selectPlaceholder')}</option>
                {INSTANCE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`onboarding.instanceStatusOptions.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Started at + Completed at row */}
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('onboarding.form.startedAt')}
              htmlFor="started_at"
              required
              error={translate(t, errors.started_at?.message)}
            >
              <Input
                id="started_at"
                type="date"
                invalid={!!errors.started_at}
                {...register('started_at')}
              />
            </Field>

            <Field
              label={t('onboarding.form.completedAt')}
              htmlFor="completed_at"
              error={translate(t, errors.completed_at?.message)}
            >
              <Input
                id="completed_at"
                type="date"
                invalid={!!errors.completed_at}
                {...register('completed_at')}
              />
            </Field>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
