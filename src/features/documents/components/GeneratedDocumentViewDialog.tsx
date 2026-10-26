import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/form';
import { toast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { userFacingMessage } from '@/lib/api/errors';
import { useHasPermission } from '@/auth/session';
import {
  downloadGeneratedDocument,
  useFinalizeGeneratedDocument,
  useRevokeGeneratedDocument,
} from '../api/generatedDocuments';
import type {
  GeneratedDocumentStatus,
  GeneratedDocumentWire,
} from '../api/generatedDocuments';

const STATUS_CLASSES: Record<GeneratedDocumentStatus, string> = {
  draft: 'bg-amber-50 text-amber-700',
  final: 'bg-emerald-50 text-emerald-700',
  revoked: 'bg-red-50 text-red-700',
};

function formatDateTime(value: string | undefined, language: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(language.startsWith('ar') ? 'ar-EG' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface GeneratedDocumentViewDialogProps {
  document: GeneratedDocumentWire | undefined;
  onClose: () => void;
}

/**
 * Read-only view of one generated document: metadata, the rendered HTML, and
 * the lifecycle actions (finalize → PDF, revoke with a mandatory reason,
 * download). Finalize and revoke are hidden without their exact Spatie slugs.
 */
export function GeneratedDocumentViewDialog({
  document,
  onClose,
}: GeneratedDocumentViewDialogProps) {
  const { t, i18n } = useTranslation();
  const canFinalize = useHasPermission('document.generated_document.finalize');
  const canRevoke = useHasPermission('document.generated_document.revoke');

  const finalizeMutation = useFinalizeGeneratedDocument();
  const revokeMutation = useRevokeGeneratedDocument();

  const [downloading, setDownloading] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (document) {
      setRevokeOpen(false);
      setReason('');
      finalizeMutation.reset();
      revokeMutation.reset();
    }
    // Reset only when the target document changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document?.id]);

  if (!document) return null;

  const employeeName = document.employee
    ? document.employee.first_name_ar && document.employee.last_name_ar
      ? `${document.employee.first_name_ar} ${document.employee.last_name_ar}`
      : `${document.employee.first_name} ${document.employee.last_name}`
    : `#${document.employee_id}`;

  async function handleFinalize() {
    try {
      await finalizeMutation.mutateAsync(document!.id);
      toast.success(t('documents.generated.finalizedToast'));
    } catch (error) {
      toast.error(userFacingMessage(error));
    }
  }

  async function handleDownload() {
    if (!document) return;
    setDownloading(true);
    try {
      await downloadGeneratedDocument(document);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message.includes('404')
          ? t('documents.generated.downloadUnavailable')
          : userFacingMessage(error),
      );
    } finally {
      setDownloading(false);
    }
  }

  async function handleRevoke() {
    if (!document) return;
    if (reason.trim().length < 3) return;
    try {
      await revokeMutation.mutateAsync({ id: document.id, reason: reason.trim() });
      toast.success(t('documents.generated.revokedToast'));
      setRevokeOpen(false);
      onClose();
    } catch (error) {
      toast.error(userFacingMessage(error));
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className="w-[min(900px,calc(100vw-32px))]"
          title={document.title}
          description={
            <span className="nums font-mono text-[12px]" dir="ltr">
              {document.reference_number}
            </span>
          }
          footer={
            <>
              <DialogClose asChild>
                <Button variant="secondary">{t('common.close')}</Button>
              </DialogClose>
              {document.file_path ? (
                <Button variant="secondary" isLoading={downloading} onClick={() => void handleDownload()}>
                  <Download className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                  {t('documents.generated.download')}
                </Button>
              ) : null}
              {canFinalize && document.status === 'draft' ? (
                <Button
                  variant="primary"
                  isLoading={finalizeMutation.isPending}
                  onClick={() => void handleFinalize()}
                >
                  {t('documents.generated.finalize')}
                </Button>
              ) : null}
              {canRevoke && document.status !== 'revoked' ? (
                <Button
                  variant="secondary"
                  className="!text-coral hover:!bg-coral/5"
                  onClick={() => setRevokeOpen(true)}
                >
                  {t('documents.generated.revoke')}
                </Button>
              ) : null}
            </>
          }
        >
          <div className="mb-4 grid grid-cols-2 gap-3 border-b border-divider pb-4 sm:grid-cols-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-caption text-ink-faint">{t('documents.generated.table.employee')}</span>
              <span className="truncate text-[12px] text-ink">{employeeName}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-caption text-ink-faint">{t('documents.generated.table.template')}</span>
              <span className="truncate text-[12px] text-ink">{document.template?.name ?? '—'}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-caption text-ink-faint">{t('documents.generated.table.generatedAt')}</span>
              <span className="nums font-mono text-[12px] text-ink">
                {formatDateTime(document.generated_at, i18n.language)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-caption text-ink-faint">{t('documents.generated.table.status')}</span>
              <span
                className={cn(
                  'w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                  STATUS_CLASSES[document.status],
                )}
              >
                {t(`documents.generated.status.${document.status}`)}
              </span>
            </div>
            {document.status === 'revoked' && document.revoke_reason ? (
              <div className="col-span-full flex flex-col gap-0.5">
                <span className="text-caption text-ink-faint">{t('documents.generated.revokeReason')}</span>
                <span className="text-[12px] text-coral">{document.revoke_reason}</span>
              </div>
            ) : null}
          </div>

          <iframe
            title={document.title}
            srcDoc={document.content_html}
            sandbox=""
            className="h-[420px] w-full rounded-[3px] border border-hairline bg-white"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <DialogContent
          title={t('documents.generated.revokeTitle')}
          description={t('documents.generated.revokeHint')}
          footer={
            <>
              <DialogClose asChild>
                <Button variant="secondary" disabled={revokeMutation.isPending}>
                  {t('common.cancel')}
                </Button>
              </DialogClose>
              <Button
                variant="danger"
                isLoading={revokeMutation.isPending}
                disabled={reason.trim().length < 3}
                onClick={() => void handleRevoke()}
              >
                {t('documents.generated.revokeConfirm')}
              </Button>
            </>
          }
        >
          <Field label={t('documents.generated.revokeReason')} htmlFor="revoke_reason" required>
            <Textarea
              id="revoke_reason"
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              invalid={reason.length > 0 && reason.trim().length < 3}
            />
          </Field>
        </DialogContent>
      </Dialog>
    </>
  );
}
