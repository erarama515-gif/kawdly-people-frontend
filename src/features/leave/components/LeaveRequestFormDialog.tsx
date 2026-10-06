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
import { useCreateLeaveRequest, useUpdateLeaveRequest, useLeaveTypeList } from '../api/queries';
import type { LeaveRequestInput, LeaveRequestStatus } from '../api/resource';
import type { LeaveRequestWire } from '../api/schema';

/**
 * Add/Edit modal for one leave request, built on `Dialog` + react-hook-form + zod —
 * the same library combination and conventions as `EmployeeFormDialog`. Every
 * control is a plain string (native `<select>`/`<input>` values); validation
 * runs on those strings, and `toLeaveRequestInput` does the one-time conversion
 * to the wire-shaped `LeaveRequestInput` on submit.
 *
 * Validation messages are translation keys, resolved via `t()` at render time
 * so the same schema works for both locales without being rebuilt per render.
 */

const REQUIRED = 'common.requiredField';

const leaveRequestFormSchema = z.object({
  employee_id: z.string().min(1, REQUIRED),
  leave_type_id: z.string().min(1, REQUIRED),
  start_date: z.string().min(1, REQUIRED),
  end_date: z.string().min(1, REQUIRED),
  days: z.string().min(1, REQUIRED),
  reason: z.string().trim().max(1000),
  status: z.string(),
});

type LeaveRequestFormValues = z.infer<typeof leaveRequestFormSchema>;

function buildDefaultValues(request: LeaveRequestWire | undefined): LeaveRequestFormValues {
  if (!request) {
    const today = new Date().toISOString().slice(0, 10);
    return {
      employee_id: '',
      leave_type_id: '',
      start_date: today,
      end_date: today,
      days: '1',
      reason: '',
      status: 'pending',
    };
  }

  return {
    employee_id: String(request.employee_id),
    leave_type_id: String(request.leave_type_id),
    start_date: request.start_date.slice(0, 10),
    end_date: request.end_date.slice(0, 10),
    days: String(parseFloat(request.days)),
    reason: request.reason ?? '',
    status: request.status,
  };
}

function toLeaveRequestInput(values: LeaveRequestFormValues): LeaveRequestInput {
  const status = (values.status || 'pending') as LeaveRequestStatus;
  return {
    employee_id: Number(values.employee_id),
    leave_type_id: Number(values.leave_type_id),
    start_date: values.start_date,
    end_date: values.end_date,
    days: parseFloat(values.days) || 1,
    reason: values.reason.trim() || null,
    status,
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

const EDIT_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;

export interface LeaveRequestFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit (or pass `undefined`) to open in "Add Leave Request" mode. */
  leaveRequest?: LeaveRequestWire | undefined;
}

export function LeaveRequestFormDialog({ open, onOpenChange, leaveRequest }: LeaveRequestFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = leaveRequest !== undefined;

  const createMutation = useCreateLeaveRequest();
  const updateMutation = useUpdateLeaveRequest();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  // Employee picker: first 100 employees
  const { state: employeeState } = useEmployeeList({ page: 1, perPage: 100 });
  const employees = employeeState.data?.data ?? [];

  // Leave-type dropdown
  const { state: leaveTypeState } = useLeaveTypeList();
  const leaveTypes = leaveTypeState.data ?? [];

  const resolver = useMemo(() => zodResolver(leaveRequestFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<LeaveRequestFormValues>({
    resolver,
    defaultValues: buildDefaultValues(leaveRequest),
  });

  // Re-seed the form every time the dialog opens.
  useEffect(() => {
    if (open) reset(buildDefaultValues(leaveRequest));
  }, [open, leaveRequest, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: LeaveRequestFormValues) {
    const input = toLeaveRequestInput(values);
    const result = isEdit
      ? await updateMutation.mutate({ id: leaveRequest.id, ...input })
      : await createMutation.mutate(input);

    if (result) {
      handleOpenChange(false);
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof LeaveRequestFormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('leave.form.editTitle') : t('leave.form.addTitle')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="leave-request-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="leave-request-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutationError ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          {/* Employee picker */}
          <Field
            label={t('leave.form.employee')}
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

          {/* Leave type */}
          <Field
            label={t('leave.form.leaveType')}
            htmlFor="leave_type_id"
            required
            error={translate(t, errors.leave_type_id?.message)}
          >
            <Select id="leave_type_id" invalid={!!errors.leave_type_id} {...register('leave_type_id')}>
              <option value="">{t('common.selectPlaceholder')}</option>
              {leaveTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.name}
                </option>
              ))}
            </Select>
          </Field>

          {/* Dates + days */}
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('leave.form.startDate')}
              htmlFor="start_date"
              required
              error={translate(t, errors.start_date?.message)}
            >
              <Input id="start_date" type="date" invalid={!!errors.start_date} {...register('start_date')} />
            </Field>
            <Field
              label={t('leave.form.endDate')}
              htmlFor="end_date"
              required
              error={translate(t, errors.end_date?.message)}
            >
              <Input id="end_date" type="date" invalid={!!errors.end_date} {...register('end_date')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('leave.form.days')}
              htmlFor="days"
              required
              error={translate(t, errors.days?.message)}
            >
              <Input
                id="days"
                type="number"
                step="0.5"
                min="0.5"
                invalid={!!errors.days}
                {...register('days')}
              />
            </Field>

            {isEdit ? (
              <Field label={t('leave.form.status')} htmlFor="status" error={translate(t, errors.status?.message)}>
                <Select id="status" invalid={!!errors.status} {...register('status')}>
                  {EDIT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {t(`leave.status.${status}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>

          {/* Reason */}
          <Field label={t('leave.form.reason')} htmlFor="reason" error={translate(t, errors.reason?.message)}>
            <Input id="reason" invalid={!!errors.reason} {...register('reason')} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
