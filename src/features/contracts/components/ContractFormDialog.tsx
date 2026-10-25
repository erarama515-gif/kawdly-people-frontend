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
import { useEmployeeList } from '@/features/employees/api/queries';
import { useCreateContract, useUpdateContract } from '../api/queries';
import type { ContractInput, ContractStatus, ContractType } from '../api/resource';
import type { ContractWire } from '../api/schema';

/**
 * Add/Edit modal for one contract, built on `Dialog` + react-hook-form + zod.
 *
 * All form fields are plain strings (native `<select>`/`<input>` values).
 * Validation messages are i18n keys resolved via `t()` at render time.
 * `toContractInput()` does the one-time conversion on valid submit.
 * The Save button lives outside the `<form>` DOM-wise but is wired via the
 * HTML5 `form="contract-form"` attribute — exactly like `EmployeeFormDialog`.
 */

const REQUIRED = 'common.requiredField';

const CONTRACT_TYPES: readonly ContractType[] = ['initial', 'renewal', 'amendment'];
const EDIT_STATUSES: readonly ContractStatus[] = ['draft', 'active', 'expired', 'terminated'];

const contractFormSchema = z.object({
  employee_id: z.string().min(1, REQUIRED),
  type: z.string().min(1, REQUIRED),
  start_date: z.string().min(1, REQUIRED),
  end_date: z.string(),
  probation_months: z.string(),
  basic_salary: z.string().min(1, REQUIRED),
  terms: z.string(),
  status: z.string(),
  signed_at: z.string(),
});

type ContractFormValues = z.infer<typeof contractFormSchema>;

function buildDefaultValues(contract: ContractWire | undefined): ContractFormValues {
  if (!contract) {
    return {
      employee_id: '',
      type: 'initial',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: '',
      probation_months: '',
      basic_salary: '',
      terms: '',
      status: 'draft',
      signed_at: '',
    };
  }

  return {
    employee_id: String(contract.employee_id),
    type: contract.type,
    start_date: contract.start_date.slice(0, 10),
    end_date: contract.end_date ? contract.end_date.slice(0, 10) : '',
    probation_months: contract.probation_months !== undefined ? String(contract.probation_months) : '',
    basic_salary: contract.basic_salary != null ? String(contract.basic_salary) : '',
    terms: contract.terms ?? '',
    status: contract.status,
    signed_at: contract.signed_at ? contract.signed_at.slice(0, 10) : '',
  };
}

function toContractInput(values: ContractFormValues): ContractInput {
  return {
    employee_id: Number(values.employee_id),
    type: values.type as ContractType,
    start_date: values.start_date,
    end_date: values.end_date.trim() || null,
    probation_months: values.probation_months.trim() ? Number(values.probation_months) : null,
    basic_salary: Number(values.basic_salary),
    terms: values.terms.trim() || null,
    status: (values.status as ContractStatus) || null,
    signed_at: values.signed_at.trim() || null,
    created_by: getCurrentUserId(),
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

export interface ContractFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit (or pass `undefined`) to open in "Add Contract" mode. */
  contract?: ContractWire | undefined;
}

export function ContractFormDialog({ open, onOpenChange, contract }: ContractFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = contract !== undefined;

  const createMutation = useCreateContract();
  const updateMutation = useUpdateContract();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  // Load employee list for the picker (first 100 — enough for the mock data set).
  const { state: empState } = useEmployeeList({ page: 1, perPage: 100 });
  const employees = empState.data?.data ?? [];

  const resolver = useMemo(() => zodResolver(contractFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ContractFormValues>({
    resolver,
    defaultValues: buildDefaultValues(contract),
  });

  // Re-seed the form every time the dialog opens.
  useEffect(() => {
    if (open) reset(buildDefaultValues(contract));
  }, [open, contract, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: ContractFormValues) {
    const input = toContractInput(values);
    const result = isEdit
      ? await updateMutation.mutate({ id: contract.id, ...input })
      : await createMutation.mutate(input);

    if (result) {
      handleOpenChange(false);
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof ContractFormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('contracts.editContract') : t('contracts.addContract')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="contract-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="contract-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutationError ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          {/* Employee picker */}
          <Field
            label={t('contracts.form.employee')}
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
            {/* Contract type */}
            <Field
              label={t('contracts.form.type')}
              htmlFor="type"
              required
              error={translate(t, errors.type?.message)}
            >
              <Select id="type" invalid={!!errors.type} {...register('type')}>
                {CONTRACT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`contracts.type.${type}`)}
                  </option>
                ))}
              </Select>
            </Field>

            {/* Status — shown in both add and edit modes */}
            <Field
              label={t('contracts.form.status')}
              htmlFor="status"
              error={translate(t, errors.status?.message)}
            >
              <Select id="status" invalid={!!errors.status} {...register('status')}>
                {EDIT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`contracts.status.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Start date */}
            <Field
              label={t('contracts.form.startDate')}
              htmlFor="start_date"
              required
              error={translate(t, errors.start_date?.message)}
            >
              <Input id="start_date" type="date" invalid={!!errors.start_date} {...register('start_date')} />
            </Field>

            {/* End date */}
            <Field
              label={t('contracts.form.endDate')}
              htmlFor="end_date"
              error={translate(t, errors.end_date?.message)}
            >
              <Input id="end_date" type="date" invalid={!!errors.end_date} {...register('end_date')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Basic salary */}
            <Field
              label={t('contracts.form.basicSalary')}
              htmlFor="basic_salary"
              required
              error={translate(t, errors.basic_salary?.message)}
            >
              <Input id="basic_salary" type="number" min="0" invalid={!!errors.basic_salary} {...register('basic_salary')} />
            </Field>

            {/* Probation months */}
            <Field
              label={t('contracts.form.probationMonths')}
              htmlFor="probation_months"
              error={translate(t, errors.probation_months?.message)}
            >
              <Input id="probation_months" type="number" min="0" invalid={!!errors.probation_months} {...register('probation_months')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Signed at */}
            <Field
              label={t('contracts.form.signedAt')}
              htmlFor="signed_at"
              error={translate(t, errors.signed_at?.message)}
            >
              <Input id="signed_at" type="date" invalid={!!errors.signed_at} {...register('signed_at')} />
            </Field>
          </div>

          {/* Terms */}
          <Field
            label={t('contracts.form.terms')}
            htmlFor="terms"
            error={translate(t, errors.terms?.message)}
          >
            <Textarea id="terms" rows={3} invalid={!!errors.terms} {...register('terms')} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
