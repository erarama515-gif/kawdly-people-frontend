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
import { useSuspendEmployee } from '../api/queries';
import type { EmployeeWire } from '../api/schema';

/**
 * `POST /employees/{id}/suspend` — sets `status=suspended`. `reason` is
 * required by the backend; `suspended_until` is optional (informational only
 * — the backend does not auto-reinstate on that date).
 */

const REQUIRED = 'common.requiredField';

const suspendFormSchema = z.object({
  reason: z.string().trim().min(1, REQUIRED).max(500),
  suspended_until: z.string(),
});

type SuspendFormValues = z.infer<typeof suspendFormSchema>;

const DEFAULTS: SuspendFormValues = { reason: '', suspended_until: '' };

function translate(t: TFunction, message: string | undefined): string | undefined {
  return message ? t(message) : undefined;
}

export interface EmployeeSuspendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeWire;
}

export function EmployeeSuspendDialog({ open, onOpenChange, employee }: EmployeeSuspendDialogProps) {
  const { t } = useTranslation();
  const mutation = useSuspendEmployee();
  const resolver = useMemo(() => zodResolver(suspendFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SuspendFormValues>({ resolver, defaultValues: DEFAULTS });

  useEffect(() => {
    if (open) reset(DEFAULTS);
  }, [open, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) mutation.reset();
    onOpenChange(next);
  }

  async function onSubmit(values: SuspendFormValues) {
    const result = await mutation.mutate({
      id: employee.id,
      reason: values.reason.trim(),
      suspended_until: values.suspended_until || null,
    });

    if (result !== undefined) {
      toast.success('employees.suspendSuccess');
      handleOpenChange(false);
      return;
    }
    toast.error(userFacingMessage(mutation.error) || 'employees.suspendFailed');
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={t('employees.suspendConfirm.title')}
        description={t('employees.suspendConfirm.description', {
          name: `${employee.first_name} ${employee.last_name}`,
        })}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={mutation.isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="employee-suspend-form" variant="danger" isLoading={mutation.isPending}>
              {t('employees.suspendAction')}
            </Button>
          </>
        }
      >
        <form id="employee-suspend-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutation.error ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutation.error)}
            </p>
          ) : null}

          <Field label={t('employees.form.reason')} htmlFor="reason" required error={translate(t, errors.reason?.message)}>
            <Textarea id="reason" rows={3} invalid={!!errors.reason} {...register('reason')} />
          </Field>

          <Field label={t('employees.form.suspendedUntil')} htmlFor="suspended_until">
            <Input id="suspended_until" type="date" {...register('suspended_until')} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
