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
import { useCreateEmployeeSalary, useUpdateEmployeeSalary } from '@/features/payroll/api/queries';
import type { EmployeeSalaryInput } from '@/features/payroll/api/resource';
import type { EmployeeSalaryWire } from '@/features/payroll/api/schema';
import { useSalaryStructureList } from '../api/queries';

/**
 * Add/Edit modal for one EmployeeSalary assignment — "which salary structure
 * template applies to this employee, from which date". Built on Dialog +
 * react-hook-form + zod, same pattern as every other feature form dialog.
 *
 * Confirmed fields from StoreEmployeeSalaryRequest.php: employee_id (req FK),
 * salary_structure_id (req FK), effective_date (req date), components (req
 * array — always submitted as `[]`; there is no line-item editor for it yet),
 * gross_salary (req int), net_salary (req int), is_current (nullable bool).
 *
 * Pickers:
 *   - Employee: cross-feature `useEmployeeList` (same convention as Payslip/
 *     Department form dialogs).
 *   - Salary structure: same-feature `useSalaryStructureList`.
 */

const REQUIRED = 'common.requiredField';

const employeeSalaryFormSchema = z.object({
  employee_id: z.string().min(1, REQUIRED),
  salary_structure_id: z.string().min(1, REQUIRED),
  effective_date: z.string().min(1, REQUIRED),
  gross_salary: z.string().min(1, REQUIRED),
  net_salary: z.string().min(1, REQUIRED),
  is_current: z.string(),
});

type EmployeeSalaryFormValues = z.infer<typeof employeeSalaryFormSchema>;

function buildDefaultValues(record: EmployeeSalaryWire | undefined): EmployeeSalaryFormValues {
  if (!record) {
    return {
      employee_id: '',
      salary_structure_id: '',
      effective_date: '',
      gross_salary: '',
      net_salary: '',
      is_current: 'true',
    };
  }
  return {
    employee_id: String(record.employee_id),
    salary_structure_id: String(record.salary_structure_id),
    effective_date: record.effective_date.slice(0, 10),
    gross_salary: record.gross_salary != null ? String(record.gross_salary) : '',
    net_salary: record.net_salary != null ? String(record.net_salary) : '',
    is_current: record.is_current === false ? 'false' : 'true',
  };
}

function toEmployeeSalaryInput(
  values: EmployeeSalaryFormValues,
  existingComponents?: unknown[]
): EmployeeSalaryInput {
  return {
    employee_id: Number(values.employee_id),
    salary_structure_id: Number(values.salary_structure_id),
    effective_date: values.effective_date,
    components: existingComponents ?? [],
    gross_salary: Number(values.gross_salary),
    net_salary: Number(values.net_salary),
    is_current: values.is_current === 'false' ? false : true,
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

export interface EmployeeSalaryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit (or pass `undefined`) to open in "Add Assignment" mode. */
  record?: EmployeeSalaryWire | undefined;
}

export function EmployeeSalaryFormDialog({ open, onOpenChange, record }: EmployeeSalaryFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = record !== undefined;

  const createMutation = useCreateEmployeeSalary();
  const updateMutation = useUpdateEmployeeSalary();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  // Employee picker: stable cross-feature hook (same as Payslip/Department forms).
  const { state: employeeState } = useEmployeeList({ page: 1, perPage: 100 });
  const employees = employeeState.data?.data ?? [];

  // Salary structure picker: full unpaginated list (structures are small in number).
  const { state: structureState } = useSalaryStructureList({ page: 1, perPage: 100 });
  const structures = structureState.data?.data ?? [];

  const resolver = useMemo(() => zodResolver(employeeSalaryFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<EmployeeSalaryFormValues>({
    resolver,
    defaultValues: buildDefaultValues(record),
  });

  useEffect(() => {
    if (open) reset(buildDefaultValues(record));
  }, [open, record, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: EmployeeSalaryFormValues) {
    const input = toEmployeeSalaryInput(values, record?.components);
    const result = isEdit
      ? await updateMutation.mutate({ id: record.id, ...input })
      : await createMutation.mutate(input);

    if (result) {
      handleOpenChange(false);
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof EmployeeSalaryFormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('compensation.employeeSalary.editTitle') : t('compensation.employeeSalary.addTitle')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="employee-salary-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="employee-salary-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutationError ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          {/* Employee picker */}
          <Field
            label={t('compensation.employeeSalary.form.employee')}
            htmlFor="es_employee_id"
            required
            error={translate(t, errors.employee_id?.message)}
          >
            <Select id="es_employee_id" invalid={!!errors.employee_id} {...register('employee_id')}>
              <option value="">{t('common.selectPlaceholder')}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} — {emp.employee_number}
                </option>
              ))}
            </Select>
          </Field>

          {/* Salary structure picker */}
          <Field
            label={t('compensation.employeeSalary.form.structure')}
            htmlFor="es_salary_structure_id"
            required
            error={translate(t, errors.salary_structure_id?.message)}
          >
            <Select id="es_salary_structure_id" invalid={!!errors.salary_structure_id} {...register('salary_structure_id')}>
              <option value="">{t('common.selectPlaceholder')}</option>
              {structures.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>

          {/* Effective date */}
          <Field
            label={t('compensation.employeeSalary.form.effectiveDate')}
            htmlFor="es_effective_date"
            required
            error={translate(t, errors.effective_date?.message)}
          >
            <Input id="es_effective_date" type="date" invalid={!!errors.effective_date} {...register('effective_date')} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            {/* Gross salary */}
            <Field
              label={t('compensation.employeeSalary.form.grossSalary')}
              htmlFor="es_gross_salary"
              required
              error={translate(t, errors.gross_salary?.message)}
            >
              <Input id="es_gross_salary" type="number" min="0" invalid={!!errors.gross_salary} {...register('gross_salary')} />
            </Field>

            {/* Net salary */}
            <Field
              label={t('compensation.employeeSalary.form.netSalary')}
              htmlFor="es_net_salary"
              required
              error={translate(t, errors.net_salary?.message)}
            >
              <Input id="es_net_salary" type="number" min="0" invalid={!!errors.net_salary} {...register('net_salary')} />
            </Field>
          </div>

          {/* Current status */}
          <Field
            label={t('compensation.employeeSalary.form.isCurrent')}
            htmlFor="es_is_current"
            error={translate(t, errors.is_current?.message)}
          >
            <Select id="es_is_current" invalid={!!errors.is_current} {...register('is_current')}>
              <option value="true">{t('compensation.employeeSalary.form.currentOption')}</option>
              <option value="false">{t('compensation.employeeSalary.form.historicalOption')}</option>
            </Select>
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
