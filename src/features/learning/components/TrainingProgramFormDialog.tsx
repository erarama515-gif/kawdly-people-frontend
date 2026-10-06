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
import { useCreateTrainingProgram, useUpdateTrainingProgram } from '../api/queries';
import type {
  TrainingProgramInput,
  TrainingProgramStatus,
  TrainingProgramType,
} from '../api/resource';
import type { TrainingProgramWire } from '../api/schema';

/**
 * Add/Edit modal for one training program, built on `Dialog` + react-hook-form
 * + zod — the same library combination as `EmployeeFormDialog` and
 * `ContractFormDialog`.
 *
 * All form fields are plain strings (native `<select>`/`<input>` values).
 * Validation messages are i18n keys resolved via `t()` at render time.
 * `toTrainingProgramInput()` does the one-time conversion on valid submit.
 *
 * The Save button lives in the dialog footer (outside the `<form>` DOM subtree)
 * and is wired via the HTML5 `form="training-program-form"` attribute —
 * required pattern, do not move the button inside the `<form>`.
 *
 * Status enum: `planned | ongoing | completed | cancelled` — the old mock's
 * `active | scheduled | draft` are not real backend values and are not used.
 *
 * `trainer_name` is a plain name string — NOT an employee FK. No
 * `trainerInitials` / `trainerPhoto` columns exist on the model.
 */

const REQUIRED = 'common.requiredField';

// company_id hardcoded to 1 as placeholder (same as Employees/Contracts)
const COMPANY_ID = 1;

const PROGRAM_TYPES: readonly TrainingProgramType[] = ['internal', 'external', 'online'];
const PROGRAM_STATUSES: readonly TrainingProgramStatus[] = [
  'planned',
  'ongoing',
  'completed',
  'cancelled',
];

const trainingProgramFormSchema = z
  .object({
    title: z.string().trim().min(1, REQUIRED).max(255),
    description: z.string(),
    category: z.string().max(100),
    type: z.string().min(1, REQUIRED),
    trainer_name: z.string().max(255),
    duration_hours: z.string(),
    cost: z.string(),
    max_participants: z.string(),
    start_date: z.string().min(1, REQUIRED),
    end_date: z.string().min(1, REQUIRED),
    location: z.string().max(255),
    status: z.string(),
  })
  .refine(
    (values) => {
      if (!values.start_date || !values.end_date) return true;
      return values.end_date >= values.start_date;
    },
    {
      message: 'learning.form.endDateAfterStart',
      path: ['end_date'],
    },
  );

type TrainingProgramFormValues = z.infer<typeof trainingProgramFormSchema>;

function buildDefaultValues(program: TrainingProgramWire | undefined): TrainingProgramFormValues {
  if (!program) {
    return {
      title: '',
      description: '',
      category: '',
      type: 'internal',
      trainer_name: '',
      duration_hours: '',
      cost: '',
      max_participants: '',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: '',
      location: '',
      status: 'planned',
    };
  }

  return {
    title: program.title,
    description: program.description ?? '',
    category: program.category ?? '',
    type: program.type,
    trainer_name: program.trainer_name ?? '',
    duration_hours: program.duration_hours !== undefined ? String(program.duration_hours) : '',
    cost: program.cost !== undefined ? String(program.cost) : '',
    max_participants:
      program.max_participants !== undefined ? String(program.max_participants) : '',
    start_date: program.start_date.slice(0, 10),
    end_date: program.end_date.slice(0, 10),
    location: program.location ?? '',
    status: program.status ?? 'planned',
  };
}

function toTrainingProgramInput(values: TrainingProgramFormValues): TrainingProgramInput {
  return {
    company_id: COMPANY_ID,
    title: values.title.trim(),
    description: values.description.trim() || null,
    category: values.category.trim() || null,
    type: values.type as TrainingProgramType,
    trainer_name: values.trainer_name.trim() || null,
    duration_hours: values.duration_hours.trim() ? Number(values.duration_hours) : null,
    cost: values.cost.trim() ? Number(values.cost) : null,
    max_participants: values.max_participants.trim() ? Number(values.max_participants) : null,
    start_date: values.start_date,
    end_date: values.end_date,
    location: values.location.trim() || null,
    status: (values.status as TrainingProgramStatus) || null,
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

export interface TrainingProgramFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit (or pass `undefined`) to open in "Add Program" mode. */
  program?: TrainingProgramWire | undefined;
}

export function TrainingProgramFormDialog({
  open,
  onOpenChange,
  program,
}: TrainingProgramFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = program !== undefined;

  const createMutation = useCreateTrainingProgram();
  const updateMutation = useUpdateTrainingProgram();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  const resolver = useMemo(() => zodResolver(trainingProgramFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<TrainingProgramFormValues>({
    resolver,
    defaultValues: buildDefaultValues(program),
  });

  // Re-seed the form every time the dialog opens.
  useEffect(() => {
    if (open) reset(buildDefaultValues(program));
  }, [open, program, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: TrainingProgramFormValues) {
    const input = toTrainingProgramInput(values);
    const result = isEdit
      ? await updateMutation.mutate({ id: program.id, ...input })
      : await createMutation.mutate(input);

    if (result) {
      handleOpenChange(false);
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof TrainingProgramFormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('learning.editProgram') : t('learning.addProgram')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              form="training-program-form"
              variant="primary"
              isLoading={isPending}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form
          id="training-program-form"
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

          {/* Title */}
          <Field
            label={t('learning.form.title')}
            htmlFor="title"
            required
            error={translate(t, errors.title?.message)}
          >
            <Input id="title" invalid={!!errors.title} {...register('title')} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            {/* Type */}
            <Field
              label={t('learning.form.type')}
              htmlFor="type"
              required
              error={translate(t, errors.type?.message)}
            >
              <Select id="type" invalid={!!errors.type} {...register('type')}>
                {PROGRAM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`learning.typeOptions.${type}`)}
                  </option>
                ))}
              </Select>
            </Field>

            {/* Status */}
            <Field
              label={t('learning.form.status')}
              htmlFor="status"
              error={translate(t, errors.status?.message)}
            >
              <Select id="status" invalid={!!errors.status} {...register('status')}>
                <option value="">{t('common.selectPlaceholder')}</option>
                {PROGRAM_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`learning.statusOptions.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Start date */}
            <Field
              label={t('learning.form.startDate')}
              htmlFor="start_date"
              required
              error={translate(t, errors.start_date?.message)}
            >
              <Input
                id="start_date"
                type="date"
                invalid={!!errors.start_date}
                {...register('start_date')}
              />
            </Field>

            {/* End date */}
            <Field
              label={t('learning.form.endDate')}
              htmlFor="end_date"
              required
              error={translate(t, errors.end_date?.message)}
            >
              <Input
                id="end_date"
                type="date"
                invalid={!!errors.end_date}
                {...register('end_date')}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <Field
              label={t('learning.form.category')}
              htmlFor="category"
              error={translate(t, errors.category?.message)}
            >
              <Input id="category" invalid={!!errors.category} {...register('category')} />
            </Field>

            {/* Trainer name */}
            <Field
              label={t('learning.form.trainerName')}
              htmlFor="trainer_name"
              error={translate(t, errors.trainer_name?.message)}
            >
              <Input
                id="trainer_name"
                invalid={!!errors.trainer_name}
                {...register('trainer_name')}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Duration hours */}
            <Field
              label={t('learning.form.durationHours')}
              htmlFor="duration_hours"
              error={translate(t, errors.duration_hours?.message)}
            >
              <Input
                id="duration_hours"
                type="number"
                min="0"
                step="0.5"
                invalid={!!errors.duration_hours}
                {...register('duration_hours')}
              />
            </Field>

            {/* Max participants */}
            <Field
              label={t('learning.form.maxParticipants')}
              htmlFor="max_participants"
              error={translate(t, errors.max_participants?.message)}
            >
              <Input
                id="max_participants"
                type="number"
                min="1"
                invalid={!!errors.max_participants}
                {...register('max_participants')}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Cost */}
            <Field
              label={t('learning.form.cost')}
              htmlFor="cost"
              error={translate(t, errors.cost?.message)}
            >
              <Input
                id="cost"
                type="number"
                min="0"
                invalid={!!errors.cost}
                {...register('cost')}
              />
            </Field>

            {/* Location */}
            <Field
              label={t('learning.form.location')}
              htmlFor="location"
              error={translate(t, errors.location?.message)}
            >
              <Input id="location" invalid={!!errors.location} {...register('location')} />
            </Field>
          </div>

          {/* Description */}
          <Field
            label={t('learning.form.description')}
            htmlFor="description"
            error={translate(t, errors.description?.message)}
          >
            <Textarea
              id="description"
              rows={3}
              invalid={!!errors.description}
              {...register('description')}
            />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
