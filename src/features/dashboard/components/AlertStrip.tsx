import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import type { AlertItemId, AlertWire } from '../api';

interface AlertStripProps {
  alerts: AlertWire[];
  /** Returns true when the server accepted the dismissal; false rolls the row back. */
  onDismiss: (id: AlertItemId) => Promise<boolean>;
  isPending: boolean;
  /** Set when the alert resource itself failed, so the band can offer a retry. */
  error: boolean;
  onRetry: () => void;
}

/**
 * The alert band under the hero: white rows with a coral dot, message and a
 * dismiss control. Rows come from the API as ordered message segments, so the
 * wording (including which value is emphasised) is server-owned; this component
 * only renders them. Breaks out of the content gutters to span the whole column;
 * the last row's bottom hairline doubles as the ledger's top rule.
 */
export function AlertStrip({ alerts, onDismiss, isPending, error, onRetry }: AlertStripProps) {
  if (alerts.length === 0 && !error) return null;

  return (
    <div className="-mx-4 flex flex-col md:-mx-12">
      {alerts.map((alert) => (
        <AlertRow key={alert.id} onDismiss={() => onDismiss(alert.id)} isPending={isPending}>
          <AlertMessage alert={alert} />
        </AlertRow>
      ))}
      {error ? <AlertErrorRow onRetry={onRetry} /> : null}
    </div>
  );
}

function AlertMessage({ alert }: { alert: AlertWire }) {
  const { t } = useTranslation();
  return (
    <span className="text-[14px] text-ink">
      {alert.segments.map((segment, index) =>
        segment.kind === 'text' ? (
          <span key={index}>{t(segment.key)}</span>
        ) : (
          <b key={index} className="nums font-bold text-ink">
            {alert.params?.[segment.name] ?? ''}
          </b>
        ),
      )}
    </span>
  );
}

function AlertErrorRow({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex h-11 items-center gap-3 border-b border-hairline bg-surface px-4 md:px-12">
      <span className="h-2 w-2 shrink-0 rounded-full bg-ink-faint" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-[13px] text-ink-muted">{t('dashboard.alerts.loadFailed')}</span>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 cursor-pointer whitespace-nowrap border-0 bg-transparent text-[12px] font-semibold text-coral underline-offset-2 hover:underline"
      >
        {t('dashboard.stale.retry')}
      </button>
    </div>
  );
}

function AlertRow({
  children,
  onDismiss,
  isPending,
}: {
  children: ReactNode;
  onDismiss: () => Promise<boolean>;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [isClosed, setIsClosed] = useState(false);

  if (isClosed) return null;

  // Dismissal is optimistic so the row leaves instantly; if the write fails the
  // server puts the alert back and the row reappears with it.
  const handleDismiss = () => {
    setIsClosed(true);
    void onDismiss().then((accepted) => {
      if (!accepted) setIsClosed(false);
    });
  };

  return (
    <div className="flex h-11 items-center gap-3 border-b border-hairline bg-surface px-4 md:px-12">
      <span className="h-2 w-2 shrink-0 rounded-full bg-coral" aria-hidden="true" />
      <span className="min-w-0 flex-1 leading-snug">{children}</span>
      <button
        type="button"
        onClick={handleDismiss}
        disabled={isPending}
        aria-label={t('dashboard.alerts.dismiss')}
        className={cn(
          'grid h-6 w-6 shrink-0 place-items-center rounded-[3px] border-0 bg-transparent',
          'text-[18px] leading-none text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink',
          isPending && 'cursor-not-allowed opacity-50',
        )}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}