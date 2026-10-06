import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogClose } from './Dialog';
import { Button } from './Button';
import type { ButtonVariant } from './Button';

/**
 * Destructive-action confirmation, built on top of `Dialog`. Used for every
 * "Delete X" affordance so the app never fires a mutation straight off a
 * single click.
 */

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Defaults to the shared "Confirm"/"Cancel" strings in the `common` namespace. */
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  isLoading?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmVariant = 'danger',
  isLoading,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={title}
        description={description}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isLoading}>
                {cancelLabel ?? t('common.cancel')}
              </Button>
            </DialogClose>
            <Button variant={confirmVariant} isLoading={isLoading ?? false} onClick={onConfirm}>
              {confirmLabel ?? t('common.confirm')}
            </Button>
          </>
        }
      />
    </Dialog>
  );
}
