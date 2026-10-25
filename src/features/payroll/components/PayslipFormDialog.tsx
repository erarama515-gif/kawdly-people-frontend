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
import { useCreatePayslip, useUpdatePayslip } from '../api/queries';
import type { PayslipInput, PayslipStatus } from '../api/resource';
import type { PayslipWire } from '../api/schema';

/**
 * Add/Edit modal for one Payslip record, built on Dialog + react-hook-form
 * + zod — same library combination as other feature form dialogs.
 *
 * Key points:
 *  - Employee picker: native `<select>` fed by `useEmployeeList({ page:1, perPage:100 })`.
 *  - All form fields are plain strings; `toPayslipInput()` converts on valid submit.
 *  - Save button is wired via HTML5 `form="payslip-form"` attribute.
 *  - `fieldErrorsFrom()` maps Laravel 422 `{errors:{field:[msg]}}` bodies to
 *    RHF `setError` calls.
 *  - `payroll_run_id` is passed as a prop (the currently-selected run).
 */

const REQUIRED = 'common.requiredField';

const PAYSLIP_STATUSES: readonly PayslipStatus[] = ['draft', 'finalized', 'paid'];

const payslipFormSchema = z.object({
  employee_id: z.string().min(1, REQUIRED),
  basic_salary: z.string().min(1, REQUIRED),
  gross_salary: z.string().min(1, REQUIRED),
  total_earnings: z.string().min(1, REQUIRED),
  total_deductions: z.string().min(1, REQUIRED),
  net_salary: z.string().min(1, REQUIRED),
  working_days: z.string(),
  present_days: z.string(),
  absent_days: z.string(),
  overtime_hours: z.string(),
  overtime_amount: z.string(),
  status: z.string(),
});

type PayslipFormValues = z.infer<typeof payslipFormSchema>;

function buildDefaultValues(payslip: PayslipWire | undefined): PayslipFormValues {
  if (!payslip) {
    return {
      employee_id: '',
      basic_salary: '',
      gross_salary: '',
      total_earnings: '',
      total_deductions: '',
      net_salary: '',
      working_days: '',
      present_days: '',
      absent_days: '',
      overtime_hours: '',
      overtime_amount: '',
      status: 'draft',
    };
  }

  return {
    employee_id: String(payslip.employee_id),
    basic_salary: payslip.basic_salary != null ? String(payslip.basic_salary) : '',
    gross_salary: payslip.gross_salary != null ? String(payslip.gross_salary) : '',
    total_earnings: String(payslip.total_earnings),
    total_deductions: String(payslip.total_deductions),
    net_salary: payslip.net_salary != null ? String(payslip.net_salary) : '',
    working_days: payslip.working_days !== undefined ? String(payslip.working_days) : '',
    present_days: payslip.present_days !== undefined ? String(payslip.present_days) : '',
    absent_days: payslip.absent_days !== undefined ? String(payslip.absent_days) : '',
    overtime_hours: payslip.overtime_hours !== undefined ? String(payslip.overtime_hours) : '',
    overtime_amount: payslip.overtime_amount !== undefined ? String(payslip.overtime_amount) : '',
    status: payslip.status ?? 'draft',
  };
}

function toPayslipInput(values: PayslipFormValues, payrollRunId: number): PayslipInput {
  return {
    payroll_run_id: payrollRunId,
    employee_id: Number(values.employee_id),
    basic_salary: Number(values.basic_salary),
    gross_salary: Number(values.gross_salary),
    total_earnings: Number(values.total_earnings),
    total_deductions: Number(values.total_deductions),
    net_salary: Number(values.net_salary),
    working_days: values.working_days.trim() ? Number(values.working_days) : null,
    present_days: values.present_days.trim() ? Number(values.present_days) : null,
    absent_days: values.absent_days.trim() ? Number(values.absent_days) : null,
    overtime_hours: values.overtime_hours.trim() ? Number(values.overtime_hours) : null,
    overtime_amount: values.overtime_amount.trim() ? Number(values.overtime_amount) : null,
    status: (values.status as PayslipStatus) || null,
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

export interface PayslipFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The payroll run this payslip belongs to. */
  payrollRunId: number;
  /** Omit (or pass `undefined`) to open in "Add Payslip" mode. */
  payslip?: PayslipWire | undefined;
}

export function PayslipFormDialog({ open, onOpenChange, payrollRunId, payslip }: PayslipFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = payslip !== undefined;

  const createMutation = useCreatePayslip();
  const updateMutation = useUpdatePayslip();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  // Load employee list for the picker (first 100 — enough for the mock data set).
  const { state: empState } = useEmployeeList({ page: 1, perPage: 100 });
  const employees = empState.data?.data ?? [];

  const resolver = useMemo(() => zodResolver(payslipFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<PayslipFormValues>({
    resolver,
    defaultValues: buildDefaultValues(payslip),
  });

  // Re-seed the form every time the dialog opens.
  useEffect(() => {
    if (open) reset(buildDefaultValues(payslip));
  }, [open, payslip, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: PayslipFormValues) {
    const input = toPayslipInput(values, payrollRunId);
    const result = isEdit
      ? await updateMutation.mutate({ id: payslip.id, ...input })
      : await createMutation.mutate(input);

    if (result) {
      handleOpenChange(false);
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof PayslipFormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('payroll.payslip.editTitle') : t('payroll.payslip.addTitle')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="payslip-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="payslip-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutationError ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          {/* Employee picker */}
          <Field
            label={t('payroll.payslip.form.employee')}
            htmlFor="payslip_employee_id"
            required
            error={translate(t, errors.employee_id?.message)}
          >
            <Select id="payslip_employee_id" invalid={!!errors.employee_id} {...register('employee_id')}>
              <option value="">{t('common.selectPlaceholder')}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} — {emp.employee_number}
                </option>
              ))}
            </Select>
          </Field>

          {/* Status */}
          <Field
            label={t('payroll.payslip.form.status')}
            htmlFor="payslip_status"
            error={translate(t, errors.status?.message)}
          >
            <Select id="payslip_status" invalid={!!errors.status} {...register('status')}>
              {PAYSLIP_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`payroll.payslipStatusOptions.${s}`)}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            {/* Basic salary */}
            <Field
              label={t('payroll.payslip.form.basicSalary')}
              htmlFor="basic_salary"
              required
              error={translate(t, errors.basic_salary?.message)}
            >
              <Input id="basic_salary" type="number" min="0" invalid={!!errors.basic_salary} {...register('basic_salary')} />
            </Field>

            {/* Gross salary */}
            <Field
              label={t('payroll.payslip.form.grossSalary')}
              htmlFor="gross_salary"
              required
              error={translate(t, errors.gross_salary?.message)}
            >
              <Input id="gross_salary" type="number" min="0" invalid={!!errors.gross_salary} {...register('gross_salary')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Total earnings */}
            <Field
              label={t('payroll.payslip.form.totalEarnings')}
              htmlFor="total_earnings"
              required
              error={translate(t, errors.total_earnings?.message)}
            >
              <Input id="total_earnings" type="number" min="0" invalid={!!errors.total_earnings} {...register('total_earnings')} />
            </Field>

            {/* Total deductions */}
            <Field
              label={t('payroll.payslip.form.totalDeductions')}
              htmlFor="payslip_total_deductions"
              required
              error={translate(t, errors.total_deductions?.message)}
            >
              <Input id="payslip_total_deductions" type="number" min="0" invalid={!!errors.total_deductions} {...register('total_deductions')} />
            </Field>
          </div>

          {/* Net salary */}
          <Field
            label={t('payroll.payslip.form.netSalary')}
            htmlFor="net_salary"
            required
            error={translate(t, errors.net_salary?.message)}
          >
            <Input id="net_salary" type="number" min="0" invalid={!!errors.net_salary} {...register('net_salary')} />
          </Field>

          <div className="grid grid-cols-3 gap-4">
            {/* Working days */}
            <Field
              label={t('payroll.payslip.form.workingDays')}
              htmlFor="working_days"
              error={translate(t, errors.working_days?.message)}
            >
              <Input id="working_days" type="number" min="0" step="0.1" invalid={!!errors.working_days} {...register('working_days')} />
            </Field>

            {/* Present days */}
            <Field
              label={t('payroll.payslip.form.presentDays')}
              htmlFor="present_days"
              error={translate(t, errors.present_days?.message)}
            >
              <Input id="present_days" type="number" min="0" step="0.1" invalid={!!errors.present_days} {...register('present_days')} />
            </Field>

            {/* Absent days */}
            <Field
              label={t('payroll.payslip.form.absentDays')}
              htmlFor="absent_days"
              error={translate(t, errors.absent_days?.message)}
            >
              <Input id="absent_days" type="number" min="0" step="0.1" invalid={!!errors.absent_days} {...register('absent_days')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Overtime hours */}
            <Field
              label={t('payroll.payslip.form.overtimeHours')}
              htmlFor="overtime_hours"
              error={translate(t, errors.overtime_hours?.message)}
            >
              <Input id="overtime_hours" type="number" min="0" step="0.01" invalid={!!errors.overtime_hours} {...register('overtime_hours')} />
            </Field>

            {/* Overtime amount */}
            <Field
              label={t('payroll.payslip.form.overtimeAmount')}
              htmlFor="overtime_amount"
              error={translate(t, errors.overtime_amount?.message)}
            >
              <Input id="overtime_amount" type="number" min="0" invalid={!!errors.overtime_amount} {...register('overtime_amount')} />
            </Field>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
