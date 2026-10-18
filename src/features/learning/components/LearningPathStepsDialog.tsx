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
import {
  useLearningPathStepList,
  useCreateLearningPathStep,
  useUpdateLearningPathStep,
  useDeleteLearningPathStep,
} from '../api/queries';
import type { LearningPathStepInput, LearningPathStepType } from '../api/resource';
import type { LearningPathStepWire, LearningPathWire } from '../api/schema';

/**
 * Per-learning-path step breakdown — opened from the LearningPath row's
 * "steps" action in `LearningPathsTab`. One Dialog, two internal modes, the
 * exact same shape as `TrainingEnrollmentsDialog` / `PayslipItemsDialog`:
 *   - 'list': cards of every LearningPathStep row for this path, with
 *     edit/delete row actions, a type filter, a required filter, and an
 *     "Add Step" button.
 *   - 'form': inline add/edit form for a single step, replacing the list body.
 *
 * Scoped entirely to `learningPath.id`. Mirrors the always-mounted convention:
 * this dialog is rendered unconditionally by its parent, only `open` changes.
 */

const REQUIRED = 'common.requiredField';
const STEP_TYPES: readonly LearningPathStepType[] = [
  'training',
  'certification',
  'experience',
  'competency',
];
const STEPS_PER_PAGE = 100;

const stepFormSchema = z.object({
  title: z.string().trim().min(1, REQUIRED).max(255),
  type: z.string().min(1, REQUIRED),
  description: z.string(),
  reference_id: z.string(),
  sort_order: z.string(),
  is_required: z.string(),
});

type StepFormValues = z.infer<typeof stepFormSchema>;

function buildDefaultValues(record: LearningPathStepWire | undefined): StepFormValues {
  if (!record) {
    return {
      title: '',
      type: 'training',
      description: '',
      reference_id: '',
      sort_order: '',
      is_required: 'true',
    };
  }
  return {
    title: record.title,
    type: record.type,
    description: record.description ?? '',
    reference_id: record.reference_id !== undefined ? String(record.reference_id) : '',
    sort_order: record.sort_order !== undefined ? String(record.sort_order) : '',
    is_required: String(record.is_required ?? false),
  };
}

function toInput(values: StepFormValues, learningPathId: number): LearningPathStepInput {
  return {
    learning_path_id: learningPathId,
    title: values.title.trim(),
    type: values.type as LearningPathStepType,
    description: values.description.trim() || null,
    reference_id: values.reference_id.trim() ? Number(values.reference_id) : null,
    sort_order: values.sort_order.trim() ? Number(values.sort_order) : null,
    is_required: values.is_required === 'true',
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

const TYPE_CLASSES: Record<LearningPathStepType, string> = {
  training: 'bg-sky-50 text-sky-700',
  certification: 'bg-violet-50 text-violet-700',
  experience: 'bg-amber-50 text-amber-700',
  competency: 'bg-emerald-50 text-emerald-700',
};

function TypeBadge({ type }: { type: LearningPathStepType }) {
  const { t } = useTranslation();
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', TYPE_CLASSES[type])}>
      {t(`learning.pathStep.typeOptions.${type}`)}
    </span>
  );
}

function RequiredPill({ value }: { value: boolean | undefined }) {
  const { t } = useTranslation();
  if (value === undefined) return <span className="text-ink-faint">—</span>;
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
        value ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
      )}
    >
      {value ? t('learning.pathStep.required') : t('learning.pathStep.optional')}
    </span>
  );
}

export interface LearningPathStepsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  path: LearningPathWire | undefined;
}

export function LearningPathStepsDialog({ open, onOpenChange, path }: LearningPathStepsDialogProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editTarget, setEditTarget] = useState<LearningPathStepWire | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<LearningPathStepWire | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<LearningPathStepType | 'all'>('all');
  const [requiredFilter, setRequiredFilter] = useState<'all' | 'required' | 'optional'>('all');

  const pathId = path?.id;

  const listParams = useMemo(
    () => ({
      page: 1,
      perPage: STEPS_PER_PAGE,
      learning_path_id: pathId,
      type: typeFilter === 'all' ? undefined : typeFilter,
      is_required: requiredFilter === 'all' ? undefined : requiredFilter === 'required',
    }),
    [pathId, typeFilter, requiredFilter],
  );
  const { state, refetch } = useLearningPathStepList(listParams, pathId !== undefined);
  const deleteMutation = useDeleteLearningPathStep(listParams);
  const createMutation = useCreateLearningPathStep();
  const updateMutation = useUpdateLearningPathStep();
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  const records = state.data?.data ?? [];
  const isEdit = editTarget !== undefined;

  const resolver = useMemo(() => zodResolver(stepFormSchema), []);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<StepFormValues>({ resolver, defaultValues: buildDefaultValues(undefined) });

  useEffect(() => {
    if (!open) return;
    setMode('list');
    setEditTarget(undefined);
    setDeleteTarget(undefined);
    setTypeFilter('all');
    setRequiredFilter('all');
  }, [open, pathId]);

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

  function openEditForm(record: LearningPathStepWire) {
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

  async function onSubmit(values: StepFormValues) {
    if (!pathId) return;
    const input = toInput(values, pathId);
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
      setError(field as keyof StepFormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={t('learning.pathStep.dialogTitle', { name: path?.name ?? '' })}
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
              <Button type="submit" form="learning-path-step-form" variant="primary" isLoading={isSaving}>
                {t('common.save')}
              </Button>
            </>
          )
        }
      >
        {mode === 'list' ? (
          <div className="flex flex-col gap-3">
            {/* Filters + add */}
            <div className="flex flex-wrap items-center gap-2">
              <Select
                className="h-8 w-40 text-[12px]"
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(e.target.value === 'all' ? 'all' : (e.target.value as LearningPathStepType))
                }
                aria-label={t('learning.pathStep.filterByType')}
              >
                <option value="all">{t('learning.pathStep.allTypes')}</option>
                {STEP_TYPES.map((stepType) => (
                  <option key={stepType} value={stepType}>
                    {t(`learning.pathStep.typeOptions.${stepType}`)}
                  </option>
                ))}
              </Select>

              <Select
                className="h-8 w-36 text-[12px]"
                value={requiredFilter}
                onChange={(e) => setRequiredFilter(e.target.value as 'all' | 'required' | 'optional')}
                aria-label={t('learning.pathStep.filterByRequired')}
              >
                <option value="all">{t('learning.pathStep.allSteps')}</option>
                <option value="required">{t('learning.pathStep.requiredOnly')}</option>
                <option value="optional">{t('learning.pathStep.optionalOnly')}</option>
              </Select>

              <Button variant="primary" className="ms-auto" onClick={openAddForm}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                {t('learning.pathStep.add')}
              </Button>
            </div>

            {state.error ? (
              <Card className="flex items-center justify-between gap-3 px-4 py-3 text-body-sm text-coral">
                <span>{userFacingMessage(state.error) || t('learning.pathStep.loadFailed')}</span>
                <Button variant="secondary" onClick={() => void refetch()}>
                  {t('common.retry')}
                </Button>
              </Card>
            ) : null}

            {state.status === 'pending' && records.length === 0 ? <SkeletonTable /> : null}

            {state.status !== 'pending' && records.length === 0 ? (
              <Card className="px-4 py-8 text-center text-body-sm text-ink-muted">
                {t('learning.pathStep.empty')}
              </Card>
            ) : null}

            {records.length > 0 ? (
              <div className="flex flex-col gap-2">
                {records.map((rec) => (
                  <Card key={rec.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="nums font-mono text-caption text-ink-faint">
                      {rec.sort_order !== undefined
                        ? t('learning.pathStep.orderShort', { order: rec.sort_order })
                        : '—'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm font-semibold text-ink">{rec.title}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <TypeBadge type={rec.type} />
                        <RequiredPill value={rec.is_required} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        className="h-7 w-7 px-0"
                        aria-label={t('learning.pathStep.editAction')}
                        onClick={() => openEditForm(rec)}
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-7 w-7 px-0 hover:!text-coral"
                        aria-label={t('learning.pathStep.deleteAction')}
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
            id="learning-path-step-form"
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

            <Field
              label={t('learning.pathStep.form.title')}
              htmlFor="lps_title"
              required
              error={translate(t, errors.title?.message)}
            >
              <Input id="lps_title" invalid={!!errors.title} {...register('title')} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field
                label={t('learning.pathStep.form.type')}
                htmlFor="lps_type"
                required
                error={translate(t, errors.type?.message)}
              >
                <Select id="lps_type" invalid={!!errors.type} {...register('type')}>
                  {STEP_TYPES.map((stepType) => (
                    <option key={stepType} value={stepType}>
                      {t(`learning.pathStep.typeOptions.${stepType}`)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label={t('learning.pathStep.form.isRequired')}
                htmlFor="lps_is_required"
                error={translate(t, errors.is_required?.message)}
              >
                <Select id="lps_is_required" invalid={!!errors.is_required} {...register('is_required')}>
                  <option value="true">{t('common.yes')}</option>
                  <option value="false">{t('common.no')}</option>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field
                label={t('learning.pathStep.form.referenceId')}
                htmlFor="lps_reference_id"
                error={translate(t, errors.reference_id?.message)}
              >
                <Input
                  id="lps_reference_id"
                  type="number"
                  min="1"
                  invalid={!!errors.reference_id}
                  {...register('reference_id')}
                />
              </Field>

              <Field
                label={t('learning.pathStep.form.sortOrder')}
                htmlFor="lps_sort_order"
                error={translate(t, errors.sort_order?.message)}
              >
                <Input
                  id="lps_sort_order"
                  type="number"
                  min="0"
                  invalid={!!errors.sort_order}
                  {...register('sort_order')}
                />
              </Field>
            </div>

            <Field
              label={t('learning.pathStep.form.description')}
              htmlFor="lps_description"
              error={translate(t, errors.description?.message)}
            >
              <Textarea
                id="lps_description"
                rows={3}
                invalid={!!errors.description}
                {...register('description')}
              />
            </Field>
          </form>
        )}
      </DialogContent>

      <ConfirmDialog
        open={deleteTarget !== undefined}
        onOpenChange={(o) => !o && setDeleteTarget(undefined)}
        title={t('learning.pathStep.deleteConfirm.title')}
        description={
          deleteTarget
            ? t('learning.pathStep.deleteConfirm.description', { title: deleteTarget.title })
            : undefined
        }
        isLoading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </Dialog>
  );
}
