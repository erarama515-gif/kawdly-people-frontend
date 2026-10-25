import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Search, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { SkeletonTable } from '@/components/ui/SkeletonTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/form';
import { userFacingMessage } from '@/lib/api/errors';
import { useHasPermission } from '@/auth/session';
import {
  useOnboardingInstanceList,
  useDeleteOnboardingInstance,
  useOnboardingTaskList,
  useUpdateOnboardingTask,
  useOnboardingTemplateList,
  useOnboardingTemplateTaskList,
  useDeleteOnboardingTemplateTask,
} from '../api/queries';
import type {
  OnboardingInstanceListParams,
  OnboardingInstanceStatus,
  OnboardingTemplateTaskListParams,
  OnboardingType,
} from '../api/resource';
import type {
  OnboardingInstanceWire,
  OnboardingTaskWire,
  OnboardingTemplateTaskWire,
} from '../api/schema';
import { OnboardingInstanceFormDialog } from './OnboardingInstanceFormDialog';
import { OnboardingTemplateTaskFormDialog } from './OnboardingTemplateTaskFormDialog';

/**
 * Onboarding module live-data page. Wired to the real backend via:
 *   - useOnboardingInstanceList (primary resource, full CRUD)
 *   - useOnboardingTaskList (per-instance task list with honest progress)
 *   - useUpdateOnboardingTask (status toggle via PATCH — /complete skipped,
 *     see queries.ts for rationale)
 *
 * Design decisions documented in the task spec:
 *
 * 1. DEFAULT VIEW: type=onboarding only (matching the page's existing intent).
 *    A "Type" filter chip lets the user switch to offboarding or "all".
 *
 * 2. OVERDUE: NOT a real backend status enum value. Shown as a client-side
 *    visual badge when ANY task for the instance has due_date < today AND
 *    status != 'completed'. Computed from the task list already fetched.
 *
 * 3. PROGRESS: computed honestly from the per-instance task list. Never
 *    fabricated from instance fields (which have no progress columns).
 *
 * 4. STAT — inProgress: cheap perPage:1 filtered query (meta.total).
 *
 * 5. STAT — completedThisMonth: computed client-side from the first batch of
 *    instances (perPage:200). May undercount on very large datasets. If the
 *    backend later exposes date-range filters, replace with a perPage:1 query.
 *
 * 6. STAT — overdueTasks: DROPPED. Computing it honestly requires fetching
 *    ALL task pages and checking due dates, which is N+1 unbounded queries.
 *    The per-card overdue badge still works correctly.
 *
 * 7. employee.first_name/last_name/photo resolved via `employee` relation
 *    (include=employee), same convention as Attendance/Leave. Falls back to
 *    `#employee_id` when relation is absent.
 */

const PER_PAGE = 12;

// Stat card
function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | undefined;
  accent?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-1 px-5 pb-4 pt-4">
      <span className="text-caption text-ink-muted">{label}</span>
      <span
        className={cn(
          'nums font-mono text-[32px] font-bold leading-[1.1] tracking-[-0.04em]',
          accent ? 'text-coral' : 'text-navy',
        )}
      >
        {value !== undefined ? value.toLocaleString() : '—'}
      </span>
    </Card>
  );
}

// Status badge — real backend statuses only; overdue is a separate overlay
const INSTANCE_STATUS_STYLES: Record<OnboardingInstanceStatus, string> = {
  in_progress: 'bg-amber-50 text-amber-700',
  completed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

function InstanceStatusBadge({
  status,
  isOverdue,
}: {
  status: OnboardingInstanceStatus | undefined;
  isOverdue: boolean;
}) {
  const { t } = useTranslation();

  if (isOverdue) {
    return (
      <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
        {t('onboarding.status.overdue')}
      </span>
    );
  }

  if (!status) return null;
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
        INSTANCE_STATUS_STYLES[status],
      )}
    >
      {t(`onboarding.instanceStatusOptions.${status}`)}
    </span>
  );
}

// Progress bar
function ProgressBar({ pct, overdue }: { pct: number; overdue: boolean }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-hairline">
      <div
        className={cn('h-full rounded-full transition-all', overdue ? 'bg-coral' : 'bg-navy')}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

// Task status pill
const TASK_STATUS_STYLES = {
  pending:     'bg-slate-100 text-slate-500',
  in_progress: 'bg-amber-50 text-amber-700',
  completed:   'bg-emerald-50 text-emerald-700',
  skipped:     'bg-slate-100 text-slate-400 line-through',
} as const;

function TaskRow({
  task,
  onToggle,
  isToggling,
  canEditTask,
}: {
  task: OnboardingTaskWire;
  onToggle: (task: OnboardingTaskWire) => void;
  isToggling: boolean;
  canEditTask: boolean;
}) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const isTaskOverdue =
    task.status !== 'completed' &&
    task.status !== 'skipped' &&
    task.due_date < today;

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            'text-caption font-medium text-ink',
            task.status === 'completed' && 'line-through text-ink-muted',
          )}
        >
          {task.title}
        </span>
        <span
          className={cn(
            'text-[11px] font-mono text-ink-faint',
            isTaskOverdue && 'text-coral font-semibold',
          )}
        >
          {t('onboarding.task.dueDate')}: {task.due_date}
          {isTaskOverdue ? ` — ${t('onboarding.status.overdue')}` : ''}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-semibold',
            TASK_STATUS_STYLES[task.status ?? 'pending'],
          )}
        >
          {t(`onboarding.taskStatusOptions.${task.status ?? 'pending'}`)}
        </span>
        {canEditTask && task.status !== 'completed' && task.status !== 'skipped' && (
          <button
            type="button"
            disabled={isToggling}
            onClick={() => onToggle(task)}
            className="rounded-[3px] border border-hairline bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-muted hover:border-navy/40 hover:text-ink disabled:opacity-50"
          >
            {t('onboarding.task.markDone')}
          </button>
        )}
      </div>
    </div>
  );
}

// Compute "is overdue" from the task list for this instance
function computeIsOverdue(tasks: OnboardingTaskWire[]): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return tasks.some(
    (t) => t.status !== 'completed' && t.status !== 'skipped' && t.due_date < today,
  );
}

// Compute progress: { completed, total, pct }
function computeProgress(tasks: OnboardingTaskWire[]): { completed: number; total: number; pct: number } {
  if (tasks.length === 0) return { completed: 0, total: 0, pct: 0 };
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const total = tasks.length;
  return { completed, total, pct: Math.round((completed / total) * 100) };
}

function initialsOf(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Onboarding Card ──────────────────────────────────────────────────────────

function OnboardingCard({
  instance,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  canEditTask,
}: {
  instance: OnboardingInstanceWire;
  onEdit: () => void;
  onDelete: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canEditTask?: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const { state: tasksState } = useOnboardingTaskList({
    instanceId: instance.id,
    perPage: 100,
  });

  const updateTaskMutation = useUpdateOnboardingTask();

  const tasks = tasksState.data?.data ?? [];
  const isOverdue = computeIsOverdue(tasks);
  const { completed, total, pct } = computeProgress(tasks);

  const emp = instance.employee;
  const displayName = emp ? `${emp.first_name} ${emp.last_name}` : `#${instance.employee_id}`;
  const empNumber = emp?.employee_number ?? '';
  const department = emp?.department?.name ?? '';
  const initials = emp ? initialsOf(emp.first_name, emp.last_name) : '??';

  async function handleToggleTask(task: OnboardingTaskWire) {
    await updateTaskMutation.mutate({
      id: task.id,
      status: 'completed',
      completed_at: new Date().toISOString().slice(0, 10),
    });
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar initials={initials} photo={emp?.photo} size={40} />
          <div className="min-w-0">
            <p className="truncate text-body-sm font-semibold text-ink">{displayName}</p>
            <p className="truncate text-caption text-ink-muted">
              {department || empNumber}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <InstanceStatusBadge status={instance.status} isOverdue={isOverdue} />
          <div className="flex items-center gap-1">
            {canEdit ? (
              <Button
                variant="ghost"
                className="h-6 w-6 px-0"
                aria-label={t('onboarding.editAction')}
                onClick={onEdit}
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                variant="ghost"
                className="h-6 w-6 px-0 hover:!text-coral"
                aria-label={t('onboarding.deleteAction')}
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Progress — computed from real tasks, never fabricated */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          {tasksState.status === 'pending' ? (
            <span className="text-caption text-ink-faint">{t('common.loading')}</span>
          ) : (
            <span className="text-caption text-ink-muted">
              <span className={cn('nums font-mono font-semibold', isOverdue ? 'text-coral' : 'text-ink')}>
                {completed}
              </span>{' '}
              {t('onboarding.tasksOf')}{' '}
              <span className="nums font-mono">{total}</span> {t('onboarding.tasks')}
            </span>
          )}
          <span
            className={cn(
              'nums font-mono text-[13px] font-bold',
              isOverdue ? 'text-coral' : 'text-navy',
            )}
          >
            {tasksState.status !== 'pending' ? `${pct}%` : null}
          </span>
        </div>
        {tasksState.status !== 'pending' && (
          <ProgressBar pct={pct} overdue={isOverdue} />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-divider pt-3">
        <div>
          <span className="text-caption text-ink-faint">{t('onboarding.startDate')}</span>
          <span className="ms-2 text-caption font-semibold text-ink">
            {formatDate(instance.started_at)}
          </span>
        </div>
        {tasks.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-caption text-ink-muted hover:text-ink"
          >
            {t('onboarding.task.tasks')}
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.75} />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
          </button>
        )}
      </div>

      {/* Task list — collapsible */}
      {expanded && tasks.length > 0 && (
        <div className="flex flex-col divide-y divide-divider border-t border-divider pt-2">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={(t) => void handleToggleTask(t)}
              isToggling={updateTaskMutation.isPending}
              canEditTask={canEditTask ?? false}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Template Task section helpers ────────────────────────────────────────────

const OWNER_TYPE_STYLES: Record<string, string> = {
  hr:       'bg-violet-50 text-violet-700',
  it:       'bg-sky-50 text-sky-700',
  manager:  'bg-amber-50 text-amber-700',
  employee: 'bg-slate-100 text-slate-600',
  admin:    'bg-rose-50 text-rose-700',
  finance:  'bg-emerald-50 text-emerald-700',
};

function OwnerTypeBadge({ ownerType }: { ownerType: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
        OWNER_TYPE_STYLES[ownerType] ?? 'bg-slate-100 text-slate-600',
      )}
    >
      {t(`onboarding.templateTask.ownerTypeOptions.${ownerType}`)}
    </span>
  );
}

// ─── Filter chips ─────────────────────────────────────────────────────────────

type TypeFilter = OnboardingType | 'all';

const TYPE_FILTER_OPTIONS: Array<{ key: string; value: TypeFilter }> = [
  { key: 'all', value: 'all' },
  { key: 'onboarding', value: 'onboarding' },
  { key: 'offboarding', value: 'offboarding' },
];

const STATUS_FILTER_OPTIONS: Array<{ key: string; value: OnboardingInstanceStatus | 'all' }> = [
  { key: 'all', value: 'all' },
  { key: 'in_progress', value: 'in_progress' },
  { key: 'completed', value: 'completed' },
  { key: 'cancelled', value: 'cancelled' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function OnboardingPage() {
  const { t } = useTranslation();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('onboarding');
  const [statusFilter, setStatusFilter] = useState<OnboardingInstanceStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OnboardingInstanceWire | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<OnboardingInstanceWire | undefined>(undefined);

  // ── Template Checklist section ──
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>(undefined);
  const [ttPage, setTtPage] = useState(1);
  const [ttFormOpen, setTtFormOpen] = useState(false);
  const [ttEditTarget, setTtEditTarget] = useState<OnboardingTemplateTaskWire | undefined>(undefined);
  const [ttDeleteTarget, setTtDeleteTarget] = useState<OnboardingTemplateTaskWire | undefined>(undefined);

  // Debounce search
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Reset page on filter/search change
  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, statusFilter]);

  const params = useMemo<OnboardingInstanceListParams>(
    () => ({
      page,
      perPage: PER_PAGE,
      search: search || undefined,
      type: typeFilter === 'all' ? undefined : typeFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    [page, search, typeFilter, statusFilter],
  );

  const { state, refetch } = useOnboardingInstanceList(params);

  // Stat: in-progress count (cheap perPage:1 filtered query)
  const { state: inProgressState } = useOnboardingInstanceList({
    page: 1,
    perPage: 1,
    status: 'in_progress',
  });

  // Stat: completedThisMonth — computed client-side from a broad query.
  // Uses perPage:200 to cover most realistic datasets. If the backend later
  // exposes completed_at date-range filters, replace with a perPage:1 query.
  const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const { state: completedBatchState } = useOnboardingInstanceList({
    page: 1,
    perPage: 200,
    status: 'completed',
  });
  const completedThisMonth = useMemo(() => {
    const batch = completedBatchState.data?.data ?? [];
    return batch.filter(
      (inst) => inst.completed_at && inst.completed_at.startsWith(currentMonth),
    ).length;
  }, [completedBatchState.data, currentMonth]);

  const deleteMutation = useDeleteOnboardingInstance(params);
  const canCreateInstance = useHasPermission('onboarding.instance.create');
  const canEditInstance = useHasPermission('onboarding.instance.edit');
  const canDeleteInstance = useHasPermission('onboarding.instance.delete');
  const canEditTask = useHasPermission('onboarding.task.edit');
  const canCreateTemplateTask = useHasPermission('onboarding.template_task.create');
  const canEditTemplateTask = useHasPermission('onboarding.template_task.edit');
  const canDeleteTemplateTask = useHasPermission('onboarding.template_task.delete');

  const instances = state.data?.data ?? [];
  const meta = state.data?.meta;

  // ── Template Checklist hooks ──
  const { state: templateListState } = useOnboardingTemplateList({ page: 1, perPage: 100 });
  const templates = templateListState.data?.data ?? [];

  const ttParams = useMemo<OnboardingTemplateTaskListParams>(
    () => ({ page: ttPage, perPage: 25, templateId: selectedTemplateId }),
    [ttPage, selectedTemplateId],
  );
  const { state: ttState, refetch: refetchTt } = useOnboardingTemplateTaskList(ttParams);
  const ttDeleteMutation = useDeleteOnboardingTemplateTask(ttParams);

  const templateTasks = ttState.data?.data ?? [];
  const ttMeta = ttState.data?.meta;

  // Reset task pagination when template changes
  useEffect(() => {
    setTtPage(1);
  }, [selectedTemplateId]);

  function openAddForm() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function openEditForm(instance: OnboardingInstanceWire) {
    setEditTarget(instance);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await deleteMutation.mutate(deleteTarget.id);
    if (result !== undefined || deleteMutation.error === undefined) setDeleteTarget(undefined);
  }

  function openAddTt() {
    setTtEditTarget(undefined);
    setTtFormOpen(true);
  }

  function openEditTt(task: OnboardingTemplateTaskWire) {
    setTtEditTarget(task);
    setTtFormOpen(true);
  }

  async function confirmDeleteTt() {
    if (!ttDeleteTarget) return;
    const result = await ttDeleteMutation.mutate(ttDeleteTarget.id);
    if (result !== undefined || ttDeleteMutation.error === undefined) setTtDeleteTarget(undefined);
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t('onboarding.title')}
        actions={
          canCreateInstance ? (
            <Button variant="primary" onClick={openAddForm}>
              <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              {t('onboarding.newOnboardingPlan')}
            </Button>
          ) : undefined
        }
      />

      {/* Stat strip */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-2">
        <StatCard
          label={t('onboarding.stat.inProgress')}
          value={inProgressState.data?.meta.total}
        />
        <StatCard
          label={t('onboarding.stat.completedThisMonth')}
          value={completedBatchState.status !== 'pending' ? completedThisMonth : undefined}
        />
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <label className="relative flex items-center">
          <span className="pointer-events-none absolute start-3 text-ink-faint">
            <Search className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <input
            type="search"
            placeholder={t('onboarding.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={cn(
              'h-9 rounded-full border border-hairline bg-surface ps-8 pe-4 text-[13px] text-ink placeholder:text-ink-faint',
              'focus:outline-none focus:ring-1 focus:ring-navy/40',
              'w-52',
            )}
          />
        </label>

        {/* Type filter chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {TYPE_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTypeFilter(opt.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors',
                typeFilter === opt.value
                  ? 'border-navy bg-navy text-on-navy'
                  : 'border-hairline bg-surface text-ink-muted hover:border-navy/40 hover:text-ink',
              )}
            >
              {opt.value === 'all' ? t('onboarding.filter.all') : t(`onboarding.typeOptions.${opt.value}`)}
            </button>
          ))}
        </div>

        {/* Status filter chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors',
                statusFilter === opt.value
                  ? 'border-navy bg-navy text-on-navy'
                  : 'border-hairline bg-surface text-ink-muted hover:border-navy/40 hover:text-ink',
              )}
            >
              {opt.value === 'all'
                ? t('onboarding.filter.allStatuses')
                : t(`onboarding.instanceStatusOptions.${opt.value}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Load failure */}
      {state.error ? (
        <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>
            {state.error ? userFacingMessage(state.error) || t('onboarding.loadFailed') : t('onboarding.loadFailed')}
          </span>
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {/* Initial load */}
      {state.status === 'pending' && instances.length === 0 ? (
        <SkeletonTable />
      ) : null}

      {/* Empty state */}
      {state.status !== 'pending' && instances.length === 0 && (
        <Card className="px-5 py-10 text-center text-body-sm text-ink-muted">
          {t('onboarding.emptySearch')}
        </Card>
      )}

      {/* Section heading */}
      {instances.length > 0 && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-body font-semibold text-ink">{t('onboarding.activeOnboarding')}</h2>
          {meta ? (
            <span className="text-caption text-ink-muted">
              {t('onboarding.employeesCount', { count: meta.total })}
            </span>
          ) : null}
        </div>
      )}

      {/* Instance card grid */}
      {instances.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {instances.map((instance) => (
              <OnboardingCard
                key={instance.id}
                instance={instance}
                onEdit={() => openEditForm(instance)}
                onDelete={() => setDeleteTarget(instance)}
                canEdit={canEditInstance}
                canDelete={canDeleteInstance}
                canEditTask={canEditTask}
              />
            ))}
          </div>

          {meta ? (
            <Pagination
              currentPage={meta.current_page}
              lastPage={meta.last_page}
              total={meta.total}
              perPage={meta.per_page}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}

      {/* ═══ Template Checklist Section ════════════════════════════════════════ */}
      <div className="mt-10">
        {/* Section header + template picker */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-body font-semibold text-ink">
              {t('onboarding.templateTask.sectionTitle')}
            </h2>
            {selectedTemplateId ? (
              <span className="rounded-full bg-navy/10 px-2.5 py-0.5 text-[11px] font-semibold text-navy">
                {templates.find((tpl) => tpl.id === selectedTemplateId)?.name ?? `#${selectedTemplateId}`}
              </span>
            ) : (
              <span className="text-caption text-ink-muted">
                {t('onboarding.templateTask.selectTemplateHint')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select
              className="h-8 w-52 text-[12px]"
              value={selectedTemplateId !== undefined ? String(selectedTemplateId) : ''}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedTemplateId(val ? Number(val) : undefined);
              }}
              aria-label={t('onboarding.templateTask.selectTemplateHint')}
            >
              <option value="">{t('onboarding.templateTask.selectTemplateHint')}</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name} ({t(`onboarding.typeOptions.${tpl.type}`)})
                </option>
              ))}
            </Select>
            {selectedTemplateId !== undefined && canCreateTemplateTask ? (
              <Button variant="primary" onClick={openAddTt}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                {t('onboarding.templateTask.add')}
              </Button>
            ) : null}
          </div>
        </div>

        {/* Load error */}
        {ttState.error ? (
          <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
            <span>{userFacingMessage(ttState.error) || t('onboarding.templateTask.loadFailed')}</span>
            <Button variant="secondary" onClick={() => void refetchTt()}>
              {t('common.retry')}
            </Button>
          </Card>
        ) : null}

        {/* No template selected hint */}
        {selectedTemplateId === undefined ? (
          <Card className="px-5 py-8 text-center text-body-sm text-ink-muted">
            {t('onboarding.templateTask.selectTemplateHint')}
          </Card>
        ) : null}

        {/* Loading */}
        {selectedTemplateId !== undefined && ttState.status === 'pending' && templateTasks.length === 0 ? (
          <SkeletonTable />
        ) : null}

        {/* Empty state */}
        {selectedTemplateId !== undefined && ttState.status !== 'pending' && templateTasks.length === 0 ? (
          <Card className="px-5 py-8 text-center text-body-sm text-ink-muted">
            {t('onboarding.templateTask.empty')}
          </Card>
        ) : null}

        {/* Desktop table */}
        {selectedTemplateId !== undefined && templateTasks.length > 0 ? (
          <Card className="overflow-hidden">
            <div className="grid grid-cols-[minmax(200px,3fr)_110px_90px_80px_70px_auto] border-b border-divider px-5 py-2.5">
              {(
                [
                  t('onboarding.templateTask.table.title'),
                  t('onboarding.templateTask.table.owner'),
                  t('onboarding.templateTask.table.dueOffset'),
                  t('onboarding.templateTask.table.required'),
                  t('onboarding.templateTask.table.sortOrder'),
                  '',
                ] as const
              ).map((col, i) => (
                <span
                  key={i}
                  className="text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted"
                >
                  {col}
                </span>
              ))}
            </div>

            {templateTasks.map((task) => (
              <div
                key={task.id}
                className="grid grid-cols-[minmax(200px,3fr)_110px_90px_80px_70px_auto] items-center border-b border-divider px-5 py-3 last:border-b-0 hover:bg-page"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-body-sm font-semibold text-ink">{task.title}</span>
                  {task.description ? (
                    <span className="truncate text-caption text-ink-faint">{task.description}</span>
                  ) : null}
                </div>
                <OwnerTypeBadge ownerType={task.owner_type} />
                <span className="nums font-mono text-body-sm text-ink-muted">
                  {task.due_days_offset !== undefined ? `${task.due_days_offset >= 0 ? '+' : ''}${task.due_days_offset}d` : '—'}
                </span>
                <span className="text-body-sm text-ink-muted">
                  {task.is_required ? t('common.yes') : t('common.no')}
                </span>
                <span className="nums font-mono text-body-sm text-ink-muted">
                  {task.sort_order !== undefined ? task.sort_order : '—'}
                </span>
                <div className="flex items-center gap-1">
                  {canEditTemplateTask ? (
                    <Button
                      variant="ghost"
                      className="h-7 w-7 px-0"
                      aria-label={t('onboarding.templateTask.editAction')}
                      onClick={() => openEditTt(task)}
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </Button>
                  ) : null}
                  {canDeleteTemplateTask ? (
                    <Button
                      variant="ghost"
                      className="h-7 w-7 px-0 hover:!text-coral"
                      aria-label={t('onboarding.templateTask.deleteAction')}
                      onClick={() => setTtDeleteTarget(task)}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </Card>
        ) : null}

        {/* Mobile cards */}
        {selectedTemplateId !== undefined && templateTasks.length > 0 ? (
          <div className="mt-3 flex flex-col gap-3 lg:hidden">
            {templateTasks.map((task) => (
              <Card key={task.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-ink">{task.title}</p>
                    {task.description ? (
                      <p className="mt-0.5 text-caption text-ink-faint">{task.description}</p>
                    ) : null}
                  </div>
                  <OwnerTypeBadge ownerType={task.owner_type} />
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-divider pt-2 text-center">
                  <div>
                    <p className="text-caption text-ink-faint">{t('onboarding.templateTask.table.dueOffset')}</p>
                    <p className="nums font-mono text-[12px] text-ink-muted">
                      {task.due_days_offset !== undefined ? `${task.due_days_offset >= 0 ? '+' : ''}${task.due_days_offset}d` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-caption text-ink-faint">{t('onboarding.templateTask.table.required')}</p>
                    <p className="text-[12px] text-ink-muted">
                      {task.is_required ? t('common.yes') : t('common.no')}
                    </p>
                  </div>
                  <div>
                    <p className="text-caption text-ink-faint">{t('onboarding.templateTask.table.sortOrder')}</p>
                    <p className="nums font-mono text-[12px] text-ink-muted">
                      {task.sort_order !== undefined ? task.sort_order : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end border-t border-divider pt-2">
                  <div className="flex items-center gap-1">
                    {canEditTemplateTask ? (
                      <Button
                        variant="ghost"
                        className="h-7 w-7 px-0"
                        aria-label={t('onboarding.templateTask.editAction')}
                        onClick={() => openEditTt(task)}
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                      </Button>
                    ) : null}
                    {canDeleteTemplateTask ? (
                      <Button
                        variant="ghost"
                        className="h-7 w-7 px-0 hover:!text-coral"
                        aria-label={t('onboarding.templateTask.deleteAction')}
                        onClick={() => setTtDeleteTarget(task)}
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : null}

        {ttMeta && ttMeta.last_page > 1 ? (
          <div className="mt-4">
            <Pagination
              currentPage={ttMeta.current_page}
              lastPage={ttMeta.last_page}
              total={ttMeta.total}
              perPage={ttMeta.per_page}
              onPageChange={setTtPage}
            />
          </div>
        ) : null}
      </div>

      <OnboardingInstanceFormDialog open={formOpen} onOpenChange={setFormOpen} instance={editTarget} />

      {selectedTemplateId !== undefined ? (
        <OnboardingTemplateTaskFormDialog
          open={ttFormOpen}
          onOpenChange={setTtFormOpen}
          templateId={selectedTemplateId}
          task={ttEditTarget}
        />
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== undefined}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t('onboarding.deleteConfirm.title')}
        description={
          deleteTarget
            ? t('onboarding.deleteConfirm.description', {
                name: deleteTarget.employee
                  ? `${deleteTarget.employee.first_name} ${deleteTarget.employee.last_name}`
                  : `#${deleteTarget.employee_id}`,
              })
            : undefined
        }
        isLoading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
      />

      <ConfirmDialog
        open={ttDeleteTarget !== undefined}
        onOpenChange={(open) => !open && setTtDeleteTarget(undefined)}
        title={t('onboarding.templateTask.deleteTitle')}
        description={
          ttDeleteTarget
            ? t('onboarding.templateTask.deleteDescription', { title: ttDeleteTarget.title })
            : undefined
        }
        confirmLabel={t('common.delete')}
        isLoading={ttDeleteMutation.isPending}
        onConfirm={() => void confirmDeleteTt()}
      />
    </div>
  );
}
