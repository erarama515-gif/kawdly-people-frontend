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
import { toast } from '@/components/ui/Toast';
import { useEmployeeList } from '@/features/employees/api/queries';
import { useDepartmentList, useCreateDepartment, useUpdateDepartment, useCostCenterList } from '../api/queries';
import type { DepartmentInput } from '../api/resource';
import type { DepartmentWire } from '../api/schema';

/**
 * Add/Edit modal for one Department record, built on Dialog + react-hook-form +
 * zod — same library combination as EmployeeFormDialog and AttendanceFormDialog.
 *
 * Confirmed fields from StoreDepartmentRequest.php:
 *   parent_id  (nullable FK → departments — native select, excludes self)
 *   name       (required)
 *   code       (nullable)
 *   head_employee_id (nullable FK → employees — native select with "Vacant")
 *   level / path / sort_order / is_active (all nullable)
 *   cost_center_id (nullable FK → cost_centers — native select, "— No cost center —")
 *
 * Employee picker: `useEmployeeList({ page: 1, perPage: 100 })` feeding
 *   "First Last — EMP-NUMBER" labels, per the cross-feature convention.
 *
 * Footer Save is wired via form="department-form" attribute.
 */

const REQUIRED = 'common.requiredField';

const departmentFormSchema = z.object({
  name: z.string().min(1, REQUIRED).max(255),
  code: z.string().max(20),
  parent_id: z.string(),
  head_employee_id: z.string(),
  cost_center_id: z.string(),
  level: z.string(),
  sort_order: z.string(),
  is_active: z.string(),
});

type DepartmentFormValues = z.infer<typeof departmentFormSchema>;

function buildDefaultValues(dept: DepartmentWire | undefined): DepartmentFormValues {
  if (!dept) {
    return {
      name: '',
      code: '',
      parent_id: '',
      head_employee_id: '',
      cost_center_id: '',
      level: '',
      sort_order: '',
      is_active: 'true',
    };
  }
  return {
    name: dept.name,
    code: dept.code ?? '',
    parent_id: dept.parent_id !== undefined ? String(dept.parent_id) : '',
    head_employee_id: dept.head_employee_id !== undefined ? String(dept.head_employee_id) : '',
    cost_center_id: dept.cost_center_id !== undefined ? String(dept.cost_center_id) : '',
    level: dept.level !== undefined ? String(dept.level) : '',
    sort_order: dept.sort_order !== undefined ? String(dept.sort_order) : '',
    is_active: dept.is_active === false ? 'false' : 'true',
  };
}

function toDepartmentInput(values: DepartmentFormValues): DepartmentInput {
  return {
    name: values.name.trim(),
    code: values.code.trim() || null,
    parent_id: values.parent_id ? Number(values.parent_id) : null,
    head_employee_id: values.head_employee_id ? Number(values.head_employee_id) : null,
    cost_center_id: values.cost_center_id ? Number(values.cost_center_id) : null,
    level: values.level ? Number(values.level) : null,
    sort_order: values.sort_order ? Number(values.sort_order) : null,
    is_active: values.is_active === 'false' ? false : true,
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

export interface DepartmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit (or pass `undefined`) to open in "Add Department" mode. */
  dept?: DepartmentWire | undefined;
}

export function DepartmentFormDialog({ open, onOpenChange, dept }: DepartmentFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = dept !== undefined;

  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  // Employee picker: stable cross-feature hook
  const { state: employeeState } = useEmployeeList({ page: 1, perPage: 100 });
  const employees = employeeState.data?.data ?? [];

  // Parent department picker: full unpaginated list (departments are small)
  const { state: deptListState } = useDepartmentList({ page: 1, perPage: 200 });
  const allDepartments = deptListState.data?.data ?? [];
  // Exclude the record being edited to prevent self-parenting
  const parentOptions = allDepartments.filter((d) => d.id !== dept?.id);

  // Cost center picker: full unpaginated list (cost centers are small)
  const { state: costCenterListState } = useCostCenterList({ page: 1, perPage: 200 });
  const costCenters = costCenterListState.data?.data ?? [];

  const resolver = useMemo(() => zodResolver(departmentFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<DepartmentFormValues>({
    resolver,
    defaultValues: buildDefaultValues(dept),
  });

  // Re-seed the form every time the dialog opens.
  useEffect(() => {
    if (open) reset(buildDefaultValues(dept));
  }, [open, dept, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: DepartmentFormValues) {
    const input = toDepartmentInput(values);
    const result = isEdit
      ? await updateMutation.mutate({ id: dept.id, ...input })
      : await createMutation.mutate(input);

    if (result) {
      toast.success('common.saved');
      handleOpenChange(false);
      return;
    }

    toast.error('common.operationFailed');
    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof DepartmentFormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('organization.department.editTitle') : t('organization.department.addTitle')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="department-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="department-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutationError ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          {/* Name */}
          <Field
            label={t('organization.department.form.name')}
            htmlFor="dept_name"
            required
            error={translate(t, errors.name?.message)}
          >
            <Input id="dept_name" invalid={!!errors.name} {...register('name')} />
          </Field>

          {/* Code */}
          <Field
            label={t('organization.department.form.code')}
            htmlFor="dept_code"
            error={translate(t, errors.code?.message)}
          >
            <Input id="dept_code" invalid={!!errors.code} maxLength={20} {...register('code')} />
          </Field>

          {/* Parent department picker */}
          <Field
            label={t('organization.department.form.parent')}
            htmlFor="dept_parent_id"
            error={translate(t, errors.parent_id?.message)}
          >
            <Select id="dept_parent_id" invalid={!!errors.parent_id} {...register('parent_id')}>
              <option value="">{t('organization.department.form.noParent')}</option>
              {parentOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.code ? ` (${d.code})` : ''}
                </option>
              ))}
            </Select>
          </Field>

          {/* Head employee picker */}
          <Field
            label={t('organization.department.form.head')}
            htmlFor="dept_head_employee_id"
            error={translate(t, errors.head_employee_id?.message)}
          >
            <Select id="dept_head_employee_id" invalid={!!errors.head_employee_id} {...register('head_employee_id')}>
              <option value="">{t('organization.department.form.vacant')}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} — {emp.employee_number}
                </option>
              ))}
            </Select>
          </Field>

          {/* Cost center picker */}
          <Field
            label={t('organization.department.form.costCenter')}
            htmlFor="dept_cost_center_id"
            error={translate(t, errors.cost_center_id?.message)}
          >
            <Select id="dept_cost_center_id" invalid={!!errors.cost_center_id} {...register('cost_center_id')}>
              <option value="">{t('organization.department.form.noCostCenter')}</option>
              {costCenters.map((cc) => (
                <option key={cc.id} value={cc.id}>
                  {cc.name}{cc.code ? ` (${cc.code})` : ''}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            {/* Level */}
            <Field
              label={t('organization.department.form.level')}
              htmlFor="dept_level"
              error={translate(t, errors.level?.message)}
            >
              <Input id="dept_level" type="number" min="0" invalid={!!errors.level} {...register('level')} />
            </Field>

            {/* Sort order */}
            <Field
              label={t('organization.department.form.sortOrder')}
              htmlFor="dept_sort_order"
              error={translate(t, errors.sort_order?.message)}
            >
              <Input id="dept_sort_order" type="number" invalid={!!errors.sort_order} {...register('sort_order')} />
            </Field>
          </div>

          {/* Active status */}
          <Field
            label={t('organization.department.form.isActive')}
            htmlFor="dept_is_active"
            error={translate(t, errors.is_active?.message)}
          >
            <Select id="dept_is_active" invalid={!!errors.is_active} {...register('is_active')}>
              <option value="true">{t('organization.department.form.activeOption')}</option>
              <option value="false">{t('organization.department.form.inactiveOption')}</option>
            </Select>
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
