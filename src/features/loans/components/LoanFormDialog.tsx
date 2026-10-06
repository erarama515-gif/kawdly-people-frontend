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
import { useEmployeeList } from '@/features/employees/api/queries';
import { useCreateLoan, useUpdateLoan } from '../api/queries';
import type { LoanInput, LoanStatus, LoanType } from '../api/resource';
import type { LoanWire } from '../api/schema';

/**
 * Add/Edit modal for one loan record, built on `Dialog` + react-hook-form +
 * zod — same library combination as `ContractFormDialog`.
 *
 * Key points:
 *  - Employee picker: native `<select>` fed by `useEmployeeList({ page:1, perPage:100 })`.
 *  - All form fields are plain strings; `toLoanInput()` converts on valid submit.
 *  - Save button is outside the `<form>` DOM element but wired via the HTML5
 *    `form="loan-form"` attribute (required because Dialog renders its footer
 *    in a separate div).
 *  - `fieldErrorsFrom()` maps Laravel 422 `{errors:{field:[msg]}}` bodies to
 *    RHF `setError` calls.
 */

const REQUIRED = 'common.requiredField';

const LOAN_TYPES: readonly LoanType[] = ['loan', 'advance'];
const LOAN_STATUSES: readonly LoanStatus[] = ['pending', 'active', 'completed', 'cancelled'];

const loanFormSchema = z.object({
  employee_id: z.string().min(1, REQUIRED),
  type: z.string().min(1, REQUIRED),
  amount: z.string().min(1, REQUIRED),
  installment_amount: z.string().min(1, REQUIRED),
  total_installments: z.string().min(1, REQUIRED),
  paid_installments: z.string(),
  remaining_amount: z.string().min(1, REQUIRED),
  start_date: z.string().min(1, REQUIRED),
  status: z.string(),
  reason: z.string(),
});

type LoanFormValues = z.infer<typeof loanFormSchema>;

function buildDefaultValues(loan: LoanWire | undefined): LoanFormValues {
  if (!loan) {
    return {
      employee_id: '',
      type: 'loan',
      amount: '',
      installment_amount: '',
      total_installments: '',
      paid_installments: '0',
      remaining_amount: '',
      start_date: new Date().toISOString().slice(0, 10),
      status: 'pending',
      reason: '',
    };
  }

  return {
    employee_id: String(loan.employee_id),
    type: loan.type,
    amount: String(loan.amount),
    installment_amount: String(loan.installment_amount),
    total_installments: String(loan.total_installments),
    paid_installments: loan.paid_installments !== undefined ? String(loan.paid_installments) : '0',
    remaining_amount: String(loan.remaining_amount),
    start_date: loan.start_date.slice(0, 10),
    status: loan.status ?? 'pending',
    reason: loan.reason ?? '',
  };
}

function toLoanInput(values: LoanFormValues): LoanInput {
  return {
    employee_id: Number(values.employee_id),
    type: values.type as LoanType,
    amount: Number(values.amount),
    installment_amount: Number(values.installment_amount),
    total_installments: Number(values.total_installments),
    paid_installments: values.paid_installments.trim() ? Number(values.paid_installments) : null,
    remaining_amount: Number(values.remaining_amount),
    start_date: values.start_date,
    status: (values.status as LoanStatus) || null,
    reason: values.reason.trim() || null,
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

export interface LoanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit (or pass `undefined`) to open in "Add Loan" mode. */
  loan?: LoanWire | undefined;
}

export function LoanFormDialog({ open, onOpenChange, loan }: LoanFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = loan !== undefined;

  const createMutation = useCreateLoan();
  const updateMutation = useUpdateLoan();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  // Load employee list for the picker (first 100 — enough for the mock data set).
  const { state: empState } = useEmployeeList({ page: 1, perPage: 100 });
  const employees = empState.data?.data ?? [];

  const resolver = useMemo(() => zodResolver(loanFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<LoanFormValues>({
    resolver,
    defaultValues: buildDefaultValues(loan),
  });

  // Re-seed the form every time the dialog opens.
  useEffect(() => {
    if (open) reset(buildDefaultValues(loan));
  }, [open, loan, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: LoanFormValues) {
    const input = toLoanInput(values);
    const result = isEdit
      ? await updateMutation.mutate({ id: loan.id, ...input })
      : await createMutation.mutate(input);

    if (result) {
      handleOpenChange(false);
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof LoanFormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('loans.editLoan') : t('loans.addLoan')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="loan-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="loan-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutationError ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          {/* Employee picker */}
          <Field
            label={t('loans.form.employee')}
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

          <div className="grid grid-cols-2 gap-4">
            {/* Loan type */}
            <Field
              label={t('loans.form.type')}
              htmlFor="type"
              required
              error={translate(t, errors.type?.message)}
            >
              <Select id="type" invalid={!!errors.type} {...register('type')}>
                {LOAN_TYPES.map((lt) => (
                  <option key={lt} value={lt}>
                    {t(`loans.form.typeOptions.${lt}`)}
                  </option>
                ))}
              </Select>
            </Field>

            {/* Status */}
            <Field
              label={t('loans.form.status')}
              htmlFor="status"
              error={translate(t, errors.status?.message)}
            >
              <Select id="status" invalid={!!errors.status} {...register('status')}>
                {LOAN_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`loans.status.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Amount */}
            <Field
              label={t('loans.form.amount')}
              htmlFor="amount"
              required
              error={translate(t, errors.amount?.message)}
            >
              <Input id="amount" type="number" min="0" invalid={!!errors.amount} {...register('amount')} />
            </Field>

            {/* Start date */}
            <Field
              label={t('loans.form.startDate')}
              htmlFor="start_date"
              required
              error={translate(t, errors.start_date?.message)}
            >
              <Input id="start_date" type="date" invalid={!!errors.start_date} {...register('start_date')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Installment amount */}
            <Field
              label={t('loans.form.installmentAmount')}
              htmlFor="installment_amount"
              required
              error={translate(t, errors.installment_amount?.message)}
            >
              <Input id="installment_amount" type="number" min="0" invalid={!!errors.installment_amount} {...register('installment_amount')} />
            </Field>

            {/* Total installments */}
            <Field
              label={t('loans.form.totalInstallments')}
              htmlFor="total_installments"
              required
              error={translate(t, errors.total_installments?.message)}
            >
              <Input id="total_installments" type="number" min="1" invalid={!!errors.total_installments} {...register('total_installments')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Paid installments */}
            <Field
              label={t('loans.form.paidInstallments')}
              htmlFor="paid_installments"
              error={translate(t, errors.paid_installments?.message)}
            >
              <Input id="paid_installments" type="number" min="0" invalid={!!errors.paid_installments} {...register('paid_installments')} />
            </Field>

            {/* Remaining amount */}
            <Field
              label={t('loans.form.remainingAmount')}
              htmlFor="remaining_amount"
              required
              error={translate(t, errors.remaining_amount?.message)}
            >
              <Input id="remaining_amount" type="number" min="0" invalid={!!errors.remaining_amount} {...register('remaining_amount')} />
            </Field>
          </div>

          {/* Reason */}
          <Field
            label={t('loans.form.reason')}
            htmlFor="reason"
            error={translate(t, errors.reason?.message)}
          >
            <Textarea id="reason" rows={2} invalid={!!errors.reason} {...register('reason')} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
