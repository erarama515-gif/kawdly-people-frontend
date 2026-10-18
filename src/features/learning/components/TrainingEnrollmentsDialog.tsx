import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SkeletonTable } from '@/components/ui/SkeletonTable';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { userFacingMessage } from '@/lib/api/errors';
import type { ApiError } from '@/lib/api/errors';
import { useEmployeeList } from '@/features/employees/api/queries';
import {
  useTrainingEnrollmentList,
  useCreateTrainingEnrollment,
  useUpdateTrainingEnrollment,
  useDeleteTrainingEnrollment,
} from '../api/queries';
import type { TrainingEnrollmentInput, TrainingEnrollmentStatus } from '../api/resource';
import type { TrainingEnrollmentWire, TrainingProgramWire } from '../api/schema';

/**
 * Per-training-program enrollment breakdown — opened from the TrainingProgram
 * row's "enrollments" action in LearningPage. One Dialog, two internal modes,
 * exact same shape as `PayslipItemsDialog` in the Payroll module:
 *   - 'list': cards of every TrainingEnrollment row for this program, with
 *     edit/delete row actions, plus an "Add Enrollment" button.
 *   - 'form': inline add/edit form for a single enrollment, replacing the
 *     list body.
 *
 * Scoped entirely to `trainingProgram.id`.
 */

const REQUIRED = 'common.requiredField';
const ENROLLMENT_STATUSES: readonly TrainingEnrollmentStatus[] = [
  'enrolled',
  'attended',
  'completed',
  'no_show',
  'cancelled',
];
const ENROLLMENTS_PER_PAGE = 50;

const enrollmentFormSchema = z.object({
  employee_id: z.string().min(1, REQUIRED),
  status: z.string(),
  score: z.string(),
  certificate_path: z.string(),
  feedback: z.string(),
  feedback_rating: z.string(),
});

type EnrollmentFormValues = z.infer<typeof enrollmentFormSchema>;

function buildDefaultValues(record: TrainingEnrollmentWire | undefined): EnrollmentFormValues {
  if (!record) {
    return {
      employee_id: '',
      status: 'enrolled',
      score: '',
      certificate_path: '',
      feedback: '',
      feedback_rating: '',
    };
  }
  return {
    employee_id: String(record.employee_id),
    status: record.status ?? 'enrolled',
    score: record.score !== undefined ? String(record.score) : '',
    certificate_path: record.certificate_path ?? '',
    feedback: record.feedback ?? '',
    feedback_rating: record.feedback_rating !== undefined ? String(record.feedback_rating) : '',
  };
}

function toInput(values: EnrollmentFormValues, trainingProgramId: number): TrainingEnrollmentInput {
  return {
    training_program_id: trainingProgramId,
    employee_id: Number(values.employee_id),
    status: (values.status as TrainingEnrollmentStatus) || null,
    score: values.score.trim() ? Number(values.score) : null,
    certificate_path: values.certificate_path.trim() || null,
    feedback: values.feedback.trim() || null,
    feedback_rating: values.feedback_rating.trim() ? Number(values.feedback_rating) : null,
  };
}

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

const STATUS_CLASSES: Record<TrainingEnrollmentStatus, string> = {
  enrolled: 'bg-sky-50 text-sky-700',
  attended: 'bg-violet-50 text-violet-700',
  completed: 'bg-emerald-50 text-emerald-700',
  no_show: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-red-50 text-red-700',
};

function StatusBadge({ status }: { status: TrainingEnrollmentStatus | undefined }) {
  const { t } = useTranslation();
  if (!status) return null;
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', STATUS_CLASSES[status])}>
      {t(`learning.enrollmentStatusOptions.${status}`)}
    </span>
  );
}

export interface TrainingEnrollmentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainingProgram: TrainingProgramWire | undefined;
}

export function TrainingEnrollmentsDialog({
  open,
  onOpenChange,
  trainingProgram,
}: TrainingEnrollmentsDialogProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editTarget, setEditTarget] = useState<TrainingEnrollmentWire | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<TrainingEnrollmentWire | undefined>(undefined);

  const programId = trainingProgram?.id;

  const listParams = useMemo(
    () => ({ page: 1, perPage: ENROLLMENTS_PER_PAGE, training_program_id: programId }),
    [programId],
  );
  const { state, refetch } = useTrainingEnrollmentList(listParams, programId !== undefined);
  const deleteMutation = useDeleteTrainingEnrollment(listParams);
  const createMutation = useCreateTrainingEnrollment();
  const updateMutation = useUpdateTrainingEnrollment();
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  // Employee picker — same convention as every other cross-feature employee select.
  const { state: employeeState } = useEmployeeList({ page: 1, perPage: 100 });
  const employees = employeeState.data?.data ?? [];

  const records = state.data?.data ?? [];
  const isEdit = editTarget !== undefined;

  const resolver = useMemo(() => zodResolver(enrollmentFormSchema), []);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<EnrollmentFormValues>({ resolver, defaultValues: buildDefaultValues(undefined) });

  useEffect(() => {
    if (!open) return;
    setMode('list');
    setEditTarget(undefined);
    setDeleteTarget(undefined);
  }, [open, programId]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  function openAddForm() {
    setEditTarget(undefined);
    reset(buildDefaultValues(undefined));
    setMode('form');
  }

  function openEditForm(record: TrainingEnrollmentWire) {
    setEditTarget(record);
    reset(buildDefaultValues(record));
    setMode('form');
  }

  function backToList() {
    createMutation.reset();
    updateMutation.reset();
    setMode('list');
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await deleteMutation.mutate(deleteTarget.id);
    if (result !== undefined || deleteMutation.error === undefined) setDeleteTarget(undefined);
  }

  async function onSubmit(values: EnrollmentFormValues) {
    if (!programId) return;
    const input = toInput(values, programId);
    const result = isEdit
      ? await updateMutation.mutate({ id: editTarget.id, ...input })
      : await createMutation.mutate(input);

    if (result) {
      void refetch();
      setMode('list');
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof EnrollmentFormValues, { type: 'server', message });
    }
  }

  function employeeName(employeeId: number, ref: TrainingEnrollmentWire['employee']): string {
    if (ref) return `${ref.first_name} ${ref.last_name}`;
    const found = employees.find((e) => e.id === employeeId);
    return found ? `${found.first_name} ${found.last_name}` : `#${employeeId}`;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={t('learning.enrollment.dialogTitle', { name: trainingProgram?.title ?? '' })}
        className="w-[min(680px,calc(100vw-32px))]"
        footer={
          mode === 'list' ? (
            <DialogClose asChild>
              <Button variant="secondary">{t('common.close')}</Button>
            </DialogClose>
          ) : (
            <>
              <Button variant="secondary" disabled={isSaving} onClick={backToList}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" form="training-enrollment-form" variant="primary" isLoading={isSaving}>
                {t('common.save')}
              </Button>
            </>
          )
        }
      >
        {mode === 'list' ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-end">
              <Button variant="primary" onClick={openAddForm}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                {t('learning.enrollment.add')}
              </Button>
            </div>

            {state.error ? (
              <Card className="flex items-center justify-between gap-3 px-4 py-3 text-body-sm text-coral">
                <span>{userFacingMessage(state.error) || t('learning.enrollment.loadFailed')}</span>
                <Button variant="secondary" onClick={() => void refetch()}>
                  {t('common.retry')}
                </Button>
              </Card>
            ) : null}

            {state.status === 'pending' && records.length === 0 ? <SkeletonTable /> : null}

            {state.status !== 'pending' && records.length === 0 ? (
              <Card className="px-4 py-8 text-center text-body-sm text-ink-muted">
                {t('learning.enrollment.empty')}
              </Card>
            ) : null}

            {records.length > 0 ? (
              <div className="flex flex-col gap-2">
                {records.map((rec) => (
                  <Card key={rec.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm font-semibold text-ink">
                        {employeeName(rec.employee_id, rec.employee)}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <StatusBadge status={rec.status} />
                        {rec.score !== undefined ? (
                          <span className="nums font-mono text-caption text-ink-muted">
                            {t('learning.enrollment.scoreShort', { score: rec.score })}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        className="h-7 w-7 px-0"
                        aria-label={t('learning.enrollment.editAction')}
                        onClick={() => openEditForm(rec)}
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-7 w-7 px-0 hover:!text-coral"
                        aria-label={t('learning.enrollment.deleteAction')}
                        onClick={() => setDeleteTarget(rec)}
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <form
            id="training-enrollment-form"
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            {mutationError ? (
              <p
                role="alert"
                className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral"
              >
                {userFacingMessage(mutationError)}
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <Field
                label={t('learning.enrollment.form.employee')}
                htmlFor="te_employee_id"
                required
                error={translate(t, errors.employee_id?.message)}
              >
                <Select
                  id="te_employee_id"
                  disabled={isEdit}
                  invalid={!!errors.employee_id}
                  {...register('employee_id')}
                >
                  <option value="">{t('common.selectPlaceholder')}</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label={t('learning.enrollment.form.status')}
                htmlFor="te_status"
                error={translate(t, errors.status?.message)}
              >
                <Select id="te_status" invalid={!!errors.status} {...register('status')}>
                  {ENROLLMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`learning.enrollmentStatusOptions.${s}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field
                label={t('learning.enrollment.form.score')}
                htmlFor="te_score"
                error={translate(t, errors.score?.message)}
              >
                <Input
                  id="te_score"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  invalid={!!errors.score}
                  {...register('score')}
                />
              </Field>

              <Field
                label={t('learning.enrollment.form.feedbackRating')}
                htmlFor="te_feedback_rating"
                error={translate(t, errors.feedback_rating?.message)}
              >
                <Input
                  id="te_feedback_rating"
                  type="number"
                  min="1"
                  max="5"
                  invalid={!!errors.feedback_rating}
                  {...register('feedback_rating')}
                />
              </Field>
            </div>

            <Field
              label={t('learning.enrollment.form.certificatePath')}
              htmlFor="te_certificate_path"
              error={translate(t, errors.certificate_path?.message)}
            >
              <Input
                id="te_certificate_path"
                invalid={!!errors.certificate_path}
                {...register('certificate_path')}
              />
            </Field>

            <Field
              label={t('learning.enrollment.form.feedback')}
              htmlFor="te_feedback"
              error={translate(t, errors.feedback?.message)}
            >
              <Textarea id="te_feedback" rows={3} invalid={!!errors.feedback} {...register('feedback')} />
            </Field>
          </form>
        )}
      </DialogContent>

      <ConfirmDialog
        open={deleteTarget !== undefined}
        onOpenChange={(o) => !o && setDeleteTarget(undefined)}
        title={t('learning.enrollment.deleteConfirm.title')}
        description={
          deleteTarget
            ? t('learning.enrollment.deleteConfirm.description', {
                name: employeeName(deleteTarget.employee_id, deleteTarget.employee),
              })
            : undefined
        }
        isLoading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </Dialog>
  );
}
