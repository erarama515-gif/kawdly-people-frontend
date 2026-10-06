import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

interface ActionErrorProps {
  message: string;
  onRetry: () => void;
  className?: string;
}

/**
 * Inline failure notice for a write that did not land (resolve, dismissal).
 * Deliberately a quiet strip rather than a toast: the ledger stays on screen
 * behind it so the user can compare the unchanged numbers with the failure.
 */
export function ActionError({ message, onRetry, className }: ActionErrorProps) {
  const { t } = useTranslation();

  return (
    <div
      role="alert"
      className={cn(
        'flex items-center gap-3 border-b border-hairline bg-coral/10 px-4 py-2.5 md:px-12',
        className,
      )}
    >
      <span className="min-w-0 flex-1 text-[13px] text-ink">{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 cursor-pointer whitespace-nowrap border-0 bg-transparent p-0 text-[12px] font-semibold text-coral underline-offset-2 hover:underline"
      >
        {t('dashboard.stale.retry')}
      </button>
    </div>
  );
}