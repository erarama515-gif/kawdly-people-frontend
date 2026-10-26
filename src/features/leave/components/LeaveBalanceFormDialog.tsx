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
import { useEmployeeList } from '@/features/employees/api/queries';
import {
  useCreateLeaveBalance,
  useLeaveTypeAdminList,
  useUpdateLeaveBalance,
} from '../api/admin';
import type { LeaveBalanceWire } from '../api/admin';

const REQUIRED = 'common.requiredField';

const numericField = (messageKey: string) =>
  z.string().refine((value) => {
    if (!value) return true;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0;
  }, messageKey);

const formSchema = z.object({
  employee_id: z.string().min(1, REQUIRED),
  leave_type_id: z.string().min(1, REQUIRED),
  year: z.string().regex(/^\d{4}$/, 'leave.admin.balances.validation.year'),
  entitled: numericField('leave.admin.balances.validation.amount'),
  taken: numericField('leave.admin.balances.validation.amount'),
  pending: numericField('leave.admin.balances.validation.amount'),
  carried_forward: numericField('leave.admin.balances.validation.amount'),
  adjustment: numericField('leave.admin.balances.validation.amount'),
});

type FormValues = z.infer<typeof formSchema>;

const currentYear = String(new Date().getFullYear());

const DEFAULTS: FormValues = {
  employee_id: '',
  leave_type_id: '',
  year: currentYear,
  entitled: '0',
  taken: '0',
  pending: '0',
  carried_forward: '0',
  adjustment: '0',
};

function defaultsFor(balance: LeaveBalanceWire | undefined): FormValues {
  if (!balance) return DEFAULTS;
  return {
    employee_id: String(balance.employee_id),
    leave_type_id: String(balance.leave_type_id),
    year: String(balance.year),
    entitled: String(Number(balance.entitled)),
    taken: String(Number(balance.taken)),
    pending: String(Number(balance.pending)),
    carried_forward: String(Number(balance.carried_forward)),
    adjustment: String(Number(balance.adjustment)),
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

export interface LeaveBalanceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balance?: LeaveBalanceWire | undefined;
}

/**
 * Create/edit dialog for `GET|POST|PATCH /leave-balances`.
 *
 * `balance` itself is computed server-side from entitlement + carry-forward +
 * adjustment − taken − pending, so it is never submitted from here.
 */
export function LeaveBalanceFormDialog({
  open,
  onOpenChange,
  balance,
}: LeaveBalanceFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = balance !== undefined;

  const { state: leaveTypesState } = useLeaveTypeAdminList();
  const { state: employeesState } = useEmployeeList({ page: 1, perPage: 200 });
  const createMutation = useCreateLeaveBalance();
  const updateMutation = useUpdateLeaveBalance();
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
    defaultValues: defaultsFor(balance),
  });

  useEffect(() => {
    if (open) reset(defaultsFor(balance));
  }, [open, balance, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: FormValues) {
    const payload = {
      employee_id: Number(values.employee_id),
      leave_type_id: Number(values.leave_type_id),
      year: Number(values.year),
      entitled: Number(values.entitled || 0),
      taken: Number(values.taken || 0),
      pending: Number(values.pending || 0),
      carried_forward: Number(values.carried_forward || 0),
      adjustment: Number(values.adjustment || 0),
    };

    const result = isEdit
      ? await updateMutation.mutate({ id: balance.id, ...payload })
      : await createMutation.mutate(payload);

    if (result !== undefined) {
      toast.success(
        isEdit
          ? t('leave.admin.balances.updatedToast')
          : t('leave.admin.balances.createdToast'),
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
  const employees = employeesState.data?.data ?? [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-[min(640px,calc(100vw-32px))]"
        title={isEdit ? t('leave.admin.balances.editTitle') : t('leave.admin.balances.addTitle')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="leave-balance-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="leave-balance-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
              label={t('leave.admin.common.employee')}
              htmlFor="leave-balance-employee"
              required
              error={translate(t, errors.employee_id?.message)}
            >
              <Select
                id="leave-balance-employee"
                invalid={!!errors.employee_id}
                {...register('employee_id')}
              >
                <option value="">{t('leave.admin.common.select')}</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.first_name_ar && employee.last_name_ar
                      ? `${employee.first_name_ar} ${employee.last_name_ar}`
                      : `${employee.first_name} ${employee.last_name}`}{' '}
                    — {employee.employee_number}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t('leave.admin.common.leaveType')}
              htmlFor="leave-balance-type"
              required
              error={translate(t, errors.leave_type_id?.message)}
            >
              <Select
                id="leave-balance-type"
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('leave.admin.balances.fields.year')}
              htmlFor="leave-balance-year"
              required
              error={translate(t, errors.year?.message)}
            >
              <Input
                id="leave-balance-year"
                type="number"
                min={2000}
                max={2100}
                invalid={!!errors.year}
                {...register('year')}
              />
            </Field>
            <Field
              label={t('leave.admin.balances.fields.entitled')}
              htmlFor="leave-balance-entitled"
              error={translate(t, errors.entitled?.message)}
            >
              <Input
                id="leave-balance-entitled"
                type="number"
                min={0}
                step={0.5}
                invalid={!!errors.entitled}
                {...register('entitled')}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('leave.admin.balances.fields.taken')}
              htmlFor="leave-balance-taken"
              error={translate(t, errors.taken?.message)}
            >
              <Input
                id="leave-balance-taken"
                type="number"
                min={0}
                step={0.5}
                invalid={!!errors.taken}
                {...register('taken')}
              />
            </Field>
            <Field
              label={t('leave.admin.balances.fields.pending')}
              htmlFor="leave-balance-pending"
              error={translate(t, errors.pending?.message)}
            >
              <Input
                id="leave-balance-pending"
                type="number"
                min={0}
                step={0.5}
                invalid={!!errors.pending}
                {...register('pending')}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('leave.admin.balances.fields.carriedForward')}
              htmlFor="leave-balance-carried"
              error={translate(t, errors.carried_forward?.message)}
            >
              <Input
                id="leave-balance-carried"
                type="number"
                min={0}
                step={0.5}
                invalid={!!errors.carried_forward}
                {...register('carried_forward')}
              />
            </Field>
            <Field
              label={t('leave.admin.balances.fields.adjustment')}
              htmlFor="leave-balance-adjustment"
              error={translate(t, errors.adjustment?.message)}
            >
              <Input
                id="leave-balance-adjustment"
                type="number"
                step={0.5}
                invalid={!!errors.adjustment}
                {...register('adjustment')}
              />
            </Field>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
