import { useEffect } from 'react';
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
  useCreateLeavePolicy,
  useLeaveTypeAdminList,
  useUpdateLeavePolicy,
} from '../api/admin';
import type { LeavePolicyWire } from '../api/admin';

const REQUIRED = 'common.requiredField';

const numericField = (messageKey: string, min = 0) =>
  z.string().refine((value) => {
    if (!value) return true;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= min;
  }, messageKey);

const integerField = (messageKey: string) =>
  z.string().refine((value) => {
    if (!value) return true;
    return Number.isInteger(Number(value));
  }, messageKey);

const formSchema = z.object({
  leave_type_id: z.string().min(1, REQUIRED),
  name: z.string().trim().min(1, REQUIRED).max(255),
  annual_entitlement: numericField('leave.admin.policies.validation.entitlement'),
  accrual_method: z.enum(['yearly', 'monthly', 'none']),
  carry_forward_max: numericField('leave.admin.policies.validation.carryForward'),
  carry_forward_expiry_months: integerField('leave.admin.policies.validation.expiryMonths'),
  encashment_allowed: z.boolean(),
  encashment_max_days: numericField('leave.admin.policies.validation.encashmentDays'),
  min_service_months: integerField('leave.admin.policies.validation.minService'),
  is_active: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

const DEFAULTS: FormValues = {
  leave_type_id: '',
  name: '',
  annual_entitlement: '0',
  accrual_method: 'yearly',
  carry_forward_max: '0',
  carry_forward_expiry_months: '0',
  encashment_allowed: false,
  encashment_max_days: '0',
  min_service_months: '0',
  is_active: true,
};

function defaultsFor(policy: LeavePolicyWire | undefined): FormValues {
  if (!policy) return DEFAULTS;
  return {
    leave_type_id: String(policy.leave_type_id),
    name: policy.name,
    annual_entitlement: String(Number(policy.annual_entitlement)),
    accrual_method: policy.accrual_method,
    carry_forward_max:
      policy.carry_forward_max !== undefined ? String(Number(policy.carry_forward_max)) : '0',
    carry_forward_expiry_months:
      policy.carry_forward_expiry_months !== undefined
        ? String(policy.carry_forward_expiry_months)
        : '0',
    encashment_allowed: policy.encashment_allowed ?? false,
    encashment_max_days:
      policy.encashment_max_days !== undefined ? String(Number(policy.encashment_max_days)) : '0',
    min_service_months:
      policy.min_service_months !== undefined ? String(policy.min_service_months) : '0',
    is_active: policy.is_active ?? true,
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

export interface LeavePolicyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy?: LeavePolicyWire | undefined;
}

/**
 * Create/edit dialog for `GET|POST|PATCH /leave-policies`.
 *
 * `conditions`, `applicable_grades`, and `applicable_departments` are not
 * exposed here: the seeded rows leave them empty and the API accepts `[]`, so
 * the dialog sends the existing value (or `[]`) untouched.
 */
export function LeavePolicyFormDialog({
  open,
  onOpenChange,
  policy,
}: LeavePolicyFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = policy !== undefined;

  const { state: leaveTypesState } = useLeaveTypeAdminList();
  const createMutation = useCreateLeavePolicy();
  const updateMutation = useUpdateLeavePolicy();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultsFor(policy),
  });

  useEffect(() => {
    if (open) reset(defaultsFor(policy));
  }, [open, policy, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: FormValues) {
    const payload = {
      leave_type_id: Number(values.leave_type_id),
      name: values.name.trim(),
      annual_entitlement: Number(values.annual_entitlement || 0),
      accrual_method: values.accrual_method,
      carry_forward_max: values.carry_forward_max ? Number(values.carry_forward_max) : 0,
      carry_forward_expiry_months: Number(values.carry_forward_expiry_months || 0),
      encashment_allowed: values.encashment_allowed,
      encashment_max_days: Number(values.encashment_max_days || 0),
      min_service_months: Number(values.min_service_months || 0),
      conditions: policy?.conditions ?? [],
      is_active: values.is_active,
    };

    const result = isEdit
      ? await updateMutation.mutate({ id: policy.id, ...payload })
      : await createMutation.mutate(payload);

    if (result !== undefined) {
      toast.success(
        isEdit
          ? t('leave.admin.policies.updatedToast')
          : t('leave.admin.policies.createdToast'),
      );
      handleOpenChange(false);
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof FormValues, { type: 'server', message });
    }
  }

  const leaveTypes = leaveTypesState.data?.data ?? [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-[min(640px,calc(100vw-32px))]"
        title={isEdit ? t('leave.admin.policies.editTitle') : t('leave.admin.policies.addTitle')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="leave-policy-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="leave-policy-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
              label={t('leave.admin.common.leaveType')}
              htmlFor="leave-policy-type"
              required
              error={translate(t, errors.leave_type_id?.message)}
            >
              <Select
                id="leave-policy-type"
                invalid={!!errors.leave_type_id}
                {...register('leave_type_id')}
              >
                <option value="">{t('leave.admin.common.select')}</option>
                {leaveTypes.map((leaveType) => (
                  <option key={leaveType.id} value={leaveType.id}>
                    {leaveType.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t('leave.admin.policies.fields.name')}
              htmlFor="leave-policy-name"
              required
              error={translate(t, errors.name?.message)}
            >
              <Input id="leave-policy-name" invalid={!!errors.name} {...register('name')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('leave.admin.policies.fields.entitlement')}
              htmlFor="leave-policy-entitlement"
              error={translate(t, errors.annual_entitlement?.message)}
            >
              <Input
                id="leave-policy-entitlement"
                type="number"
                min={0}
                step={0.5}
                invalid={!!errors.annual_entitlement}
                {...register('annual_entitlement')}
              />
            </Field>
            <Field label={t('leave.admin.policies.fields.accrual')} htmlFor="leave-policy-accrual">
              <Select id="leave-policy-accrual" {...register('accrual_method')}>
                <option value="yearly">{t('leave.admin.policies.accrual.yearly')}</option>
                <option value="monthly">{t('leave.admin.policies.accrual.monthly')}</option>
                <option value="none">{t('leave.admin.policies.accrual.none')}</option>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('leave.admin.policies.fields.carryForwardMax')}
              htmlFor="leave-policy-carry"
              error={translate(t, errors.carry_forward_max?.message)}
            >
              <Input
                id="leave-policy-carry"
                type="number"
                min={0}
                step={0.5}
                invalid={!!errors.carry_forward_max}
                {...register('carry_forward_max')}
              />
            </Field>
            <Field
              label={t('leave.admin.policies.fields.carryForwardExpiry')}
              htmlFor="leave-policy-carry-expiry"
              error={translate(t, errors.carry_forward_expiry_months?.message)}
            >
              <Input
                id="leave-policy-carry-expiry"
                type="number"
                min={0}
                invalid={!!errors.carry_forward_expiry_months}
                {...register('carry_forward_expiry_months')}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('leave.admin.policies.fields.encashmentMaxDays')}
              htmlFor="leave-policy-encashment"
              error={translate(t, errors.encashment_max_days?.message)}
            >
              <Input
                id="leave-policy-encashment"
                type="number"
                min={0}
                step={0.5}
                invalid={!!errors.encashment_max_days}
                {...register('encashment_max_days')}
              />
            </Field>
            <Field
              label={t('leave.admin.policies.fields.minServiceMonths')}
              htmlFor="leave-policy-min-service"
              error={translate(t, errors.min_service_months?.message)}
            >
              <Input
                id="leave-policy-min-service"
                type="number"
                min={0}
                invalid={!!errors.min_service_months}
                {...register('min_service_months')}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-[3px] border border-hairline px-4 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-body-sm text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-divider accent-navy"
                {...register('encashment_allowed')}
              />
              {t('leave.admin.policies.fields.encashmentAllowed')}
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
