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
import { RosterCard } from './RightRailCards';
import { RightRail } from './RightRail';
import { TrendsBand } from './TrendsBand';
import { OrgTreemap } from './OrgTreemap';
import { WhatChanged } from './WhatChanged';
import { UpcomingCard } from './RightRailCards';

/** Chip exit plays first (200ms); the 0fr row collapse finishes later (380ms + 140ms delay). */
const CHIP_EXIT_MS = 260;
const ROW_COLLAPSE_MS = 620;

/**
 * Dashboard page — redesigned to match the new Kawdly People Dashboard
 * template. Structure:
 *
 * 1. Hero header (greeting, date, quick actions)
 * 2. KPI strip (3 metric tiles + navy "Open actions" panel)
 * 3. Updated timestamp + refresh
 * 4. Decision queue + "What changed" / Upcoming (2-column)
 * 5. Trend charts (question/answer format with area fills)
 * 6. Org treemap + Attendance sidebar (2-column)
 * 7. Footer
 *
 * All data comes from the real API through the query cache.
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

  const [removing, setRemoving] = useState<ReadonlySet<QueueItemId>>(new Set());
  const [removed, setRemoved] = useState<ReadonlySet<QueueItemId>>(new Set());
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    clearTimers();
    setRemoving(new Set());
    setRemoved(new Set());
  }, [role, clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

  const counts = deriveCounts(data?.queues);

  const onResolve = useCallback(
    (id: QueueItemId) => {
      if ((counts[id] ?? 0) <= 0 || resolveQueue.isPending) return;

      void resolveQueue.mutate(id).then((result) => {
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

  const roleLabel = t(role === 'department_manager' ? 'dashboard.role.manager' : 'dashboard.role.admin');
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
        {/* 1. KPI strip with Open Actions panel */}
        <section
          data-testid="kpi-strip"
          className="border-t-[2px] border-b border-hairline bg-hairline"
          style={{ borderTopColor: 'var(--color-ink, #14202e)' }}
        >
          <KpiStrip key={role} kpis={data.kpis} queues={data.queues} counts={counts} />
        </section>

        {/* Updated timestamp */}
        <div className="flex items-center justify-end gap-2 bg-page py-2">
          <span className="nums font-mono text-[10px] font-medium text-ink-faint" dir="ltr">
            {t('dashboard.kpi.updatedAt', { time: formatTime(data.updatedAt, language) })} · live
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

        {/* 2. Decision queue + What changed / Upcoming (2-column) */}
        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          {/* Left: Decision queue */}
          <div className="border border-hairline" style={{ borderTopWidth: 3, borderTopColor: 'var(--color-coral, #e8694a)' }}>
            <DecisionQueue
              rows={data.queues}
              counts={counts}
              removing={removing}
              removed={removed}
              role={role}
              isResolving={resolveQueue.isPending}
              onResolve={onResolve}
            />
          </div>

          {/* Right: What changed + Upcoming */}
          <div className="flex flex-col gap-6">
            <WhatChanged kpis={data.kpis} departments={data.departments} language={language} />
            <UpcomingCard items={data.upcoming} language={language} className="border border-hairline" />
          </div>
        </div>

        {/* 3. Trends section — question/answer charts */}
        <div className="mt-8 border border-hairline">
          <TrendsBand kpis={data.kpis} labels={data.attendance.weekLabels} language={language} />
        </div>

        {/* 4. Org treemap + Attendance sidebar (2-column) */}
        <div className="mt-8 grid items-start gap-7 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
          {/* Left: Treemap or Departments card */}
          {role === 'department_manager' ? (
            <RosterCard members={data.teamRoster} language={language} className="border border-hairline" />
          ) : (
            <OrgTreemap rows={data.departments} language={language} />
          )}

          {/* Right: Attendance sidebar */}
          <RightRail
            attendance={data.attendance}
            upcoming={[]} /* Upcoming is shown above in the what-changed column */
            className="w-full min-w-0 border border-hairline lg:w-auto"
            language={language}
          />
        </div>

        <FooterBar />
      </div>

      <div className="h-10 md:h-14 pb-[env(safe-area-inset-bottom)]" aria-hidden="true" />
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
