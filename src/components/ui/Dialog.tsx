import type { ReactNode } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Generic modal shell, extracted from the Radix `Dialog.Root/Portal/Overlay/Content`
 * pattern already proven in `CommandPalette.tsx` — same overlay tint, same
 * `rounded-[3px] border border-hairline bg-surface` chrome, same entrance
 * animation. Every Add/Edit/Delete modal in the app should compose `Dialog` +
 * `DialogContent` rather than reaching for Radix directly, so that chrome stays
 * in exactly one place.
 */

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </RadixDialog.Root>
  );
}

export interface DialogContentProps {
  title: ReactNode;
  description?: ReactNode;
  /** Omit for a header/footer-only dialog (e.g. a confirmation with no extra body copy). */
  children?: ReactNode;
  /** Rendered in a sticky footer below the scrollable body, e.g. Cancel/Save. */
  footer?: ReactNode;
  className?: string;
  onOpenAutoFocus?: (event: Event) => void;
}

export function DialogContent({
  title,
  description,
  children,
  footer,
  className,
  onOpenAutoFocus,
}: DialogContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-[rgba(7,45,74,0.45)]" />
      <RadixDialog.Content
        onOpenAutoFocus={onOpenAutoFocus}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-48px)] w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[3px] border border-hairline bg-surface focus:outline-none data-[state=open]:animate-dialog-in',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-divider px-6 py-4">
          <div className="min-w-0">
            <RadixDialog.Title className="text-heading-md text-ink">{title}</RadixDialog.Title>
            {description ? (
              <RadixDialog.Description className="mt-1 text-body-sm text-ink-muted">
                {description}
              </RadixDialog.Description>
            ) : null}
          </div>
          <RadixDialog.Close
            aria-label="Close"
            className="shrink-0 rounded-[3px] p-1 text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink focus:outline-none"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </RadixDialog.Close>
        </div>

        {children ? <div className="scrollbar-slim flex-1 overflow-y-auto px-6 py-5">{children}</div> : null}

        {footer ? <div className="flex items-center justify-end gap-2 border-t border-divider px-6 py-4">{footer}</div> : null}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

/** Re-exported so callers can wire a "Cancel" button to close the dialog without lifting state. */
export const DialogClose = RadixDialog.Close;
