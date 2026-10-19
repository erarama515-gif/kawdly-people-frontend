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
import { usePromoteEmployee } from '../api/queries';
import {
  useJobPositionList,
  useJobGradeList,
  useJobLevelList,
} from '@/features/organization/api/queries';
import type { EmployeeWire } from '../api/schema';

/**
 * `POST /employees/{id}/promote` — updates job position/grade/level,
 * exactly the fields `EmployeeLifecycleService::promote()` writes. All three
 * target fields are optional on the backend (a promotion might only bump the
 * grade, for instance); `effective_date` is the only required field.
 */

const REQUIRED = 'common.requiredField';

const promoteFormSchema = z.object({
  new_job_position_id: z.string(),
  new_job_grade_id: z.string(),
  new_job_level_id: z.string(),
  effective_date: z.string().min(1, REQUIRED),
  reason: z.string().max(500),
});

type PromoteFormValues = z.infer<typeof promoteFormSchema>;

function defaultValues(employee: EmployeeWire | undefined): PromoteFormValues {
  return {
    new_job_position_id: employee ? String(employee.job_position_id) : '',
    new_job_grade_id: employee?.job_grade_id !== undefined ? String(employee.job_grade_id) : '',
    new_job_level_id: employee?.job_level_id !== undefined ? String(employee.job_level_id) : '',
    effective_date: new Date().toISOString().slice(0, 10),
    reason: '',
  };
}

function translate(t: TFunction, message: string | undefined): string | undefined {
  return message ? t(message) : undefined;
}

export interface EmployeePromoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeWire;
}

export function EmployeePromoteDialog({ open, onOpenChange, employee }: EmployeePromoteDialogProps) {
  const { t } = useTranslation();
  const mutation = usePromoteEmployee();
  const resolver = useMemo(() => zodResolver(promoteFormSchema), []);

  const { state: positionState } = useJobPositionList({ page: 1, perPage: 200 });
  const positions = positionState.data?.data ?? [];
  const { state: jobGradeState } = useJobGradeList({ page: 1, perPage: 200 });
  const jobGrades = jobGradeState.data?.data ?? [];
  const { state: jobLevelState } = useJobLevelList({ page: 1, perPage: 200 });
  const jobLevels = jobLevelState.data?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PromoteFormValues>({ resolver, defaultValues: defaultValues(employee) });

  useEffect(() => {
    if (open) reset(defaultValues(employee));
  }, [open, employee, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) mutation.reset();
    onOpenChange(next);
  }

  async function onSubmit(values: PromoteFormValues) {
    const result = await mutation.mutate({
      id: employee.id,
      new_job_position_id: values.new_job_position_id ? Number(values.new_job_position_id) : null,
      new_job_grade_id: values.new_job_grade_id ? Number(values.new_job_grade_id) : null,
      new_job_level_id: values.new_job_level_id ? Number(values.new_job_level_id) : null,
      effective_date: values.effective_date,
      reason: values.reason.trim() || null,
    });

    if (result !== undefined) {
      toast.success('employees.promoteSuccess');
      handleOpenChange(false);
      return;
    }
    toast.error(userFacingMessage(mutation.error) || 'employees.promoteFailed');
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={t('employees.promoteAction')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={mutation.isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="employee-promote-form" variant="primary" isLoading={mutation.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="employee-promote-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutation.error ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutation.error)}
            </p>
          ) : null}

          <Field label={t('employees.form.newJobPosition')} htmlFor="new_job_position_id">
            <Select id="new_job_position_id" {...register('new_job_position_id')}>
              <option value="">{t('common.selectPlaceholder')}</option>
              {positions.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.title}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label={t('employees.form.newJobGrade')} htmlFor="new_job_grade_id">
              <Select id="new_job_grade_id" {...register('new_job_grade_id')}>
                <option value="">{t('common.selectPlaceholder')}</option>
                {jobGrades.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('employees.form.newJobLevel')} htmlFor="new_job_level_id">
              <Select id="new_job_level_id" {...register('new_job_level_id')}>
                <option value="">{t('common.selectPlaceholder')}</option>
                {jobLevels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

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
