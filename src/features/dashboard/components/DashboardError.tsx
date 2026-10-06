import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { userFacingMessage } from '@/lib/api/errors';

interface DashboardErrorProps {
  onRetry: () => void;
  /** Overrides the generic copy; pass `userFacingMessage(error)` for specifics. */
  message?: string;
}

export function DashboardError({ onRetry, message }: DashboardErrorProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="flex max-w-md flex-col items-center text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-coral/10 text-coral">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-[20px] font-semibold text-ink">{t('dashboard.error.title')}</h1>
        <p className="mt-2 text-body-sm text-ink-muted">
          {message ?? userFacingMessage(t('dashboard.error.description'))}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center rounded-[3px] border-[1.5px] border-navy bg-navy px-4 py-2 text-[13px] font-semibold text-on-navy transition-colors duration-150 hover:bg-navy-deep"
        >
          {t('dashboard.error.retry')}
        </button>
      </div>
    </div>
  );
}
