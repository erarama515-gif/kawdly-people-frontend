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
import { useCreateSalaryStructure, useUpdateSalaryStructure } from '../api/queries';
import type { SalaryStructureInput } from '../api/resource';
import type { SalaryStructureWire } from '../api/schema';

/**
 * Add/Edit modal for one SalaryStructure, built on Dialog + react-hook-form +
 * zod. Footer Save button uses `form="salary-structure-form"` HTML5 attribute
 * so the button can live outside the `<form>` JSX (Dialog footer is a
 * separate div).
 */

const REQUIRED = 'common.requiredField';

const structureFormSchema = z.object({
  name: z.string().trim().min(1, REQUIRED).max(255),
  description: z.string().trim(),
  is_default: z.string(),
  is_active: z.string(),
});

type StructureFormValues = z.infer<typeof structureFormSchema>;

function buildDefaultValues(record: SalaryStructureWire | undefined): StructureFormValues {
  if (!record) {
    return { name: '', description: '', is_default: 'false', is_active: 'true' };
  }
  return {
    name: record.name,
    description: record.description ?? '',
    is_default: String(record.is_default ?? false),
    is_active: String(record.is_active ?? true),
  };
}

function toInput(values: StructureFormValues): SalaryStructureInput {
  return {
    name: values.name,
    description: values.description.trim() || null,
    is_default: values.is_default === 'true',
    is_active: values.is_active === 'true',
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

export interface SalaryStructureFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: SalaryStructureWire | undefined;
}

export function SalaryStructureFormDialog({
  open,
  onOpenChange,
  record,
}: SalaryStructureFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = record !== undefined;

  const createMutation = useCreateSalaryStructure();
  const updateMutation = useUpdateSalaryStructure();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  const resolver = useMemo(() => zodResolver(structureFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<StructureFormValues>({ resolver, defaultValues: buildDefaultValues(record) });

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

  async function onSubmit(values: StructureFormValues) {
    const input = toInput(values);
    const result = isEdit
      ? await updateMutation.mutate({ id: record.id, ...input })
      : await createMutation.mutate(input);

    if (result) {
      handleOpenChange(false);
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof StructureFormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('compensation.structure.editTitle') : t('compensation.structure.addTitle')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="salary-structure-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="salary-structure-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutationError ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          <Field
            label={t('compensation.form.name')}
            htmlFor="structure_name"
            required
            error={translate(t, errors.name?.message)}
          >
            <Input id="structure_name" invalid={!!errors.name} {...register('name')} />
          </Field>

          <Field
            label={t('compensation.form.description')}
            htmlFor="structure_description"
            error={translate(t, errors.description?.message)}
          >
            <Textarea id="structure_description" rows={3} invalid={!!errors.description} {...register('description')} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('compensation.form.isDefault')}
              htmlFor="structure_is_default"
              error={translate(t, errors.is_default?.message)}
            >
              <Select id="structure_is_default" invalid={!!errors.is_default} {...register('is_default')}>
                <option value="false">{t('common.no')}</option>
                <option value="true">{t('common.yes')}</option>
              </Select>
            </Field>

            <Field
              label={t('compensation.form.isActive')}
              htmlFor="structure_is_active"
              error={translate(t, errors.is_active?.message)}
            >
              <Select id="structure_is_active" invalid={!!errors.is_active} {...register('is_active')}>
                <option value="true">{t('common.yes')}</option>
                <option value="false">{t('common.no')}</option>
              </Select>
            </Field>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
