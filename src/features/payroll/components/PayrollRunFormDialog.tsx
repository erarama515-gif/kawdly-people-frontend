import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { userFacingMessage } from '@/lib/api/errors';
import type { ApiError } from '@/lib/api/errors';
import { getCurrentUserId } from '@/auth/session';
import { useCreatePayrollRun, useUpdatePayrollRun } from '../api/queries';
import type { PayrollRunInput, PayrollRunStatus } from '../api/resource';
import type { PayrollRunWire } from '../api/schema';

/**
 * Add/Edit modal for one PayrollRun record, built on Dialog + react-hook-form
 * + zod — same library combination as other feature form dialogs.
 *
 * Key points:
 *  - All form fields are plain strings; `toPayrollRunInput()` converts on valid submit.
 *  - Save button is wired via HTML5 `form="payroll-run-form"` attribute.
 *  - `fieldErrorsFrom()` maps Laravel 422 `{errors:{field:[msg]}}` bodies to
 *    RHF `setError` calls.
 * SKIPPED: /calculate and /approve actions — no auth context yet.
 */

const REQUIRED = 'common.requiredField';

const PAYROLL_RUN_STATUSES: readonly PayrollRunStatus[] = [
  'draft',
  'calculating',
  'calculated',
  'reviewing',
  'approved',
  'posted',
  'paid',
];

const payrollRunFormSchema = z.object({
  period_month: z.string().min(1, REQUIRED),
  period_year: z.string().min(1, REQUIRED),
  status: z.string(),
  total_gross: z.string(),
  total_deductions: z.string(),
  total_net: z.string(),
  employee_count: z.string(),
  notes: z.string(),
  is_locked: z.string(),
});

type PayrollRunFormValues = z.infer<typeof payrollRunFormSchema>;

function buildDefaultValues(run: PayrollRunWire | undefined): PayrollRunFormValues {
  if (!run) {
    const now = new Date();
    return {
      period_month: String(now.getMonth() + 1),
      period_year: String(now.getFullYear()),
      status: 'draft',
      total_gross: '',
      total_deductions: '',
      total_net: '',
      employee_count: '',
      notes: '',
      is_locked: 'false',
    };
  }

  return {
    period_month: String(run.period_month),
    period_year: String(run.period_year),
    status: run.status ?? 'draft',
    total_gross: run.total_gross !== undefined ? String(run.total_gross) : '',
    total_deductions: run.total_deductions !== undefined ? String(run.total_deductions) : '',
    total_net: run.total_net !== undefined ? String(run.total_net) : '',
    employee_count: run.employee_count !== undefined ? String(run.employee_count) : '',
    notes: run.notes ?? '',
    is_locked: run.is_locked ? 'true' : 'false',
  };
}

function toPayrollRunInput(values: PayrollRunFormValues): PayrollRunInput {
  return {
    created_by: getCurrentUserId(),
    period_month: Number(values.period_month),
    period_year: Number(values.period_year),
    status: (values.status as PayrollRunStatus) || null,
    total_gross: values.total_gross.trim() ? Number(values.total_gross) : null,
    total_deductions: values.total_deductions.trim() ? Number(values.total_deductions) : null,
    total_net: values.total_net.trim() ? Number(values.total_net) : null,
    employee_count: values.employee_count.trim() ? Number(values.employee_count) : null,
    notes: values.notes.trim() || null,
    is_locked: values.is_locked === 'true' ? true : false,
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

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export interface PayrollRunFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit (or pass `undefined`) to open in "Add Payroll Run" mode. */
  run?: PayrollRunWire | undefined;
}

export function PayrollRunFormDialog({ open, onOpenChange, run }: PayrollRunFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = run !== undefined;

  const createMutation = useCreatePayrollRun();
  const updateMutation = useUpdatePayrollRun();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  const resolver = useMemo(() => zodResolver(payrollRunFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<PayrollRunFormValues>({
    resolver,
    defaultValues: buildDefaultValues(run),
  });

  // Re-seed the form every time the dialog opens.
  useEffect(() => {
    if (open) reset(buildDefaultValues(run));
  }, [open, run, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: PayrollRunFormValues) {
    const input = toPayrollRunInput(values);
    const result = isEdit
      ? await updateMutation.mutate({ id: run.id, ...input })
      : await createMutation.mutate(input);

    if (result) {
      handleOpenChange(false);
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof PayrollRunFormValues, { type: 'server', message });
    }
  }

  // Build year options: current year ± 2
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('payroll.run.editTitle') : t('payroll.run.addTitle')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="payroll-run-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="payroll-run-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutationError ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            {/* Period month */}
            <Field
              label={t('payroll.run.form.periodMonth')}
              htmlFor="period_month"
              required
              error={translate(t, errors.period_month?.message)}
            >
              <Select id="period_month" invalid={!!errors.period_month} {...register('period_month')}>
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {new Date(2000, m - 1).toLocaleDateString('en-GB', { month: 'long' })}
                  </option>
                ))}
              </Select>
            </Field>

            {/* Period year */}
            <Field
              label={t('payroll.run.form.periodYear')}
              htmlFor="period_year"
              required
              error={translate(t, errors.period_year?.message)}
            >
              <Select id="period_year" invalid={!!errors.period_year} {...register('period_year')}>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Status */}
          <Field
            label={t('payroll.run.form.status')}
            htmlFor="run_status"
            error={translate(t, errors.status?.message)}
          >
            <Select id="run_status" invalid={!!errors.status} {...register('status')}>
              {PAYROLL_RUN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`payroll.runStatusOptions.${s}`)}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            {/* Total gross */}
            <Field
              label={t('payroll.run.form.totalGross')}
              htmlFor="total_gross"
              error={translate(t, errors.total_gross?.message)}
            >
              <Input id="total_gross" type="number" min="0" invalid={!!errors.total_gross} {...register('total_gross')} />
            </Field>

            {/* Total deductions */}
            <Field
              label={t('payroll.run.form.totalDeductions')}
              htmlFor="total_deductions"
              error={translate(t, errors.total_deductions?.message)}
            >
              <Input id="total_deductions" type="number" min="0" invalid={!!errors.total_deductions} {...register('total_deductions')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Total net */}
            <Field
              label={t('payroll.run.form.totalNet')}
              htmlFor="total_net"
              error={translate(t, errors.total_net?.message)}
            >
              <Input id="total_net" type="number" min="0" invalid={!!errors.total_net} {...register('total_net')} />
            </Field>

            {/* Employee count */}
            <Field
              label={t('payroll.run.form.employeeCount')}
              htmlFor="employee_count"
              error={translate(t, errors.employee_count?.message)}
            >
              <Input id="employee_count" type="number" min="0" invalid={!!errors.employee_count} {...register('employee_count')} />
            </Field>
          </div>

          {/* Is locked */}
          <Field
            label={t('payroll.run.form.isLocked')}
            htmlFor="is_locked"
            error={translate(t, errors.is_locked?.message)}
          >
            <Select id="is_locked" invalid={!!errors.is_locked} {...register('is_locked')}>
              <option value="false">{t('common.no')}</option>
              <option value="true">{t('common.yes')}</option>
            </Select>
          </Field>

          {/* Notes */}
          <Field
            label={t('payroll.run.form.notes')}
            htmlFor="notes"
            error={translate(t, errors.notes?.message)}
          >
            <Textarea id="notes" rows={2} invalid={!!errors.notes} {...register('notes')} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
