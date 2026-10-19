/**
 * Toast notification system — Sprint 4.4 Micro-interactions.
 *
 * Usage:
 *   toast.success('common.saved');   // i18n key
 *   toast.error('Something failed'); // literal string
 *   toast.info('common.saved', 6000); // custom duration
 *
 * Mount <ToastContainer /> once at root level (outside the router).
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertCircle, Info, XCircle, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToastStore } from '@/stores/toast-store';
import type { ToastItem, ToastType } from '@/stores/toast-store';

// ─── Imperative helper ────────────────────────────────────────────────────────

/**
 * Grab the `addToast` action directly from the store so callers outside React
 * can trigger toasts without a hook.
 */
function getAddToast() {
  return useToastStore.getState().addToast;
}

export const toast = {
  success: (message: string, duration?: number) => getAddToast()('success', message, duration),
  error: (message: string, duration?: number) => getAddToast()('error', message, duration),
  info: (message: string, duration?: number) => getAddToast()('info', message, duration),
  warning: (message: string, duration?: number) => getAddToast()('warning', message, duration),
};

// ─── Type metadata ────────────────────────────────────────────────────────────

const TYPE_META: Record<
  ToastType,
  { Icon: typeof CheckCircle2; iconClass: string; barClass: string }
> = {
  success: {
    Icon: CheckCircle2,
    iconClass: 'text-emerald-700',
    barClass: 'bg-emerald-600',
  },
  error: {
    Icon: XCircle,
    iconClass: 'text-coral',
    barClass: 'bg-coral',
  },
  warning: {
    Icon: AlertCircle,
    iconClass: 'text-amber-600',
    barClass: 'bg-amber-500',
  },
  info: {
    Icon: Info,
    iconClass: 'text-navy',
    barClass: 'bg-navy',
  },
};

// ─── Single Toast ─────────────────────────────────────────────────────────────

interface ToastCardProps {
  toast: ToastItem;
  onRemove: (id: number) => void;
}

function ToastCard({ toast: item, onRemove }: ToastCardProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const removeRef = useRef(onRemove);
  removeRef.current = onRemove;

  // Message can be an i18n key or a plain string. t() is a no-op when the key
  // is not found (returns the key unchanged), so plain strings pass through.
  const message = t(item.message);
  const { Icon, iconClass, barClass } = TYPE_META[item.type];

  // Enter: mount → next frame → set visible (triggers CSS transition in).
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Auto-dismiss after `duration` ms.
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(), item.duration);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.duration]);

  function dismiss() {
    setLeaving(true);
    // Wait for the exit transition (300ms) then remove from store.
    window.setTimeout(() => removeRef.current(item.id), 300);
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={cn(
        // Base layout
        'relative flex w-[320px] max-w-[calc(100vw-2rem)] items-start gap-3 overflow-hidden',
        'rounded bg-surface border border-hairline shadow-lg',
        'px-4 py-3',
        // Transitions
        'transition-all duration-300 ease-out',
        // Enter state: start translated down + invisible
        !visible && !leaving && 'translate-y-4 opacity-0',
        // Visible state
        visible && !leaving && 'translate-y-0 opacity-100',
        // Exit state: slide out to the end + invisible
        leaving && 'translate-x-4 opacity-0',
      )}
    >
      {/* Type icon */}
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconClass)} strokeWidth={2} aria-hidden="true" />

      {/* Message */}
      <p className="flex-1 text-body-sm text-ink">{message}</p>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('common.cancel')}
        className="shrink-0 rounded p-0.5 text-ink-faint transition-colors hover:text-ink"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
      </button>

      {/* Auto-dismiss progress bar */}
      <span
        className={cn('absolute bottom-0 start-0 h-[2px] w-full origin-[0_50%]', barClass)}
        style={{
          animation: `toast-shrink ${item.duration}ms linear forwards`,
        }}
        aria-hidden="true"
      />
    </div>
  );
}

// ─── Container ────────────────────────────────────────────────────────────────

/**
 * Mount once at root level.  Uses `end-4` (logical) so the position mirrors
 * correctly in both LTR and RTL layouts.
 */
export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();
  // Show the newest 3 only; older ones are in the queue but not rendered.
  const visible = toasts.slice(-3);

  return (
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-4 end-4 z-[9999] flex flex-col-reverse items-end gap-2"
    >
      {visible.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <ToastCard toast={item} onRemove={removeToast} />
        </div>
      ))}
    </div>
  );
}
