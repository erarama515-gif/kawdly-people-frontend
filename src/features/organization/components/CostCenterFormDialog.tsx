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
import { useCreateCostCenter, useUpdateCostCenter } from '../api/queries';
import type { CostCenterInput } from '../api/resource';
import type { CostCenterWire } from '../api/schema';

/**
 * Add/Edit modal for one CostCenter record.
 *
 * Confirmed fields from StoreCostCenterRequest.php:
 *   company_id (required FK, attached server-side), name (required, max:255),
 *   code (nullable, max:50), is_active (nullable boolean).
 *
 * Footer Save is wired via form="cost-center-form" attribute.
 */

const REQUIRED = 'common.requiredField';

const costCenterFormSchema = z.object({
  name: z.string().min(1, REQUIRED).max(255),
  code: z.string().max(50),
  is_active: z.string(),
});

type CostCenterFormValues = z.infer<typeof costCenterFormSchema>;

function buildDefaultValues(costCenter: CostCenterWire | undefined): CostCenterFormValues {
  if (!costCenter) {
    return {
      name: '',
      code: '',
      is_active: 'true',
    };
  }
  return {
    name: costCenter.name,
    code: costCenter.code ?? '',
    is_active: costCenter.is_active === false ? 'false' : 'true',
  };
}

function toCostCenterInput(values: CostCenterFormValues): CostCenterInput {
  return {
    name: values.name.trim(),
    code: values.code.trim() || null,
    is_active: values.is_active === 'false' ? false : true,
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

export interface CostCenterFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costCenter?: CostCenterWire | undefined;
}

export function CostCenterFormDialog({ open, onOpenChange, costCenter }: CostCenterFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = costCenter !== undefined;

  const createMutation = useCreateCostCenter();
  const updateMutation = useUpdateCostCenter();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  const resolver = useMemo(() => zodResolver(costCenterFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CostCenterFormValues>({
    resolver,
    defaultValues: buildDefaultValues(costCenter),
  });

  useEffect(() => {
    if (open) reset(buildDefaultValues(costCenter));
  }, [open, costCenter, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: CostCenterFormValues) {
    const input = toCostCenterInput(values);
    const result = isEdit
      ? await updateMutation.mutate({ id: costCenter.id, ...input })
      : await createMutation.mutate(input);

    if (result) {
      toast.success('common.saved');
      handleOpenChange(false);
      return;
    }

    toast.error('common.operationFailed');
    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof CostCenterFormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('organization.costCenter.editTitle') : t('organization.costCenter.addTitle')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="cost-center-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="cost-center-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutationError ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          {/* Name */}
          <Field
            label={t('organization.costCenter.form.name')}
            htmlFor="cc_name"
            required
            error={translate(t, errors.name?.message)}
          >
            <Input id="cc_name" invalid={!!errors.name} {...register('name')} />
          </Field>

          {/* Code */}
          <Field
            label={t('organization.costCenter.form.code')}
            htmlFor="cc_code"
            error={translate(t, errors.code?.message)}
          >
            <Input id="cc_code" invalid={!!errors.code} maxLength={50} {...register('code')} />
          </Field>

          {/* Active status */}
          <Field
            label={t('organization.costCenter.form.isActive')}
            htmlFor="cc_is_active"
            error={translate(t, errors.is_active?.message)}
          >
            <Select id="cc_is_active" invalid={!!errors.is_active} {...register('is_active')}>
              <option value="true">{t('organization.costCenter.form.activeOption')}</option>
              <option value="false">{t('organization.costCenter.form.inactiveOption')}</option>
            </Select>
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
