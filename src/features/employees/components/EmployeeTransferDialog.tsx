import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field, Select, Input, Textarea } from '@/components/ui/form';
import { userFacingMessage } from '@/lib/api/errors';
import { toast } from '@/components/ui/Toast';
import { useEmployeeList, useTransferEmployee } from '../api/queries';
import { useBranchList, useDepartmentList } from '@/features/organization/api/queries';
import type { EmployeeWire } from '../api/schema';

/**
 * `POST /employees/{id}/transfer` — updates branch/department/direct
 * manager, exactly the fields `EmployeeLifecycleService::transfer()` writes.
 * All three target fields are optional on the backend; `effective_date` is
 * the only required field.
 */

const REQUIRED = 'common.requiredField';

const transferFormSchema = z.object({
  new_branch_id: z.string(),
  new_department_id: z.string(),
  new_direct_manager_id: z.string(),
  effective_date: z.string().min(1, REQUIRED),
  reason: z.string().max(500),
});

type TransferFormValues = z.infer<typeof transferFormSchema>;

function defaultValues(employee: EmployeeWire | undefined): TransferFormValues {
  return {
    new_branch_id: employee ? String(employee.branch_id) : '',
    new_department_id: employee ? String(employee.department_id) : '',
    new_direct_manager_id: employee?.direct_manager_id !== undefined ? String(employee.direct_manager_id) : '',
    effective_date: new Date().toISOString().slice(0, 10),
    reason: '',
  };
}

function translate(t: TFunction, message: string | undefined): string | undefined {
  return message ? t(message) : undefined;
}

export interface EmployeeTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeWire;
}

export function EmployeeTransferDialog({ open, onOpenChange, employee }: EmployeeTransferDialogProps) {
  const { t } = useTranslation();
  const mutation = useTransferEmployee();
  const resolver = useMemo(() => zodResolver(transferFormSchema), []);

  // Reuses the same "first 100" employee picker convention as
  // `ContractFormDialog`'s employee select — there is no searchable combobox
  // component in this codebase yet.
  const { state: empState } = useEmployeeList({ page: 1, perPage: 100 });
  const managers = (empState.data?.data ?? []).filter((candidate) => candidate.id !== employee.id);

  const { state: branchState } = useBranchList({ page: 1, perPage: 200 });
  const branches = branchState.data?.data ?? [];
  const { state: departmentState } = useDepartmentList({ page: 1, perPage: 200 });
  const departments = departmentState.data?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TransferFormValues>({ resolver, defaultValues: defaultValues(employee) });

  useEffect(() => {
    if (open) reset(defaultValues(employee));
  }, [open, employee, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) mutation.reset();
    onOpenChange(next);
  }

  async function onSubmit(values: TransferFormValues) {
    const result = await mutation.mutate({
      id: employee.id,
      new_branch_id: values.new_branch_id ? Number(values.new_branch_id) : null,
      new_department_id: values.new_department_id ? Number(values.new_department_id) : null,
      new_direct_manager_id: values.new_direct_manager_id ? Number(values.new_direct_manager_id) : null,
      effective_date: values.effective_date,
      reason: values.reason.trim() || null,
    });

    if (result !== undefined) {
      toast.success('employees.transferSuccess');
      handleOpenChange(false);
      return;
    }
    toast.error(userFacingMessage(mutation.error) || 'employees.transferFailed');
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={t('employees.transferAction')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={mutation.isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="employee-transfer-form" variant="primary" isLoading={mutation.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="employee-transfer-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutation.error ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutation.error)}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <Field label={t('employees.form.newBranch')} htmlFor="new_branch_id">
              <Select id="new_branch_id" {...register('new_branch_id')}>
                <option value="">{t('common.selectPlaceholder')}</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('employees.form.newDepartment')} htmlFor="new_department_id">
              <Select id="new_department_id" {...register('new_department_id')}>
                <option value="">{t('common.selectPlaceholder')}</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label={t('employees.form.newDirectManager')} htmlFor="new_direct_manager_id">
            <Select id="new_direct_manager_id" {...register('new_direct_manager_id')}>
              <option value="">{t('common.selectPlaceholder')}</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.first_name} {manager.last_name} — {manager.employee_number}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={t('employees.form.effectiveDate')}
            htmlFor="effective_date"
            required
            error={translate(t, errors.effective_date?.message)}
          >
            <Input id="effective_date" type="date" invalid={!!errors.effective_date} {...register('effective_date')} />
          </Field>

          <Field label={t('employees.form.reason')} htmlFor="reason" error={translate(t, errors.reason?.message)}>
            <Textarea id="reason" rows={3} invalid={!!errors.reason} {...register('reason')} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
