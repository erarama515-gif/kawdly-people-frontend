import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { useSession } from '@/auth/session';
import { userFacingMessage } from '@/lib/api/errors';
import { useDashboardData, useDismissAlert, useResolveQueueItem } from '../api';
import type { AlertItemId, QueueItemId } from '../api';
import type { DecisionQueueRow } from '../model';
import { useDashboardRoleOverride } from '../useDashboardRoleOverride';
import { ActionError } from './ActionError';
import { AlertStrip } from './AlertStrip';
import { DashboardError } from './DashboardError';
import { DashboardPageSkeleton } from './DashboardPageSkeleton';
import { DecisionQueue } from './DecisionQueue';
import { FooterBar } from './FooterBar';
import { HeroHeader } from './HeroHeader';
import { KpiStrip } from './KpiStrip';
import { DepartmentsCard, RosterCard } from './RightRailCards';
import { RightRail } from './RightRail';
import { TrendsBand } from './TrendsBand';

/** Chip exit plays first (200ms); the 0fr row collapse finishes later (380ms + 140ms delay). */
const CHIP_EXIT_MS = 260;
const ROW_COLLAPSE_MS = 620;

/**
 * Dashboard page = full-bleed ledger within the AppShell's 1440 content
 * column. Hero and alert band break out of the gutters; the KPI strip, trends
 * band, queue/rail grid and footer share the same bordered ledger column.
 *
 * Layout and copy are unchanged from the design review build. What changed is
 * where the numbers come from: everything below the hero is served by
 * `DashboardApi` through the query cache, with skeleton, error and stale-refresh
 * states, and the queue resolve is now a real mutation rather than a local
 * decrement.
 */
export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { user } = useSession();
  const { role } = useDashboardRoleOverride();
  const language = i18n.language === 'en' ? 'en' : 'ar';
  const { scope, dataset, alerts, refresh } = useDashboardData();
  const resolveQueue = useResolveQueueItem(scope);
  const dismissAlert = useDismissAlert(scope);

  const data = dataset.data;

  // Queue choreography (chip exit + 0fr row collapse + the empty state) is
  // presentation state, so it stays here rather than in the cache. Counts come
  // from the server payload; these sets only mark what the user just resolved.
  const [removing, setRemoving] = useState<ReadonlySet<QueueItemId>>(new Set());
  const [removed, setRemoved] = useState<ReadonlySet<QueueItemId>>(new Set());
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  // A role switch swaps the whole dataset, so the choreography resets with it.
  useEffect(() => {
    clearTimers();
    setRemoving(new Set());
    setRemoved(new Set());
  }, [role, clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

  const counts = deriveCounts(data?.queues);

  /**
   * Resolving a row is a real write, so the exit choreography only starts once
   * the server has accepted it. If the write fails the cache rolls the count
   * back and the row stays put — the user sees a retry affordance instead of a
   * row silently vanishing.
   */
  const onResolve = useCallback(
    (id: QueueItemId) => {
      if ((counts[id] ?? 0) <= 0 || resolveQueue.isPending) return;

      void resolveQueue.mutate(id).then((result) => {
        // Undefined means the write failed: the cache has already rolled the
        // count back, so the row stays visible with the retry affordance.
        if (!result || result.queue.count > 0) return;

        setRemoving((prev) => new Set(prev).add(id));
        timersRef.current.push(
          window.setTimeout(() => {
            setRemoving((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
          }, CHIP_EXIT_MS),
          window.setTimeout(() => {
            setRemoved((prev) => new Set(prev).add(id));
          }, ROW_COLLAPSE_MS),
        );
      });
    },
    [counts, resolveQueue.isPending, resolveQueue.mutate],
  );

  const roleLabel = t(role === 'hr_admin' ? 'dashboard.role.admin' : 'dashboard.role.manager');
  const today = new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  if (!data) {
    return dataset.status === 'error' ? (
      <DashboardError onRetry={refresh} />
    ) : (
      <DashboardPageSkeleton />
    );
  }

  return (
    <div className="flex flex-col">
      {/*
        A failed write rolls the cache back; a failed *refresh* keeps the last
        good numbers. Both surface in the same quiet strip rather than a toast,
        so the ledger stays readable behind the notice.
      */}
      {resolveQueue.error ? (
        <ActionError message={userFacingMessage(resolveQueue.error)} onRetry={resolveQueue.reset} />
      ) : dataset.status === 'error' ? (
        <ActionError message={userFacingMessage(dataset.error)} onRetry={refresh} />
      ) : null}

      <HeroHeader
        user={user}
        role={role}
        roleLabel={roleLabel}
        today={today}
        rows={data.queues}
        counts={counts}
        removing={removing}
      />

      <AlertStrip
        alerts={alerts.data ?? []}
        onDismiss={async (id: AlertItemId) => (await dismissAlert.mutate(id)) !== undefined}
        isPending={dismissAlert.isPending}
        error={alerts.status === 'error'}
        onRetry={refresh}
      />

      <div className="flex flex-col">
        <section data-testid="kpi-strip" className="border border-hairline border-t-0 bg-hairline">
          {/* Keyed by role so switching roles restarts the count-up for the new set. */}
          <KpiStrip key={role} kpis={data.kpis} />
        </section>

        <div className="flex items-center justify-end gap-2 bg-page py-2">
          <span className="nums font-mono text-[10px] font-medium text-ink-faint">
            {t('dashboard.kpi.updatedAt', { time: formatTime(data.updatedAt, language) })}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={dataset.isFetching || alerts.isFetching}
            aria-label={t('dashboard.kpi.refresh')}
            title={t('dashboard.kpi.refresh')}
            className="grid h-5 w-5 place-items-center rounded-[2px] border-0 bg-transparent text-ink-faint transition-colors duration-150 hover:bg-surface-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw
              className={dataset.isFetching || alerts.isFetching ? 'h-3 w-3 animate-spin' : 'h-3 w-3'}
              strokeWidth={2}
              aria-hidden="true"
            />
          </button>
        </div>

        <div className="border border-hairline">
          <TrendsBand kpis={data.kpis} labels={data.attendance.weekLabels} language={language} />
        </div>

        <div className="grid gap-px border-x border-b border-hairline bg-hairline lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-px bg-page">
            <DecisionQueue
              rows={data.queues}
              counts={counts}
              removing={removing}
              removed={removed}
              role={role}
              isResolving={resolveQueue.isPending}
              onResolve={onResolve}
            />
            {role === 'hr_admin' ? (
              <DepartmentsCard rows={data.departments} language={language} />
            ) : (
              <RosterCard members={data.teamRoster} language={language} />
            )}
          </div>

          <RightRail
            attendance={data.attendance}
            upcoming={data.upcoming}
            className="w-full min-w-0 lg:w-auto"
            language={language}
          />
        </div>

        <FooterBar />
      </div>

      <div className="h-8 md:h-10" aria-hidden="true" />
    </div>
  );
}

/** Queue counts by id, derived from the server payload rather than held locally. */
function deriveCounts(rows: DecisionQueueRow[] | undefined): Record<QueueItemId, number> {
  const counts = {} as Record<QueueItemId, number>;
  for (const row of rows ?? []) counts[row.id] = row.count;
  return counts;
}

function formatTime(iso: string, language: 'ar' | 'en'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }).format(date);
}
