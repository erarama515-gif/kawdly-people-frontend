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
import { useSalaryStructureList } from '../api/queries';
import { useSalaryComponentList } from '../api/queries';
import { useCreateSalaryComponent, useUpdateSalaryComponent } from '../api/queries';
import type {
  SalaryComponentInput,
  SalaryComponentType,
  SalaryComponentCalculationType,
} from '../api/resource';
import type { SalaryComponentWire } from '../api/schema';

/**
 * Add/Edit modal for one SalaryComponent, built on Dialog + react-hook-form +
 * zod. Footer Save button uses `form="salary-component-form"` HTML5 attribute
 * so the button lives outside the `<form>` JSX (Dialog footer is a separate div).
 *
 * Pickers:
 *  - `salary_structure_id`: native <select> fed by useSalaryStructureList({page:1, perPage:100})
 *  - `percentage_of`: optional native <select> fed by useSalaryComponentList filtered to same
 *    structure (only shown when calculation_type === 'percentage')
 *
 * `company_id` is hard-coded to 1 as a placeholder.
 *
 * Key collision avoidance: the i18n keys for the enum labels use distinct
 * parent paths — `compensation.typeOptions.*` and
 * `compensation.calculationTypeOptions.*` — not `compensation.form.type.*`
 * (that would collide with the plain string key `compensation.form.type`).
 */

const REQUIRED = 'common.requiredField';
const COMPANY_ID = 1;

const COMPONENT_TYPES: readonly SalaryComponentType[] = ['earning', 'deduction'];
const CALCULATION_TYPES: readonly SalaryComponentCalculationType[] = ['fixed', 'percentage', 'formula'];

const componentFormSchema = z.object({
  salary_structure_id: z.string().min(1, REQUIRED),
  name: z.string().trim().min(1, REQUIRED).max(255),
  code: z.string().trim().max(20),
  type: z.string().min(1, REQUIRED),
  calculation_type: z.string().min(1, REQUIRED),
  percentage_of: z.string(),
  default_amount: z.string(),
  is_taxable: z.string(),
  is_variable: z.string(),
  sort_order: z.string(),
});

type ComponentFormValues = z.infer<typeof componentFormSchema>;

function buildDefaultValues(
  record: SalaryComponentWire | undefined,
  defaultStructureId?: number,
): ComponentFormValues {
  if (!record) {
    return {
      salary_structure_id: defaultStructureId ? String(defaultStructureId) : '',
      name: '',
      code: '',
      type: 'earning',
      calculation_type: 'fixed',
      percentage_of: '',
      default_amount: '',
      is_taxable: 'false',
      is_variable: 'false',
      sort_order: '',
    };
  }
  return {
    salary_structure_id: String(record.salary_structure_id),
    name: record.name,
    code: record.code ?? '',
    type: record.type,
    calculation_type: record.calculation_type,
    percentage_of: record.percentage_of !== undefined ? String(record.percentage_of) : '',
    default_amount: record.default_amount !== undefined ? String(record.default_amount) : '',
    is_taxable: String(record.is_taxable ?? false),
    is_variable: String(record.is_variable ?? false),
    sort_order: record.sort_order !== undefined ? String(record.sort_order) : '',
  };
}

function toInput(values: ComponentFormValues): SalaryComponentInput {
  return {
    company_id: COMPANY_ID,
    salary_structure_id: Number(values.salary_structure_id),
    name: values.name,
    code: values.code.trim() || null,
    type: values.type as SalaryComponentType,
    calculation_type: values.calculation_type as SalaryComponentCalculationType,
    percentage_of: values.percentage_of ? Number(values.percentage_of) : null,
    default_amount: values.default_amount ? Number(values.default_amount) : null,
    is_taxable: values.is_taxable === 'true',
    is_variable: values.is_variable === 'true',
    sort_order: values.sort_order ? Number(values.sort_order) : null,
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

export interface SalaryComponentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: SalaryComponentWire | undefined;
  /** Pre-select structure when adding from the components section filter */
  defaultStructureId?: number | undefined;
}

export function SalaryComponentFormDialog({
  open,
  onOpenChange,
  record,
  defaultStructureId,
}: SalaryComponentFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = record !== undefined;

  const createMutation = useCreateSalaryComponent();
  const updateMutation = useUpdateSalaryComponent();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  const resolver = useMemo(() => zodResolver(componentFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm<ComponentFormValues>({
    resolver,
    defaultValues: buildDefaultValues(record, defaultStructureId),
  });

  useEffect(() => {
    if (open) reset(buildDefaultValues(record, defaultStructureId));
  }, [open, record, defaultStructureId, reset]);

  const watchedStructureId = watch('salary_structure_id');
  const watchedCalcType = watch('calculation_type');
  const showPercentageOf = watchedCalcType === 'percentage';

  // Structures picker
  const { state: structureState } = useSalaryStructureList({ page: 1, perPage: 100 });
  const structures = structureState.data?.data ?? [];

  // Percentage-of picker: components in the selected structure (excluding self when editing)
  const structureIdNum = watchedStructureId ? Number(watchedStructureId) : undefined;
  const { state: componentState } = useSalaryComponentList({
    page: 1,
    perPage: 100,
    salary_structure_id: structureIdNum,
  });
  const siblingComponents = (componentState.data?.data ?? []).filter(
    (c) => !isEdit || c.id !== record.id,
  );

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: ComponentFormValues) {
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
      setError(field as keyof ComponentFormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('compensation.component.editTitle') : t('compensation.component.addTitle')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="salary-component-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="salary-component-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutationError ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          {/* Structure picker */}
          <Field
            label={t('compensation.form.structure')}
            htmlFor="component_salary_structure_id"
            required
            error={translate(t, errors.salary_structure_id?.message)}
          >
            <Select
              id="component_salary_structure_id"
              invalid={!!errors.salary_structure_id}
              {...register('salary_structure_id')}
            >
              <option value="">{t('common.selectPlaceholder')}</option>
              {structures.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>

          {/* Name + Code */}
          <div className="grid grid-cols-[1fr_120px] gap-4">
            <Field
              label={t('compensation.form.name')}
              htmlFor="component_name"
              required
              error={translate(t, errors.name?.message)}
            >
              <Input id="component_name" invalid={!!errors.name} {...register('name')} />
            </Field>
            <Field
              label={t('compensation.form.code')}
              htmlFor="component_code"
              error={translate(t, errors.code?.message)}
            >
              <Input id="component_code" invalid={!!errors.code} {...register('code')} />
            </Field>
          </div>

          {/* Type + Calculation Type */}
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('compensation.form.type')}
              htmlFor="component_type"
              required
              error={translate(t, errors.type?.message)}
            >
              <Select id="component_type" invalid={!!errors.type} {...register('type')}>
                {COMPONENT_TYPES.map((ct) => (
                  <option key={ct} value={ct}>
                    {t(`compensation.typeOptions.${ct}`)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={t('compensation.form.calculationType')}
              htmlFor="component_calculation_type"
              required
              error={translate(t, errors.calculation_type?.message)}
            >
              <Select
                id="component_calculation_type"
                invalid={!!errors.calculation_type}
                {...register('calculation_type')}
              >
                {CALCULATION_TYPES.map((ct) => (
                  <option key={ct} value={ct}>
                    {t(`compensation.calculationTypeOptions.${ct}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Percentage Of (conditional) */}
          {showPercentageOf ? (
            <Field
              label={t('compensation.form.percentageOf')}
              htmlFor="component_percentage_of"
              error={translate(t, errors.percentage_of?.message)}
            >
              <Select
                id="component_percentage_of"
                invalid={!!errors.percentage_of}
                {...register('percentage_of')}
              >
                <option value="">{t('compensation.form.percentageOfNone')}</option>
                {siblingComponents.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          {/* Default Amount + Sort Order */}
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('compensation.form.defaultAmount')}
              htmlFor="component_default_amount"
              error={translate(t, errors.default_amount?.message)}
            >
              <Input
                id="component_default_amount"
                type="number"
                min="0"
                invalid={!!errors.default_amount}
                {...register('default_amount')}
              />
            </Field>
            <Field
              label={t('compensation.form.sortOrder')}
              htmlFor="component_sort_order"
              error={translate(t, errors.sort_order?.message)}
            >
              <Input
                id="component_sort_order"
                type="number"
                min="0"
                invalid={!!errors.sort_order}
                {...register('sort_order')}
              />
            </Field>
          </div>

          {/* Boolean toggles */}
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('compensation.form.isTaxable')}
              htmlFor="component_is_taxable"
              error={translate(t, errors.is_taxable?.message)}
            >
              <Select id="component_is_taxable" invalid={!!errors.is_taxable} {...register('is_taxable')}>
                <option value="false">{t('common.no')}</option>
                <option value="true">{t('common.yes')}</option>
              </Select>
            </Field>

            <Field
              label={t('compensation.form.isVariable')}
              htmlFor="component_is_variable"
              error={translate(t, errors.is_variable?.message)}
            >
              <Select id="component_is_variable" invalid={!!errors.is_variable} {...register('is_variable')}>
                <option value="false">{t('common.no')}</option>
                <option value="true">{t('common.yes')}</option>
              </Select>
            </Field>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
