import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/form';
import { userFacingMessage } from '@/lib/api/errors';
import { toast } from '@/components/ui/Toast';
import { useTerminateEmployee } from '../api/queries';
import type { EmployeeWire } from '../api/schema';

/**
 * `POST /employees/{id}/terminate` — sets `status=terminated` and writes
 * `termination_date`/`termination_reason`. Both are required by the
 * backend; `last_working_day` and `notice_period_days` are optional.
 */

const REQUIRED = 'common.requiredField';

const terminateFormSchema = z.object({
  termination_date: z.string().min(1, REQUIRED),
  termination_reason: z.string().trim().min(1, REQUIRED).max(1000),
  last_working_day: z.string(),
  notice_period_days: z.string(),
});

type TerminateFormValues = z.infer<typeof terminateFormSchema>;

function defaultValues(): TerminateFormValues {
  return {
    termination_date: new Date().toISOString().slice(0, 10),
    termination_reason: '',
    last_working_day: '',
    notice_period_days: '',
  };
}

function translate(t: TFunction, message: string | undefined): string | undefined {
  return message ? t(message) : undefined;
}

export interface EmployeeTerminateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeWire;
}

export function EmployeeTerminateDialog({ open, onOpenChange, employee }: EmployeeTerminateDialogProps) {
  const { t } = useTranslation();
  const mutation = useTerminateEmployee();
  const resolver = useMemo(() => zodResolver(terminateFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TerminateFormValues>({ resolver, defaultValues: defaultValues() });

  useEffect(() => {
    if (open) reset(defaultValues());
  }, [open, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) mutation.reset();
    onOpenChange(next);
  }

  async function onSubmit(values: TerminateFormValues) {
    const result = await mutation.mutate({
      id: employee.id,
      termination_date: values.termination_date,
      termination_reason: values.termination_reason.trim(),
      last_working_day: values.last_working_day || null,
      notice_period_days: values.notice_period_days ? Number(values.notice_period_days) : null,
    });

    if (result !== undefined) {
      toast.success('employees.terminateSuccess');
      handleOpenChange(false);
      return;
    }
    toast.error(userFacingMessage(mutation.error) || 'employees.terminateFailed');
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={t('employees.terminateConfirm.title')}
        description={t('employees.terminateConfirm.description', {
          name: `${employee.first_name} ${employee.last_name}`,
        })}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={mutation.isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="employee-terminate-form" variant="danger" isLoading={mutation.isPending}>
              {t('employees.terminateAction')}
            </Button>
          </>
        }
      >
        <form id="employee-terminate-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutation.error ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutation.error)}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('employees.form.terminationDate')}
              htmlFor="termination_date"
              required
              error={translate(t, errors.termination_date?.message)}
            >
              <Input
                id="termination_date"
                type="date"
                invalid={!!errors.termination_date}
                {...register('termination_date')}
              />
            </Field>
            <Field label={t('employees.form.lastWorkingDay')} htmlFor="last_working_day">
              <Input id="last_working_day" type="date" {...register('last_working_day')} />
            </Field>
          </div>

          <Field label={t('employees.form.noticePeriodDays')} htmlFor="notice_period_days">
            <Input id="notice_period_days" type="number" min={0} {...register('notice_period_days')} />
          </Field>

          <Field
            label={t('employees.form.terminationReason')}
            htmlFor="termination_reason"
            required
            error={translate(t, errors.termination_reason?.message)}
          >
            <Textarea id="termination_reason" rows={3} invalid={!!errors.termination_reason} {...register('termination_reason')} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
