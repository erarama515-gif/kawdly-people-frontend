import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/form';
import { userFacingMessage } from '@/lib/api/errors';
import type { ApiError } from '@/lib/api/errors';
import { useEmployeeList } from '@/features/employees/api/queries';
import { useCreateInterview, useUpdateInterview } from '../api/interviews';
import type { InterviewType, InterviewWire } from '../api/interviews';

const REQUIRED = 'common.requiredField';

const INTERVIEW_TYPES: readonly InterviewType[] = [
  'screening',
  'technical',
  'hr',
  'cultural',
  'final',
];

const formSchema = z.object({
  type: z.string().min(1, REQUIRED),
  interviewer_id: z.string().min(1, REQUIRED),
  scheduled_at: z.string().min(1, REQUIRED),
  duration_minutes: z.string(),
  location: z.string().trim().max(255),
  meeting_link: z.string().trim().max(500),
});

type FormValues = z.infer<typeof formSchema>;

/** Converts an ISO timestamp to the `datetime-local` control's local value. */
function toLocalInputValue(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildDefaultValues(interview: InterviewWire | undefined): FormValues {
  if (!interview) {
    return {
      type: 'screening',
      interviewer_id: '',
      scheduled_at: '',
      duration_minutes: '60',
      location: '',
      meeting_link: '',
    };
  }

  return {
    type: interview.type,
    interviewer_id: String(interview.interviewer_id),
    scheduled_at: toLocalInputValue(interview.scheduled_at),
    duration_minutes:
      interview.duration_minutes !== undefined ? String(interview.duration_minutes) : '',
    location: interview.location ?? '',
    meeting_link: interview.meeting_link ?? '',
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

export interface InterviewFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: number;
  /** Omit to open in "Add Interview" mode. */
  interview?: InterviewWire | undefined;
}

export function InterviewFormDialog({
  open,
  onOpenChange,
  candidateId,
  interview,
}: InterviewFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = interview !== undefined;

  const createMutation = useCreateInterview();
  const updateMutation = useUpdateInterview();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  const resolver = useMemo(() => zodResolver(formSchema), []);
  const { state: employeeState } = useEmployeeList({ page: 1, perPage: 200 });
  const employees = employeeState.data?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver,
    defaultValues: buildDefaultValues(interview),
  });

  // Re-seed the form every time the dialog opens.
  useEffect(() => {
    if (open) reset(buildDefaultValues(interview));
  }, [open, interview, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: FormValues) {
    const duration = values.duration_minutes ? Number(values.duration_minutes) : null;
    const payload = {
      interviewer_id: Number(values.interviewer_id),
      type: values.type as InterviewType,
      scheduled_at: values.scheduled_at,
      duration_minutes: duration,
      location: values.location.trim() || null,
      meeting_link: values.meeting_link.trim() || null,
    };

    const result = isEdit
      ? await updateMutation.mutate({ id: interview.id, ...payload })
      : await createMutation.mutate({ candidate_id: candidateId, ...payload });

    if (result) {
      handleOpenChange(false);
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof FormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={
          isEdit
            ? t('recruitment.interviews.editTitle')
            : t('recruitment.interviews.addTitle')
        }
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="interview-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="interview-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
              label={t('recruitment.interviews.fields.type')}
              htmlFor="interview_type"
              required
              error={translate(t, errors.type?.message)}
            >
              <Select id="interview_type" invalid={!!errors.type} {...register('type')}>
                {INTERVIEW_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`recruitment.interviews.types.${type}`)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={t('recruitment.interviews.fields.interviewer')}
              htmlFor="interview_interviewer"
              required
              error={translate(t, errors.interviewer_id?.message)}
            >
              <Select
                id="interview_interviewer"
                invalid={!!errors.interviewer_id}
                {...register('interviewer_id')}
              >
                <option value="">{t('recruitment.interviews.selectPlaceholder')}</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.first_name_ar && employee.last_name_ar
                      ? `${employee.first_name_ar} ${employee.last_name_ar}`
                      : `${employee.first_name} ${employee.last_name}`}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('recruitment.interviews.fields.scheduledAt')}
              htmlFor="interview_scheduled_at"
              required
              error={translate(t, errors.scheduled_at?.message)}
            >
              <Input
                id="interview_scheduled_at"
                type="datetime-local"
                invalid={!!errors.scheduled_at}
                {...register('scheduled_at')}
              />
            </Field>

            <Field
              label={t('recruitment.interviews.fields.duration')}
              htmlFor="interview_duration"
              error={translate(t, errors.duration_minutes?.message)}
            >
              <Input
                id="interview_duration"
                type="number"
                min={1}
                invalid={!!errors.duration_minutes}
                {...register('duration_minutes')}
              />
            </Field>
          </div>

          <Field
            label={t('recruitment.interviews.fields.location')}
            htmlFor="interview_location"
            error={translate(t, errors.location?.message)}
          >
            <Input id="interview_location" invalid={!!errors.location} {...register('location')} />
          </Field>

          <Field
            label={t('recruitment.interviews.fields.meetingLink')}
            htmlFor="interview_meeting_link"
            error={translate(t, errors.meeting_link?.message)}
          >
            <Input
              id="interview_meeting_link"
              type="url"
              placeholder="https://"
              invalid={!!errors.meeting_link}
              {...register('meeting_link')}
            />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
