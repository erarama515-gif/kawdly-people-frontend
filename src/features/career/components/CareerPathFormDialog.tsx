import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/form';
import { userFacingMessage } from '@/lib/api/errors';
import type { ApiError } from '@/lib/api/errors';
import { useCreateCareerPath, useUpdateCareerPath } from '../api/queries';
import type { CareerPathInput } from '../api/resource';
import type { CareerPathWire } from '../api/schema';

/**
 * Add/Edit modal for one career path.
 *
 * Fields: `name` (required), `job_family` (optional).
 * `company_id` is hardcoded to 1 as a placeholder until auth context is wired —
 * mirrors how ContractFormDialog hardcodes `created_by: 1`.
 *
 * NOTE: No `description` field — it does not exist on the real backend
 * (`StoreCareerPathRequest`). The old mock fabricated it; it is dropped.
 *
 * The Save button is wired via HTML5 `form="career-path-form"` because it lives
 * outside the `<form>` DOM node (in the DialogContent footer) — required pattern.
 */

const REQUIRED = 'common.requiredField';

const careerPathFormSchema = z.object({
  name: z.string().min(1, REQUIRED).max(255),
  job_family: z.string().max(100),
});

type CareerPathFormValues = z.infer<typeof careerPathFormSchema>;

function buildDefaultValues(path: CareerPathWire | undefined): CareerPathFormValues {
  if (!path) {
    return { name: '', job_family: '' };
  }
  return {
    name: path.name,
    job_family: path.job_family ?? '',
  };
}

function toCareerPathInput(values: CareerPathFormValues): CareerPathInput {
  return {
    // Hardcoded company_id = 1 as placeholder until auth context is wired.
    company_id: 1,
    name: values.name.trim(),
    job_family: values.job_family.trim() || null,
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

export interface CareerPathFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit (or pass `undefined`) to open in "Add Career Path" mode. */
  path?: CareerPathWire | undefined;
}

export function CareerPathFormDialog({ open, onOpenChange, path }: CareerPathFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = path !== undefined;

  const createMutation = useCreateCareerPath();
  const updateMutation = useUpdateCareerPath();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  const resolver = useMemo(() => zodResolver(careerPathFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CareerPathFormValues>({
    resolver,
    defaultValues: buildDefaultValues(path),
  });

  // Re-seed the form every time the dialog opens.
  useEffect(() => {
    if (open) reset(buildDefaultValues(path));
  }, [open, path, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: CareerPathFormValues) {
    const input = toCareerPathInput(values);
    const result = isEdit
      ? await updateMutation.mutate({ id: path.id, ...input })
      : await createMutation.mutate(input);

    if (result) {
      handleOpenChange(false);
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof CareerPathFormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('career.editPath') : t('career.addPath')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="career-path-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="career-path-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutationError ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          {/* Name */}
          <Field label={t('career.form.name')} htmlFor="name" required error={translate(t, errors.name?.message)}>
            <Input id="name" invalid={!!errors.name} {...register('name')} />
          </Field>

          {/* Job family */}
          <Field label={t('career.form.jobFamily')} htmlFor="job_family" error={translate(t, errors.job_family?.message)}>
            <Input id="job_family" invalid={!!errors.job_family} {...register('job_family')} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
