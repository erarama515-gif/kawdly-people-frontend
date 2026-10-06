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
import { useEmployeeList } from '@/features/employees/api/queries';
import { useCreateEmployeeDocument, useUpdateEmployeeDocument, useDocumentTypeList } from '../api/queries';
import type { EmployeeDocumentInput, EmployeeDocumentStatus } from '../api/resource';
import type { EmployeeDocumentWire } from '../api/schema';

/**
 * Add/Edit modal for one employee document record, built on `Dialog` +
 * react-hook-form + zod — same library combination as `AttendanceFormDialog`.
 *
 * Key points:
 *  - Employee picker: native `<select>` fed by `useEmployeeList({ page:1, perPage:100 })`.
 *  - Document type picker: native `<select>` fed by `useDocumentTypeList()`.
 *  - There is no real file-upload infrastructure yet — `file_path`, `file_name`,
 *    `mime_type`, and `file_size` are plain text/number inputs (known limitation).
 *  - Status enum is `valid | expired | pending_renewal` (real backend values).
 *  - Footer Save button uses `form="employee-document-form"` HTML5 attribute because
 *    the Dialog footer renders in a separate div from the form element.
 */

const REQUIRED = 'common.requiredField';

const DOCUMENT_STATUSES: readonly EmployeeDocumentStatus[] = [
  'valid',
  'expired',
  'pending_renewal',
];

const documentFormSchema = z.object({
  employee_id: z.string().min(1, REQUIRED),
  document_type_id: z.string().min(1, REQUIRED),
  title: z.string().min(1, REQUIRED),
  file_path: z.string().min(1, REQUIRED),
  file_name: z.string().min(1, REQUIRED),
  file_size: z.string(),
  mime_type: z.string(),
  issue_date: z.string(),
  expiry_date: z.string(),
  document_number: z.string(),
  notes: z.string(),
  status: z.string(),
});

type DocumentFormValues = z.infer<typeof documentFormSchema>;

function buildDefaultValues(record: EmployeeDocumentWire | undefined): DocumentFormValues {
  if (!record) {
    return {
      employee_id: '',
      document_type_id: '',
      title: '',
      file_path: '',
      file_name: '',
      file_size: '',
      mime_type: '',
      issue_date: '',
      expiry_date: '',
      document_number: '',
      notes: '',
      status: 'valid',
    };
  }

  return {
    employee_id: String(record.employee_id),
    document_type_id: String(record.document_type_id),
    title: record.title,
    file_path: record.file_path,
    file_name: record.file_name,
    file_size: record.file_size !== undefined ? String(record.file_size) : '',
    mime_type: record.mime_type ?? '',
    issue_date: record.issue_date ? record.issue_date.slice(0, 10) : '',
    expiry_date: record.expiry_date ? record.expiry_date.slice(0, 10) : '',
    document_number: record.document_number ?? '',
    notes: record.notes ?? '',
    status: record.status ?? 'valid',
  };
}

function toEmployeeDocumentInput(values: DocumentFormValues): EmployeeDocumentInput {
  return {
    employee_id: Number(values.employee_id),
    document_type_id: Number(values.document_type_id),
    title: values.title,
    file_path: values.file_path,
    file_name: values.file_name,
    file_size: values.file_size ? Number(values.file_size) : null,
    mime_type: values.mime_type.trim() || null,
    issue_date: values.issue_date || null,
    expiry_date: values.expiry_date || null,
    document_number: values.document_number.trim() || null,
    notes: values.notes.trim() || null,
    status: values.status ? (values.status as EmployeeDocumentStatus) : null,
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

export interface EmployeeDocumentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit (or pass `undefined`) to open in "Add Document" mode. */
  record?: EmployeeDocumentWire | undefined;
}

export function EmployeeDocumentFormDialog({
  open,
  onOpenChange,
  record,
}: EmployeeDocumentFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = record !== undefined;

  const createMutation = useCreateEmployeeDocument();
  const updateMutation = useUpdateEmployeeDocument();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  // Load employees for the picker
  const { state: employeeState } = useEmployeeList({ page: 1, perPage: 100 });
  const employees = employeeState.data?.data ?? [];

  // Load document types for the picker
  const { state: docTypeState } = useDocumentTypeList();
  const documentTypes = docTypeState.data ?? [];

  const resolver = useMemo(() => zodResolver(documentFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<DocumentFormValues>({
    resolver,
    defaultValues: buildDefaultValues(record),
  });

  // Re-seed the form every time the dialog opens.
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

  async function onSubmit(values: DocumentFormValues) {
    const input = toEmployeeDocumentInput(values);
    const result = isEdit
      ? await updateMutation.mutate({ id: record.id, ...input })
      : await createMutation.mutate(input);

    if (result) {
      handleOpenChange(false);
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof DocumentFormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('documents.editDocument') : t('documents.addDocument')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="employee-document-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="employee-document-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutationError ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          {/* Employee picker */}
          <Field label={t('documents.form.employee')} htmlFor="employee_id" required error={translate(t, errors.employee_id?.message)}>
            <Select id="employee_id" invalid={!!errors.employee_id} {...register('employee_id')}>
              <option value="">{t('common.selectPlaceholder')}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} — {emp.employee_number}
                </option>
              ))}
            </Select>
          </Field>

          {/* Document type picker */}
          <Field label={t('documents.form.documentType')} htmlFor="document_type_id" required error={translate(t, errors.document_type_id?.message)}>
            <Select id="document_type_id" invalid={!!errors.document_type_id} {...register('document_type_id')}>
              <option value="">{t('common.selectPlaceholder')}</option>
              {documentTypes.map((dt) => (
                <option key={dt.id} value={dt.id}>
                  {dt.name}
                </option>
              ))}
            </Select>
          </Field>

          {/* Title */}
          <Field label={t('documents.form.title')} htmlFor="title" required error={translate(t, errors.title?.message)}>
            <Input id="title" invalid={!!errors.title} {...register('title')} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            {/* File path */}
            <Field label={t('documents.form.filePath')} htmlFor="file_path" required error={translate(t, errors.file_path?.message)}>
              <Input id="file_path" invalid={!!errors.file_path} placeholder="/uploads/doc.pdf" {...register('file_path')} />
            </Field>

            {/* File name */}
            <Field label={t('documents.form.fileName')} htmlFor="file_name" required error={translate(t, errors.file_name?.message)}>
              <Input id="file_name" invalid={!!errors.file_name} placeholder="document.pdf" {...register('file_name')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* MIME type */}
            <Field label={t('documents.form.mimeType')} htmlFor="mime_type" error={translate(t, errors.mime_type?.message)}>
              <Input id="mime_type" invalid={!!errors.mime_type} placeholder="application/pdf" {...register('mime_type')} />
            </Field>

            {/* File size */}
            <Field label={t('documents.form.fileSize')} htmlFor="file_size" error={translate(t, errors.file_size?.message)}>
              <Input id="file_size" type="number" min="0" invalid={!!errors.file_size} {...register('file_size')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Issue date */}
            <Field label={t('documents.form.issueDate')} htmlFor="issue_date" error={translate(t, errors.issue_date?.message)}>
              <Input id="issue_date" type="date" invalid={!!errors.issue_date} {...register('issue_date')} />
            </Field>

            {/* Expiry date */}
            <Field label={t('documents.form.expiryDate')} htmlFor="expiry_date" error={translate(t, errors.expiry_date?.message)}>
              <Input id="expiry_date" type="date" invalid={!!errors.expiry_date} {...register('expiry_date')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Document number */}
            <Field label={t('documents.form.documentNumber')} htmlFor="document_number" error={translate(t, errors.document_number?.message)}>
              <Input id="document_number" invalid={!!errors.document_number} {...register('document_number')} />
            </Field>

            {/* Status */}
            <Field label={t('documents.form.statusLabel')} htmlFor="status" error={translate(t, errors.status?.message)}>
              <Select id="status" invalid={!!errors.status} {...register('status')}>
                <option value="">{t('common.selectPlaceholder')}</option>
                {DOCUMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`documents.statusOptions.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Notes */}
          <Field label={t('documents.form.notes')} htmlFor="notes" error={translate(t, errors.notes?.message)}>
            <Input id="notes" invalid={!!errors.notes} {...register('notes')} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
