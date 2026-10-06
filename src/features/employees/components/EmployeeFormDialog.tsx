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
import {
  BRANCHES,
  COMPANY_ID,
  DEPARTMENTS,
  JOB_GRADES,
  JOB_LEVELS,
  positionsForDepartment,
} from '../orgLookup';
import { useCreateEmployee, useUpdateEmployee } from '../api/queries';
import type {
  EmployeeGender,
  EmployeeInput,
  EmployeeMaritalStatus,
  EmployeeStatus,
  EmploymentType,
  WorkLocation,
} from '../api/resource';
import type { EmployeeWire } from '../api/schema';

/**
 * Add/Edit modal for one employee, built on `Dialog` + react-hook-form + zod —
 * the library combination explicitly chosen for this module. Every control
 * below the hood is a plain string (native `<select>`/`<input>` values are
 * always strings); validation runs on those strings, and `toEmployeeInput`
 * does the one-time conversion to the wire-shaped `EmployeeInput` on submit.
 *
 * Validation messages are translation keys, not literal copy — `fieldError`
 * resolves them through `t()` at render time so the same schema works for
 * both locales without being rebuilt per render.
 */

const REQUIRED = 'common.requiredField';
const INVALID_EMAIL = 'common.invalidEmail';

const EMPLOYMENT_TYPES: readonly EmploymentType[] = ['full_time', 'part_time', 'contract', 'intern'];
const WORK_LOCATIONS: readonly WorkLocation[] = ['office', 'remote', 'hybrid'];
const GENDERS: readonly EmployeeGender[] = ['male', 'female'];
const MARITAL_STATUSES: readonly EmployeeMaritalStatus[] = ['single', 'married', 'divorced', 'widowed'];
const EDIT_STATUSES: readonly EmployeeStatus[] = ['active', 'on_leave', 'suspended', 'terminated', 'resigned'];

const employeeFormSchema = z.object({
  first_name: z.string().trim().min(1, REQUIRED).max(100),
  last_name: z.string().trim().min(1, REQUIRED).max(100),
  first_name_ar: z.string().trim().max(100),
  last_name_ar: z.string().trim().max(100),
  employee_number: z.string().trim().min(1, REQUIRED).max(50),
  email: z.union([z.literal(''), z.string().trim().email(INVALID_EMAIL)]),
  phone: z.string().trim().max(30),
  branch_id: z.string().min(1, REQUIRED),
  department_id: z.string().min(1, REQUIRED),
  job_position_id: z.string().min(1, REQUIRED),
  job_grade_id: z.string(),
  job_level_id: z.string(),
  employment_type: z.string().min(1, REQUIRED),
  work_location: z.string().min(1, REQUIRED),
  gender: z.string(),
  marital_status: z.string(),
  joining_date: z.string().min(1, REQUIRED),
  status: z.string(),
});

type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

function buildDefaultValues(employee: EmployeeWire | undefined): EmployeeFormValues {
  if (!employee) {
    return {
      first_name: '',
      last_name: '',
      first_name_ar: '',
      last_name_ar: '',
      employee_number: '',
      email: '',
      phone: '',
      branch_id: BRANCHES[0] ? String(BRANCHES[0].id) : '',
      department_id: '',
      job_position_id: '',
      job_grade_id: '',
      job_level_id: '',
      employment_type: 'full_time',
      work_location: 'office',
      gender: '',
      marital_status: '',
      joining_date: new Date().toISOString().slice(0, 10),
      status: 'active',
    };
  }

  return {
    first_name: employee.first_name,
    last_name: employee.last_name,
    first_name_ar: employee.first_name_ar ?? '',
    last_name_ar: employee.last_name_ar ?? '',
    employee_number: employee.employee_number,
    email: employee.email ?? '',
    phone: employee.phone ?? '',
    branch_id: String(employee.branch_id),
    department_id: String(employee.department_id),
    job_position_id: String(employee.job_position_id),
    job_grade_id: employee.job_grade_id !== undefined ? String(employee.job_grade_id) : '',
    job_level_id: employee.job_level_id !== undefined ? String(employee.job_level_id) : '',
    employment_type: employee.employment_type,
    work_location: employee.work_location,
    gender: employee.gender ?? '',
    marital_status: employee.marital_status ?? '',
    joining_date: employee.joining_date.slice(0, 10),
    status: employee.status,
  };
}

function toEmployeeInput(values: EmployeeFormValues): EmployeeInput {
  return {
    company_id: COMPANY_ID,
    branch_id: Number(values.branch_id),
    department_id: Number(values.department_id),
    job_position_id: Number(values.job_position_id),
    job_grade_id: values.job_grade_id ? Number(values.job_grade_id) : null,
    job_level_id: values.job_level_id ? Number(values.job_level_id) : null,
    employee_number: values.employee_number.trim(),
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    first_name_ar: values.first_name_ar.trim() || null,
    last_name_ar: values.last_name_ar.trim() || null,
    email: values.email.trim() || null,
    phone: values.phone.trim() || null,
    gender: (values.gender || null) as EmployeeGender | null,
    marital_status: (values.marital_status || null) as EmployeeMaritalStatus | null,
    joining_date: values.joining_date,
    employment_type: values.employment_type as EmploymentType,
    work_location: values.work_location as WorkLocation,
    status: (values.status || 'active') as EmployeeStatus,
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

export interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit (or pass `undefined`) to open in "Add Employee" mode. */
  employee?: EmployeeWire | undefined;
}

export function EmployeeFormDialog({ open, onOpenChange, employee }: EmployeeFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = employee !== undefined;

  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  const resolver = useMemo(() => zodResolver(employeeFormSchema), []);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    setError,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver,
    defaultValues: buildDefaultValues(employee),
  });

  // Re-seed the form every time the dialog opens — for the same employee on a
  // second open, and to clear a previous submission's values when switching
  // from "Edit" back to "Add".
  useEffect(() => {
    if (open) reset(buildDefaultValues(employee));
  }, [open, employee, reset]);

  const departmentId = watch('department_id');
  const positions = useMemo(
    () => positionsForDepartment(departmentId ? Number(departmentId) : undefined),
    [departmentId],
  );

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: EmployeeFormValues) {
    const input = toEmployeeInput(values);
    const result = isEdit
      ? await updateMutation.mutate({ id: employee.id, ...input })
      : await createMutation.mutate(input);

    if (result) {
      handleOpenChange(false);
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof EmployeeFormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('employees.editEmployee') : t('employees.addEmployee')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="employee-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="employee-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutationError ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <Field label={t('employees.form.firstName')} htmlFor="first_name" required error={translate(t, errors.first_name?.message)}>
              <Input id="first_name" invalid={!!errors.first_name} {...register('first_name')} />
            </Field>
            <Field label={t('employees.form.lastName')} htmlFor="last_name" required error={translate(t, errors.last_name?.message)}>
              <Input id="last_name" invalid={!!errors.last_name} {...register('last_name')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label={t('employees.form.firstNameAr')} htmlFor="first_name_ar" error={translate(t, errors.first_name_ar?.message)}>
              <Input id="first_name_ar" dir="rtl" invalid={!!errors.first_name_ar} {...register('first_name_ar')} />
            </Field>
            <Field label={t('employees.form.lastNameAr')} htmlFor="last_name_ar" error={translate(t, errors.last_name_ar?.message)}>
              <Input id="last_name_ar" dir="rtl" invalid={!!errors.last_name_ar} {...register('last_name_ar')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('employees.form.employeeNumber')}
              htmlFor="employee_number"
              required
              error={translate(t, errors.employee_number?.message)}
            >
              <Input id="employee_number" invalid={!!errors.employee_number} {...register('employee_number')} />
            </Field>
            <Field label={t('employees.form.email')} htmlFor="email" error={translate(t, errors.email?.message)}>
              <Input id="email" type="email" invalid={!!errors.email} {...register('email')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label={t('employees.form.phone')} htmlFor="phone" error={translate(t, errors.phone?.message)}>
              <Input id="phone" invalid={!!errors.phone} {...register('phone')} />
            </Field>
            <Field
              label={t('employees.form.joiningDate')}
              htmlFor="joining_date"
              required
              error={translate(t, errors.joining_date?.message)}
            >
              <Input id="joining_date" type="date" invalid={!!errors.joining_date} {...register('joining_date')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label={t('employees.form.branch')} htmlFor="branch_id" required error={translate(t, errors.branch_id?.message)}>
              <Select id="branch_id" invalid={!!errors.branch_id} {...register('branch_id')}>
                {BRANCHES.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t('employees.form.department')}
              htmlFor="department_id"
              required
              error={translate(t, errors.department_id?.message)}
            >
              <Select
                id="department_id"
                invalid={!!errors.department_id}
                {...register('department_id', { onChange: () => setValue('job_position_id', '') })}
              >
                <option value="">{t('common.selectPlaceholder')}</option>
                {DEPARTMENTS.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('employees.form.jobPosition')}
              htmlFor="job_position_id"
              required
              error={translate(t, errors.job_position_id?.message)}
            >
              <Select id="job_position_id" invalid={!!errors.job_position_id} {...register('job_position_id')}>
                <option value="">{t('common.selectPlaceholder')}</option>
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('employees.form.jobGrade')} htmlFor="job_grade_id" error={translate(t, errors.job_grade_id?.message)}>
              <Select id="job_grade_id" invalid={!!errors.job_grade_id} {...register('job_grade_id')}>
                <option value="">{t('common.selectPlaceholder')}</option>
                {JOB_GRADES.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label={t('employees.form.jobLevel')} htmlFor="job_level_id" error={translate(t, errors.job_level_id?.message)}>
              <Select id="job_level_id" invalid={!!errors.job_level_id} {...register('job_level_id')}>
                <option value="">{t('common.selectPlaceholder')}</option>
                {JOB_LEVELS.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t('employees.form.employmentType')}
              htmlFor="employment_type"
              required
              error={translate(t, errors.employment_type?.message)}
            >
              <Select id="employment_type" invalid={!!errors.employment_type} {...register('employment_type')}>
                {EMPLOYMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`employees.form.employmentType.${type}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('employees.form.workLocation')}
              htmlFor="work_location"
              required
              error={translate(t, errors.work_location?.message)}
            >
              <Select id="work_location" invalid={!!errors.work_location} {...register('work_location')}>
                {WORK_LOCATIONS.map((location) => (
                  <option key={location} value={location}>
                    {t(`employees.form.workLocation.${location}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('employees.form.gender')} htmlFor="gender" error={translate(t, errors.gender?.message)}>
              <Select id="gender" invalid={!!errors.gender} {...register('gender')}>
                <option value="">{t('common.selectPlaceholder')}</option>
                {GENDERS.map((gender) => (
                  <option key={gender} value={gender}>
                    {t(`employees.form.gender.${gender}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('employees.form.maritalStatus')}
              htmlFor="marital_status"
              error={translate(t, errors.marital_status?.message)}
            >
              <Select id="marital_status" invalid={!!errors.marital_status} {...register('marital_status')}>
                <option value="">{t('common.selectPlaceholder')}</option>
                {MARITAL_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(`employees.form.maritalStatus.${status}`)}
                  </option>
                ))}
              </Select>
            </Field>

            {isEdit ? (
              <Field label={t('employees.form.status')} htmlFor="status" error={translate(t, errors.status?.message)}>
                <Select id="status" invalid={!!errors.status} {...register('status')}>
                  {EDIT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {t(`employees.status.${status}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
