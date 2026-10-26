import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Sparkles } from 'lucide-react';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/form';
import { toast } from '@/components/ui/Toast';
import { userFacingMessage } from '@/lib/api/errors';
import { useEmployeeList } from '@/features/employees/api/queries';
import {
  useDocumentTemplateOptions,
  useGenerateDocument,
  usePreviewDocument,
  useTemplateVariables,
} from '../api/generatedDocuments';

export interface GenerateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Template → employee → overrides → preview → generate.
 *
 * The variable catalogue comes from `GET /document-templates/variables` (the
 * endpoint that used to be shadowed by the template `show` route). Every
 * employee/company/salary placeholder is resolved server-side; only the three
 * `document.*` values are caller-supplied, so the form stays short while still
 * showing the full catalogue for reference.
 */
export function GenerateDocumentDialog({ open, onOpenChange }: GenerateDocumentDialogProps) {
  const { t } = useTranslation();

  const { state: templateState } = useDocumentTemplateOptions();
  const { state: employeeState } = useEmployeeList({ page: 1, perPage: 200 });
  const variablesState = useTemplateVariables();
  const previewMutation = usePreviewDocument();
  const generateMutation = useGenerateDocument();

  const [templateId, setTemplateId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [previewHtml, setPreviewHtml] = useState<string | undefined>(undefined);

  const templates = templateState.data ?? [];
  const employees = employeeState.data?.data ?? [];
  const variables = variablesState.data;

  const selectedTemplate = useMemo(
    () => templates.find((template) => String(template.id) === templateId),
    [templates, templateId],
  );

  useEffect(() => {
    if (!open) return;
    setTemplateId('');
    setEmployeeId('');
    setPreviewHtml(undefined);
    previewMutation.reset();
    generateMutation.reset();
    // Reset only when the dialog opens; the mutation objects are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      previewMutation.reset();
      generateMutation.reset();
    }
    onOpenChange(next);
  }

  async function handlePreview() {
    if (!templateId || !employeeId) return;
    setPreviewHtml(undefined);
    try {
      const html = await previewMutation.mutateAsync({
        templateId: Number(templateId),
        employeeId: Number(employeeId),
      });
      setPreviewHtml(html);
    } catch {
      // The error banner below renders `previewMutation.error`.
    }
  }

  async function handleGenerate() {
    if (!templateId || !employeeId) return;
    try {
      const document = await generateMutation.mutateAsync({
        template_id: Number(templateId),
        employee_id: Number(employeeId),
      });
      toast.success(
        t('documents.generated.generatedToast', { reference: document.reference_number }),
      );
      handleOpenChange(false);
    } catch {
      // The error banner below renders `generateMutation.error`.
    }
  }

  const error = generateMutation.error ?? previewMutation.error;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-[min(1000px,calc(100vw-32px))]"
        title={t('documents.generated.generateTitle')}
        description={t('documents.generated.generateHint')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={generateMutation.isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button
              variant="secondary"
              onClick={() => void handlePreview()}
              isLoading={previewMutation.isPending}
              disabled={!templateId || !employeeId || generateMutation.isPending}
            >
              <FileText className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              {t('documents.generated.preview')}
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleGenerate()}
              isLoading={generateMutation.isPending}
              disabled={!templateId || !employeeId || previewMutation.isPending}
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              {t('documents.generated.generate')}
            </Button>
          </>
        }
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            {error ? (
              <p
                role="alert"
                className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral"
              >
                {userFacingMessage(error)}
              </p>
            ) : null}

            <Field label={t('documents.generated.fields.template')} htmlFor="generate_template" required>
              <Select
                id="generate_template"
                value={templateId}
                onChange={(event) => {
                  setTemplateId(event.target.value);
                  setPreviewHtml(undefined);
                }}
              >
                <option value="">{t('documents.generated.selectPlaceholder')}</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                    {template.category ? ` — ${template.category}` : ''}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('documents.generated.fields.employee')} htmlFor="generate_employee" required>
              <Select
                id="generate_employee"
                value={employeeId}
                onChange={(event) => {
                  setEmployeeId(event.target.value);
                  setPreviewHtml(undefined);
                }}
              >
                <option value="">{t('documents.generated.selectPlaceholder')}</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.first_name_ar && employee.last_name_ar
                      ? `${employee.first_name_ar} ${employee.last_name_ar}`
                      : `${employee.first_name} ${employee.last_name}`}{' '}
                    — {employee.employee_number}
                  </option>
                ))}
              </Select>
            </Field>

            <p className="rounded-[3px] border border-dashed border-hairline px-3 py-2 text-caption text-ink-muted">
              {t('documents.generated.autoMetaHint')}
            </p>

            <details className="rounded-[3px] border border-hairline bg-surface/40 px-3 py-2">
              <summary className="cursor-pointer text-caption font-semibold text-ink">
                {t('documents.generated.availableVariables')}
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                {variables
                  ? Object.entries(variables).map(([group, names]) => (
                      <div key={group} className="flex flex-col gap-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                          {group}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {names.map((name) => (
                            <code
                              key={name}
                              dir="ltr"
                              className="rounded-[2px] bg-surface-hover px-1.5 py-0.5 font-mono text-[10px] text-ink-muted"
                            >
                              {name}
                            </code>
                          ))}
                        </div>
                      </div>
                    ))
                  : null}
              </div>
            </details>
          </div>

          <div className="flex min-h-[360px] flex-col">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-caption font-semibold text-ink">
                {t('documents.generated.previewTitle')}
              </span>
              {selectedTemplate ? (
                <span className="text-caption text-ink-muted">{selectedTemplate.name}</span>
              ) : null}
            </div>
            {previewHtml ? (
              <iframe
                title={t('documents.generated.previewTitle')}
                srcDoc={previewHtml}
                sandbox=""
                className="h-[360px] w-full flex-1 rounded-[3px] border border-hairline bg-white"
              />
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-[3px] border border-dashed border-hairline px-4 text-center text-caption text-ink-muted">
                {t('documents.generated.previewEmpty')}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
