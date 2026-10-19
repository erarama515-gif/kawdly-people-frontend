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
import { Field, Input, Select } from '@/components/ui/form';
import { userFacingMessage } from '@/lib/api/errors';
import type { ApiError } from '@/lib/api/errors';
import { useSalaryComponentList } from '@/features/compensation/api/queries';
import {
  usePayslipItemList,
  useCreatePayslipItem,
  useUpdatePayslipItem,
  useDeletePayslipItem,
} from '../api/queries';
import type { PayslipItemInput, PayslipItemType } from '../api/resource';
import type { PayslipItemWire } from '../api/schema';
import type { PayslipWire } from '../api/schema';

/**
 * Per-payslip line-item breakdown — opened from the Payslip row's "breakdown"
 * action in PayrollPage. One Dialog, two internal modes:
 *   - 'list': table/cards of all PayslipItem rows for this payslip, each with
 *     edit/delete row actions, plus an "Add Item" button.
 *   - 'form': inline add/edit form for a single PayslipItem, replacing the
 *     list body (same Dialog chrome, same footer Save/Cancel wiring as every
 *     other form dialog in the app).
 *
 * Scoped entirely to `payslip.id` — the parent only renders this when a
 * payslip has been selected (see PayrollPage's `breakdownPayslip` state).
 */

const REQUIRED = 'common.requiredField';
const ITEM_TYPES: readonly PayslipItemType[] = ['earning', 'deduction'];
const ITEMS_PER_PAGE = 50;

const itemFormSchema = z.object({
  description: z.string().trim().min(1, REQUIRED).max(255),
  type: z.string().min(1, REQUIRED),
  amount: z.string().min(1, REQUIRED),
  salary_component_id: z.string(),
  is_taxable: z.string(),
  sort_order: z.string(),
});

type ItemFormValues = z.infer<typeof itemFormSchema>;

function buildDefaultValues(record: PayslipItemWire | undefined): ItemFormValues {
  if (!record) {
    return {
      description: '',
      type: 'earning',
      amount: '',
      salary_component_id: '',
      is_taxable: 'false',
      sort_order: '',
    };
  }
  return {
    description: record.description,
    type: record.type,
    amount: String(record.amount),
    salary_component_id: record.salary_component_id !== undefined ? String(record.salary_component_id) : '',
    is_taxable: String(record.is_taxable ?? false),
    sort_order: record.sort_order !== undefined ? String(record.sort_order) : '',
  };
}

function toInput(values: ItemFormValues, payslipId: number): PayslipItemInput {
  return {
    payslip_id: payslipId,
    salary_component_id: values.salary_component_id ? Number(values.salary_component_id) : null,
    description: values.description,
    type: values.type as PayslipItemType,
    amount: Number(values.amount),
    is_taxable: values.is_taxable === 'true',
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

const TYPE_CLASSES: Record<PayslipItemType, string> = {
  earning: 'bg-emerald-50 text-emerald-700',
  deduction: 'bg-red-50 text-red-700',
};

function TypeBadge({ type }: { type: PayslipItemType }) {
  const { t } = useTranslation();
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', TYPE_CLASSES[type])}>
      {t(`compensation.typeOptions.${type}`)}
    </span>
  );
}

function BoolPill({ value }: { value: boolean | undefined }) {
  const { t } = useTranslation();
  if (value === undefined) return <span className="text-ink-faint">—</span>;
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
        value ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
      )}
    >
      {value ? t('common.yes') : t('common.no')}
    </span>
  );
}

export interface PayslipItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payslip: PayslipWire | undefined;
}

export function PayslipItemsDialog({ open, onOpenChange, payslip }: PayslipItemsDialogProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editTarget, setEditTarget] = useState<PayslipItemWire | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<PayslipItemWire | undefined>(undefined);

  const payslipId = payslip?.id;

  const listParams = useMemo(
    () => ({ page: 1, perPage: ITEMS_PER_PAGE, payslip_id: payslipId }),
    [payslipId],
  );
  const { state, refetch } = usePayslipItemList(listParams, payslipId !== undefined);
  const deleteMutation = useDeletePayslipItem(listParams);
  const createMutation = useCreatePayslipItem();
  const updateMutation = useUpdatePayslipItem();
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  // Optional salary-component picker (cross-feature, unrestricted — any structure).
  const { state: componentState } = useSalaryComponentList({ page: 1, perPage: 100 });
  const components = componentState.data?.data ?? [];

  const records = state.data?.data ?? [];
  const isEdit = editTarget !== undefined;

  const resolver = useMemo(() => zodResolver(itemFormSchema), []);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ItemFormValues>({ resolver, defaultValues: buildDefaultValues(undefined) });

  useEffect(() => {
    if (!open) return;
    setMode('list');
    setEditTarget(undefined);
    setDeleteTarget(undefined);
  }, [open, payslipId]);

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

  function openEditForm(record: PayslipItemWire) {
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

  async function onSubmit(values: ItemFormValues) {
    if (!payslipId) return;
    const input = toInput(values, payslipId);
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
      setError(field as keyof ItemFormValues, { type: 'server', message });
    }
  }

  const employeeName = payslip?.employee
    ? `${payslip.employee.first_name} ${payslip.employee.last_name}`
    : payslip
      ? `#${payslip.employee_id}`
      : '';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={t('payroll.payslipItem.dialogTitle', { name: employeeName })}
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
              <Button type="submit" form="payslip-item-form" variant="primary" isLoading={isSaving}>
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
                {t('payroll.payslipItem.add')}
              </Button>
            </div>

            {state.error ? (
              <Card className="flex items-center justify-between gap-3 px-4 py-3 text-body-sm text-coral">
                <span>{userFacingMessage(state.error) || t('payroll.payslipItem.loadFailed')}</span>
                <Button variant="secondary" onClick={() => void refetch()}>
                  {t('common.retry')}
                </Button>
              </Card>
            ) : null}

            {state.status === 'pending' && records.length === 0 ? <SkeletonTable /> : null}

            {state.status !== 'pending' && records.length === 0 ? (
              <Card className="px-4 py-8 text-center text-body-sm text-ink-muted">
                {t('payroll.payslipItem.empty')}
              </Card>
            ) : null}

            {records.length > 0 ? (
              <div className="flex flex-col gap-2">
                {records.map((rec) => (
                  <Card key={rec.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm font-semibold text-ink">{rec.description}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <TypeBadge type={rec.type} />
                        <BoolPill value={rec.is_taxable} />
                      </div>
                    </div>
                    <span
                      className={cn(
                        'nums font-mono text-body-sm font-semibold',
                        rec.type === 'deduction' ? 'text-coral' : 'text-navy',
                      )}
                    >
                      {rec.type === 'deduction' ? '−' : ''}
                      {Math.abs(rec.amount).toLocaleString()}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        className="h-7 w-7 px-0"
                        aria-label={t('payroll.payslipItem.editAction')}
                        onClick={() => openEditForm(rec)}
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-7 w-7 px-0 hover:!text-coral"
                        aria-label={t('payroll.payslipItem.deleteAction')}
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
          <form id="payslip-item-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {mutationError ? (
              <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
                {userFacingMessage(mutationError)}
              </p>
            ) : null}

            <Field
              label={t('payroll.payslipItem.form.description')}
              htmlFor="pi_description"
              required
              error={translate(t, errors.description?.message)}
            >
              <Input id="pi_description" invalid={!!errors.description} {...register('description')} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field
                label={t('payroll.payslipItem.form.type')}
                htmlFor="pi_type"
                required
                error={translate(t, errors.type?.message)}
              >
                <Select id="pi_type" invalid={!!errors.type} {...register('type')}>
                  {ITEM_TYPES.map((it) => (
                    <option key={it} value={it}>
                      {t(`compensation.typeOptions.${it}`)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label={t('payroll.payslipItem.form.amount')}
                htmlFor="pi_amount"
                required
                error={translate(t, errors.amount?.message)}
              >
                <Input id="pi_amount" type="number" min="0" invalid={!!errors.amount} {...register('amount')} />
              </Field>
            </div>

            <Field
              label={t('payroll.payslipItem.form.salaryComponent')}
              htmlFor="pi_salary_component_id"
              error={translate(t, errors.salary_component_id?.message)}
            >
              <Select
                id="pi_salary_component_id"
                invalid={!!errors.salary_component_id}
                {...register('salary_component_id')}
              >
                <option value="">{t('payroll.payslipItem.form.noSalaryComponent')}</option>
                {components.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field
                label={t('payroll.payslipItem.form.taxable')}
                htmlFor="pi_is_taxable"
                error={translate(t, errors.is_taxable?.message)}
              >
                <Select id="pi_is_taxable" invalid={!!errors.is_taxable} {...register('is_taxable')}>
                  <option value="false">{t('common.no')}</option>
                  <option value="true">{t('common.yes')}</option>
                </Select>
              </Field>

              <Field
                label={t('payroll.payslipItem.form.sortOrder')}
                htmlFor="pi_sort_order"
                error={translate(t, errors.sort_order?.message)}
              >
                <Input id="pi_sort_order" type="number" min="0" invalid={!!errors.sort_order} {...register('sort_order')} />
              </Field>
            </div>
          </form>
        )}
      </DialogContent>

      <ConfirmDialog
        open={deleteTarget !== undefined}
        onOpenChange={(o) => !o && setDeleteTarget(undefined)}
        title={t('payroll.payslipItem.deleteConfirm.title')}
        description={
          deleteTarget
            ? t('payroll.payslipItem.deleteConfirm.description', { description: deleteTarget.description })
            : undefined
        }
        isLoading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </Dialog>
  );
}
