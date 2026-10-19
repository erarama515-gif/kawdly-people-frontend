import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/form';
import { userFacingMessage } from '@/lib/api/errors';
import { toast } from '@/components/ui/Toast';
import { useReinstateEmployee } from '../api/queries';
import type { EmployeeWire } from '../api/schema';

/** `POST /employees/{id}/reinstate` — sets `status=active`. `reason` is required by the backend. */

const REQUIRED = 'common.requiredField';

const reinstateFormSchema = z.object({
  reason: z.string().trim().min(1, REQUIRED).max(500),
});

type ReinstateFormValues = z.infer<typeof reinstateFormSchema>;

const DEFAULTS: ReinstateFormValues = { reason: '' };

function translate(t: TFunction, message: string | undefined): string | undefined {
  return message ? t(message) : undefined;
}

export interface EmployeeReinstateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeWire;
}

export function EmployeeReinstateDialog({ open, onOpenChange, employee }: EmployeeReinstateDialogProps) {
  const { t } = useTranslation();
  const mutation = useReinstateEmployee();
  const resolver = useMemo(() => zodResolver(reinstateFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReinstateFormValues>({ resolver, defaultValues: DEFAULTS });

  useEffect(() => {
    if (open) reset(DEFAULTS);
  }, [open, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) mutation.reset();
    onOpenChange(next);
  }

  async function onSubmit(values: ReinstateFormValues) {
    const result = await mutation.mutate({ id: employee.id, reason: values.reason.trim() });

    if (result !== undefined) {
      toast.success('employees.reinstateSuccess');
      handleOpenChange(false);
      return;
    }
    toast.error(userFacingMessage(mutation.error) || 'employees.reinstateFailed');
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={t('employees.reinstateConfirm.title')}
        description={t('employees.reinstateConfirm.description', {
          name: `${employee.first_name} ${employee.last_name}`,
        })}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={mutation.isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="employee-reinstate-form" variant="primary" isLoading={mutation.isPending}>
              {t('employees.reinstateAction')}
            </Button>
          </>
        }
      >
        <form id="employee-reinstate-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutation.error ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutation.error)}
            </p>
          ) : null}

          <Field label={t('employees.form.reason')} htmlFor="reason" required error={translate(t, errors.reason?.message)}>
            <Textarea id="reason" rows={3} invalid={!!errors.reason} {...register('reason')} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
