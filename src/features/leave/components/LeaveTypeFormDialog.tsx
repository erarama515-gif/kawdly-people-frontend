import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/form';
import { toast } from '@/components/ui/Toast';
import { userFacingMessage } from '@/lib/api/errors';
import type { ApiError } from '@/lib/api/errors';
import {
  useCreateLeaveType,
  useUpdateLeaveType,
} from '../api/admin';
import type { LeaveTypeAdminWire } from '../api/admin';

const REQUIRED = 'common.requiredField';

const formSchema = z.object({
  name: z.string().trim().min(1, REQUIRED).max(255),
  code: z.string().trim().max(20),
  is_paid: z.boolean(),
  requires_attachment: z.boolean(),
  allows_half_day: z.boolean(),
  max_days_per_request: z.string().refine((value) => {
    if (!value) return true;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 1;
  }, 'leave.admin.types.validation.maxDays'),
  min_days_per_request: z.string().refine((value) => {
    if (!value) return true;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0;
  }, 'leave.admin.types.validation.minDays'),
  gender_restriction: z.string(),
  color: z.string(),
  sort_order: z.string().refine((value) => {
    if (!value) return true;
    return Number.isInteger(Number(value));
  }, 'leave.admin.types.validation.sortOrder'),
  is_active: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

function defaultsFor(leaveType: LeaveTypeAdminWire | undefined): FormValues {
  return {
    name: leaveType?.name ?? '',
    code: leaveType?.code ?? '',
    is_paid: leaveType?.is_paid ?? true,
    requires_attachment: leaveType?.requires_attachment ?? false,
    allows_half_day: leaveType?.allows_half_day ?? false,
    max_days_per_request:
      leaveType?.max_days_per_request !== undefined ? String(leaveType.max_days_per_request) : '',
    min_days_per_request: leaveType?.min_days_per_request
      ? String(Number(leaveType.min_days_per_request))
      : '0.5',
    gender_restriction: leaveType?.gender_restriction ?? '',
    color: leaveType?.color ?? '#4CAF50',
    sort_order: leaveType?.sort_order !== undefined ? String(leaveType.sort_order) : '0',
    is_active: leaveType?.is_active ?? true,
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

export interface LeaveTypeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaveType?: LeaveTypeAdminWire | undefined;
}

export function LeaveTypeFormDialog({ open, onOpenChange, leaveType }: LeaveTypeFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = leaveType !== undefined;

  const createMutation = useCreateLeaveType();
  const updateMutation = useUpdateLeaveType();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;
  const resolver = useMemo(() => zodResolver(formSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver, defaultValues: defaultsFor(leaveType) });

  useEffect(() => {
    if (open) reset(defaultsFor(leaveType));
  }, [open, leaveType, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: FormValues) {
    const genderRestriction: 'male' | 'female' | null =
      values.gender_restriction === 'male' || values.gender_restriction === 'female'
        ? values.gender_restriction
        : null;

    const payload = {
      name: values.name.trim(),
      code: values.code.trim() || null,
      is_paid: values.is_paid,
      requires_attachment: values.requires_attachment,
      allows_half_day: values.allows_half_day,
      max_days_per_request: values.max_days_per_request ? Number(values.max_days_per_request) : null,
      min_days_per_request: Number(values.min_days_per_request || 0.5),
      gender_restriction: genderRestriction,
      color: values.color || null,
      sort_order: values.sort_order ? Number(values.sort_order) : 0,
      is_active: values.is_active,
    };

    const result = isEdit
      ? await updateMutation.mutate({ id: leaveType.id, ...payload })
      : await createMutation.mutate(payload);

    if (result) {
      toast.success(
        isEdit ? t('leave.admin.types.updatedToast') : t('leave.admin.types.createdToast'),
      );
      handleOpenChange(false);
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof FormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-[min(640px,calc(100vw-32px))]"
        title={
          isEdit ? t('leave.admin.types.editTitle') : t('leave.admin.types.addTitle')
        }
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="leave-type-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="leave-type-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutationError ? (
            <p
              role="alert"
              className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral"
            >
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('leave.admin.types.fields.name')}
              htmlFor="leave-type-name"
              required
              error={translate(t, errors.name?.message)}
            >
              <Input id="leave-type-name" invalid={!!errors.name} {...register('name')} />
            </Field>
            <Field
              label={t('leave.admin.types.fields.code')}
              htmlFor="leave-type-code"
              error={translate(t, errors.code?.message)}
            >
              <Input id="leave-type-code" dir="ltr" invalid={!!errors.code} {...register('code')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('leave.admin.types.fields.maxDays')}
              htmlFor="leave-type-max-days"
              error={translate(t, errors.max_days_per_request?.message)}
            >
              <Input
                id="leave-type-max-days"
                type="number"
                min={1}
                invalid={!!errors.max_days_per_request}
                {...register('max_days_per_request')}
              />
            </Field>
            <Field
              label={t('leave.admin.types.fields.minDays')}
              htmlFor="leave-type-min-days"
              error={translate(t, errors.min_days_per_request?.message)}
            >
              <Input
                id="leave-type-min-days"
                type="number"
                min={0}
                step={0.5}
                invalid={!!errors.min_days_per_request}
                {...register('min_days_per_request')}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('leave.admin.types.fields.gender')}
              htmlFor="leave-type-gender"
              error={translate(t, errors.gender_restriction?.message)}
            >
              <Select id="leave-type-gender" {...register('gender_restriction')}>
                <option value="">{t('leave.admin.common.any')}</option>
                <option value="male">{t('leave.admin.common.male')}</option>
                <option value="female">{t('leave.admin.common.female')}</option>
              </Select>
            </Field>
            <Field
              label={t('leave.admin.types.fields.sortOrder')}
              htmlFor="leave-type-sort"
              error={translate(t, errors.sort_order?.message)}
            >
              <Input
                id="leave-type-sort"
                type="number"
                invalid={!!errors.sort_order}
                {...register('sort_order')}
              />
            </Field>
          </div>

          <Field label={t('leave.admin.types.fields.color')} htmlFor="leave-type-color">
            <div className="flex items-center gap-3">
              <input
                id="leave-type-color"
                type="color"
                className="h-9 w-14 cursor-pointer rounded-[3px] border border-hairline bg-surface p-1"
                {...register('color')}
              />
              <span className="font-mono text-[12px] text-ink-muted" dir="ltr">
                {t('leave.admin.types.fields.colorHint')}
              </span>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-2 rounded-[3px] border border-hairline px-4 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-body-sm text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-divider accent-navy"
                {...register('is_paid')}
              />
              {t('leave.admin.types.fields.isPaid')}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-body-sm text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-divider accent-navy"
                {...register('requires_attachment')}
              />
              {t('leave.admin.types.fields.requiresAttachment')}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-body-sm text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-divider accent-navy"
                {...register('allows_half_day')}
              />
              {t('leave.admin.types.fields.allowsHalfDay')}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-body-sm text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-divider accent-navy"
                {...register('is_active')}
              />
              {t('leave.admin.common.active')}
            </label>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
