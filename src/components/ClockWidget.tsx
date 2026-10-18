import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, LogIn, LogOut } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { useClockIn, useClockOut, useMyClockStatus } from '@/features/attendance/api/clockQueries';

/**
 * ClockWidget — self-service clock-in / clock-out card.
 *
 * Shows:
 *  - Current wall-clock time (ticks every second client-side)
 *  - "Clock In" when not yet clocked in today
 *  - "Clock Out" when clocked in but not yet out
 *  - Elapsed time since clock-in (live counter)
 *  - A "Done for today" state when already clocked out
 *
 * Drop this anywhere: dashboard RightRail, TopBar, etc.
 */
export function ClockWidget({ className }: { className?: string }) {
  const { t } = useTranslation();

  // ------------------------------------------------------------------
  // Live wall clock (ticks every second)
  // ------------------------------------------------------------------
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  // ------------------------------------------------------------------
  // Server-side status (polls every 60s)
  // ------------------------------------------------------------------
  const { state: statusState, refetch: refetchStatus } = useMyClockStatus();
  const status = statusState.status === 'success' ? statusState.data : null;

  const clockIn  = useClockIn();
  const clockOut = useClockOut();

  // ------------------------------------------------------------------
  // Derived elapsed
  // ------------------------------------------------------------------
  const elapsedMs = status?.clocked_in && !status?.clocked_out && status?.check_in
    ? now.getTime() - new Date(status.check_in).getTime()
    : 0;

  const elapsed = formatElapsed(elapsedMs);

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------
  const handleClockIn = async () => {
    await clockIn.mutate(undefined);
    void refetchStatus();
  };

  const handleClockOut = async () => {
    await clockOut.mutate(undefined);
    void refetchStatus();
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  const isLoading = statusState.status === 'pending';
  const mutating  = clockIn.isPending || clockOut.isPending;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-[3px] border border-hairline bg-surface p-4',
        className,
      )}
    >
      {/* Live clock */}
      <div className="flex items-center gap-2 text-ink-muted">
        <Clock className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <div>
          <p className="nums font-mono text-[22px] font-bold leading-none tracking-[-0.04em] text-ink">
            {timeStr}
          </p>
          <p className="text-[11px] text-ink-muted">{dateStr}</p>
        </div>
      </div>

      {/* Status / action */}
      {isLoading ? (
        <div className="h-9 animate-pulse rounded bg-surface-hover" />
      ) : status?.clocked_out ? (
        // Already done for today
        <div className="rounded-[3px] bg-surface-hover px-3 py-2 text-center">
          <p className="text-[12px] font-semibold text-ink">
            {t('clockWidget.doneForToday', 'Done for today')}
          </p>
          {status.check_in && status.check_out ? (
            <p className="text-[11px] text-ink-muted">
              {formatTime(status.check_in)} – {formatTime(status.check_out)}
            </p>
          ) : null}
        </div>
      ) : status?.clocked_in ? (
        // Clocked in — show elapsed + clock out button
        <div className="flex flex-col gap-2">
          <div className="rounded-[3px] bg-surface-hover px-3 py-2">
            <p className="text-[11px] text-ink-muted">
              {t('clockWidget.clockedInAt', 'Clocked in at')}{' '}
              {status.check_in ? formatTime(status.check_in) : '—'}
            </p>
            <p className="nums font-mono text-[18px] font-bold leading-none tracking-[-0.04em] text-navy">
              {elapsed}
            </p>
          </div>
          <Button
            variant="secondary"
            isLoading={clockOut.isPending}
            disabled={mutating}
            onClick={() => void handleClockOut()}
            className="w-full justify-center gap-1.5"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            {t('clockWidget.clockOut', 'Clock Out')}
          </Button>
          {clockOut.error ? (
            <p className="text-[11px] text-coral">{clockOut.error.message}</p>
          ) : null}
        </div>
      ) : (
        // Not yet clocked in
        <div className="flex flex-col gap-2">
          <p className="text-[12px] text-ink-muted">
            {t('clockWidget.notClockedIn', 'Not clocked in yet today')}
          </p>
          <Button
            variant="primary"
            isLoading={clockIn.isPending}
            disabled={mutating}
            onClick={() => void handleClockIn()}
            className="w-full justify-center gap-1.5"
          >
            <LogIn className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            {t('clockWidget.clockIn', 'Clock In')}
          </Button>
          {clockIn.error ? (
            <p className="text-[11px] text-coral">{clockIn.error.message}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatElapsed(ms: number): string {
  if (ms <= 0) return '0:00:00';
  const totalSecs = Math.floor(ms / 1_000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}
