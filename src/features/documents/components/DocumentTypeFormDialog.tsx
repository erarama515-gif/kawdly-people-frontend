import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/form';
import { userFacingMessage } from '@/lib/api/errors';
import { useCreateDocumentType, useUpdateDocumentType } from '../api/queries';
import type { DocumentTypeCategory } from '../api/resource';
import type { DocumentTypeWire } from '../api/schema';

const CATEGORY_VALUES: DocumentTypeCategory[] = [
  'identification',
  'contract',
  'certificate',
  'license',
  'other',
];

const documentTypeSchema = z.object({
  // Messages are i18n keys, resolved at render time via `translate` — same
  // pattern as the employees and settings form dialogs.
  name: z
    .string()
    .trim()
    .min(1, 'documents.documentTypes.validation.nameRequired')
    .max(255, 'documents.documentTypes.validation.nameMax'),
  category: z.string().min(1, 'documents.documentTypes.validation.categoryRequired'),
  has_expiry: z.boolean(),
  is_required: z.boolean(),
  sort_order: z.string().regex(/^\d*$/, 'documents.documentTypes.validation.sortOrderInvalid'),
});

type DocumentTypeFormValues = z.infer<typeof documentTypeSchema>;

const DEFAULTS: DocumentTypeFormValues = {
  name: '',
  category: '',
  has_expiry: false,
  is_required: false,
  sort_order: '0',
};

function translate(t: TFunction, message: string | undefined): string | undefined {
  return message ? t(message) : undefined;
}

export interface DocumentTypeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` = create mode; a row = edit mode. */
  documentType: DocumentTypeWire | null;
  /** `employees.company_id` from the session; required for create only. */
  companyId: number | undefined;
}

/**
 * Create/edit dialog for `GET|POST|PATCH /document-types`.
 *
 * Always mounted (the caller keeps one instance for create and one for edit)
 * so Radix can run its close animation. `company_id` is not exposed: it comes
 * from the authenticated user's employee record and the backend's
 * `BelongsToCompany` trait re-derives it for non-privileged roles anyway.
 */
export function DocumentTypeFormDialog({
  open,
  onOpenChange,
  documentType,
  companyId,
}: DocumentTypeFormDialogProps) {
  const { t } = useTranslation();
  const isEditing = documentType !== null;
  const prefix = isEditing ? 'edit' : 'add';
  const formId = `${prefix}-document-type-form`;

  const {
    mutate: createDocumentType,
    isPending: isCreating,
    error: createError,
    reset: resetCreateError,
  } = useCreateDocumentType();
  const {
    mutate: updateDocumentType,
    isPending: isUpdating,
    error: updateError,
    reset: resetUpdateError,
  } = useUpdateDocumentType();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DocumentTypeFormValues>({
    resolver: zodResolver(documentTypeSchema),
    defaultValues: DEFAULTS,
  });

  // The dialog stays mounted for its close animation, so seed the form each
  // time it opens instead of relying on `defaultValues`.
  useEffect(() => {
    if (!open) return;
    reset(
      documentType
        ? {
            name: documentType.name,
            category: documentType.category ?? '',
            has_expiry: documentType.has_expiry ?? false,
            is_required: documentType.is_required ?? false,
            sort_order: String(documentType.sort_order ?? 0),
          }
        : DEFAULTS,
    );
    resetCreateError();
    resetUpdateError();
  }, [open, documentType, reset, resetCreateError, resetUpdateError]);

  const missingCompany = !isEditing && companyId === undefined;
  const mutationError = isEditing ? updateError : createError;
  const isPending = isEditing ? isUpdating : isCreating;

  async function onSubmit(values: DocumentTypeFormValues) {
    const input = {
      name: values.name.trim(),
      category: values.category as DocumentTypeCategory,
      has_expiry: values.has_expiry,
      is_required: values.is_required,
      sort_order: values.sort_order === '' ? null : Number(values.sort_order),
    };

    if (documentType) {
      const result = await updateDocumentType({ id: documentType.id, ...input });
      if (result !== undefined) onOpenChange(false);
      return;
    }

    if (companyId === undefined) return;
    const result = await createDocumentType({ company_id: companyId, ...input });
    if (result !== undefined) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t(
          isEditing
            ? 'documents.documentTypes.form.editTitle'
            : 'documents.documentTypes.form.addTitle',
        )}
        description={t(
          isEditing
            ? 'documents.documentTypes.form.editDescription'
            : 'documents.documentTypes.form.addDescription',
        )}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button
              variant="primary"
              form={formId}
              type="submit"
              isLoading={isPending}
              disabled={missingCompany}
            >
              {t(
                isEditing
                  ? 'documents.documentTypes.form.save'
                  : 'documents.documentTypes.form.create',
              )}
            </Button>
          </>
        }
      >
        <form
          id={formId}
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          {mutationError ? (
            <p
              role="alert"
              className="rounded-[3px] border border-coral/30 bg-coral/5 px-4 py-2 text-caption text-coral"
            >
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          {missingCompany ? (
            <p
              role="alert"
              className="rounded-[3px] border border-coral/30 bg-coral/5 px-4 py-2 text-caption text-coral"
            >
              {t('documents.documentTypes.noCompany')}
            </p>
          ) : null}

          <Field
            label={t('documents.documentTypes.form.name')}
            htmlFor={`${prefix}-document-type-name`}
            required
            error={translate(t, errors.name?.message)}
          >
            <Input
              id={`${prefix}-document-type-name`}
              invalid={!!errors.name}
              {...register('name')}
            />
          </Field>

          <Field
            label={t('documents.documentTypes.form.category')}
            htmlFor={`${prefix}-document-type-category`}
            required
            error={translate(t, errors.category?.message)}
          >
            <Select
              id={`${prefix}-document-type-category`}
              invalid={!!errors.category}
              {...register('category')}
            >
              <option value="">{t('documents.documentTypes.form.selectCategory')}</option>
              {CATEGORY_VALUES.map((category) => (
                <option key={category} value={category}>
                  {t(`documents.documentTypes.categories.${category}`)}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex flex-col gap-3 rounded-[3px] border border-hairline px-4 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-body-sm text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-divider accent-navy"
                {...register('has_expiry')}
              />
              {t('documents.documentTypes.form.hasExpiry')}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-body-sm text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-divider accent-navy"
                {...register('is_required')}
              />
              {t('documents.documentTypes.form.isRequired')}
            </label>
          </div>

          <Field
            label={t('documents.documentTypes.form.sortOrder')}
            htmlFor={`${prefix}-document-type-sort-order`}
            hint={t('documents.documentTypes.form.sortOrderHint')}
            error={translate(t, errors.sort_order?.message)}
          >
            <Input
              id={`${prefix}-document-type-sort-order`}
              type="number"
              min={0}
              step={1}
              invalid={!!errors.sort_order}
              {...register('sort_order')}
            />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
