import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { SkeletonTable } from '@/components/ui/SkeletonTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { userFacingMessage } from '@/lib/api/errors';
import { useLocalizeEntity } from '@/lib/localizeEntity';
import { formatAmount } from '@/lib/salary';
import { useHasPermission } from '@/auth/session';
import {
  useSalaryStructureList,
  useDeleteSalaryStructure,
  useSalaryComponentList,
  useDeleteSalaryComponent,
} from '../api/queries';
import type { SalaryStructureListParams, SalaryComponentListParams, SalaryComponentType } from '../api/resource';
import type { SalaryStructureWire, SalaryComponentWire } from '../api/schema';
import { SalaryStructureFormDialog } from './SalaryStructureFormDialog';
import { SalaryComponentFormDialog } from './SalaryComponentFormDialog';
import { EmployeeSalaryFormDialog } from './EmployeeSalaryFormDialog';
import { useEmployeeList } from '@/features/employees/api/queries';
import { useEmployeeSalaryList, useDeleteEmployeeSalary } from '@/features/payroll/api/queries';
import type { EmployeeSalaryListParams } from '@/features/payroll/api/resource';
import type { EmployeeSalaryWire } from '@/features/payroll/api/schema';

/**
 * Compensation module live-data page.
 *
 * This page is a FULL REPLACEMENT of the old "salary bands" mock page.
 * The real backend has no salary-band or compa-ratio concept — it has two
 * resources: SalaryStructure (payroll templates) and SalaryComponent (line
 * items within a structure). See backend/routes/api/payroll.php.
 *
 * Two sections:
 *  1. Salary Structures — list/add/edit/delete
 *  2. Salary Components — list/add/edit/delete, filterable by structure + type
 *
 * Stat cards: total structures, active structures, total components — each
 * reads only `meta.total` from a cheap `perPage:1` query. No fabricated numbers.
 *
 * Component count per structure: omitted from the list to avoid N+1 requests
 * (one API call per structure row). The count is visible in the components
 * section by filtering to a structure.
 */

const STRUCTURES_PER_PAGE = 10;
const COMPONENTS_PER_PAGE = 10;
const ASSIGNMENTS_PER_PAGE = 10;

// ─── Stat Card ────────────────────────────────────────────────────────────────

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

// ─── Row Actions ──────────────────────────────────────────────────────────────

function RowActions({
  onEdit,
  onDelete,
}: {
  onEdit?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      {onEdit ? (
        <Button
          variant="ghost"
          className="h-7 w-7 px-0"
          aria-label={t('common.edit')}
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      ) : null}
      {onDelete ? (
        <Button
          variant="ghost"
          className="h-7 w-7 px-0 hover:!text-coral"
          aria-label={t('common.delete')}
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

// ─── Type Badge ───────────────────────────────────────────────────────────────

const TYPE_CLASSES: Record<SalaryComponentType, string> = {
  earning: 'bg-emerald-50 text-emerald-700',
  deduction: 'bg-red-50 text-red-700',
};

function TypeBadge({ type }: { type: SalaryComponentType }) {
  const { t } = useTranslation();
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', TYPE_CLASSES[type])}>
      {t(`compensation.typeOptions.${type}`)}
    </span>
  );
}

// ─── Boolean pill ─────────────────────────────────────────────────────────────

function BoolPill({ value }: { value: boolean | undefined }) {
  const { t } = useTranslation();
  if (value === undefined) return <span className="text-ink-faint">—</span>;
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
        value ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
      )}
    >
      {value ? t('common.yes') : t('common.no')}
    </span>
  );
}

// ─── Search input ─────────────────────────────────────────────────────────────

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative flex items-center">
      <span className="pointer-events-none absolute start-3 text-ink-faint">
        <Search className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-9 rounded-full border border-hairline bg-surface ps-8 pe-4 text-[13px] text-ink placeholder:text-ink-faint',
          'focus:outline-none focus:ring-1 focus:ring-navy/40',
          'w-52',
        )}
      />
    </label>
  );
}

// ─── Salary Structures Section ────────────────────────────────────────────────

function SalaryStructuresSection() {
  const { t } = useTranslation();
  const localize = useLocalizeEntity();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SalaryStructureWire | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<SalaryStructureWire | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const params = useMemo<SalaryStructureListParams>(
    () => ({ page, perPage: STRUCTURES_PER_PAGE, search: search || undefined }),
    [page, search],
  );

  const { state, refetch } = useSalaryStructureList(params);
  const deleteMutation = useDeleteSalaryStructure(params);
  const canCreate = useHasPermission('payroll.salary_structure.create');
  const canEdit = useHasPermission('payroll.salary_structure.edit');
  const canDelete = useHasPermission('payroll.salary_structure.delete');

  const records = state.data?.data ?? [];
  const meta = state.data?.meta;

  function openAddForm() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function openEditForm(record: SalaryStructureWire) {
    setEditTarget(record);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await deleteMutation.mutate(deleteTarget.id);
    if (result !== undefined || deleteMutation.error === undefined) setDeleteTarget(undefined);
  }

  return (
    <section className="flex flex-col gap-3">
      {/* Section header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-body font-semibold text-ink">{t('compensation.structure.title')}</h2>
        <div className="flex items-center gap-3">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder={t('compensation.structure.searchPlaceholder')}
          />
          {canCreate ? (
            <Button variant="primary" onClick={openAddForm}>
              <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              {t('compensation.structure.add')}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Load failure */}
      {state.error ? (
        <Card className="flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>{userFacingMessage(state.error) || t('compensation.loadFailed')}</span>
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {/* Loading */}
      {state.status === 'pending' && records.length === 0 ? (
        <SkeletonTable />
      ) : null}

      {/* Empty */}
      {state.status !== 'pending' && records.length === 0 ? (
        <Card className="px-5 py-8 text-center text-body-sm text-ink-muted">
          {t('compensation.structure.empty')}
        </Card>
      ) : null}

      {records.length > 0 ? (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden lg:block">
            <div className="border-b border-divider px-5 py-2.5">
              <div className="grid grid-cols-[1fr_2fr_90px_90px_auto] gap-4">
                {(
                  ['name', 'description', 'isDefault', 'isActive', 'actions'] as const
                ).map((col) => (
                  <span
                    key={col}
                    className="text-caption font-semibold uppercase tracking-wide text-ink-faint"
                  >
                    {t(`compensation.structure.col.${col}`)}
                  </span>
                ))}
              </div>
            </div>

            {records.map((rec, idx) => (
              <div
                key={rec.id}
                className={cn(
                  'grid grid-cols-[1fr_2fr_90px_90px_auto] items-center gap-4 px-5 py-3',
                  idx < records.length - 1 && 'border-b border-divider',
                  'transition-colors hover:bg-surface/60',
                )}
              >
                <span className="truncate text-body-sm font-semibold text-ink">{localize(rec.name)}</span>
                <span className="truncate text-body-sm text-ink-muted">{rec.description ?? '—'}</span>
                <BoolPill value={rec.is_default} />
                <BoolPill value={rec.is_active} />
                <RowActions
                  onEdit={canEdit ? () => openEditForm(rec) : undefined}
                  onDelete={canDelete ? () => setDeleteTarget(rec) : undefined}
                />
              </div>
            ))}
          </Card>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 lg:hidden">
            {records.map((rec) => (
              <Card key={rec.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-body-sm font-semibold text-ink">{localize(rec.name)}</p>
                  <RowActions
                    onEdit={canEdit ? () => openEditForm(rec) : undefined}
                    onDelete={canDelete ? () => setDeleteTarget(rec) : undefined}
                  />
                </div>
                {rec.description ? (
                  <p className="text-caption text-ink-muted">{rec.description}</p>
                ) : null}
                <div className="flex gap-3 border-t border-divider pt-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('compensation.structure.col.isDefault')}</span>
                    <BoolPill value={rec.is_default} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('compensation.structure.col.isActive')}</span>
                    <BoolPill value={rec.is_active} />
                  </div>
                </div>
              </Card>
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
      ) : null}

      <SalaryStructureFormDialog open={formOpen} onOpenChange={setFormOpen} record={editTarget} />

      <ConfirmDialog
        open={deleteTarget !== undefined}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t('compensation.structure.deleteConfirm.title')}
        description={
          deleteTarget
            ? t('compensation.structure.deleteConfirm.description', { name: deleteTarget.name })
            : undefined
        }
        isLoading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
}

// ─── Salary Components Section ────────────────────────────────────────────────

function SalaryComponentsSection() {
  const { t } = useTranslation();
  const localize = useLocalizeEntity();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [structureFilter, setStructureFilter] = useState<number | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<SalaryComponentType | 'all'>('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SalaryComponentWire | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<SalaryComponentWire | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, structureFilter, typeFilter]);

  const params = useMemo<SalaryComponentListParams>(
    () => ({
      page,
      perPage: COMPONENTS_PER_PAGE,
      search: search || undefined,
      salary_structure_id: structureFilter,
      type: typeFilter === 'all' ? undefined : typeFilter,
    }),
    [page, search, structureFilter, typeFilter],
  );

  const { state, refetch } = useSalaryComponentList(params);
  const deleteMutation = useDeleteSalaryComponent(params);
  const canCreate = useHasPermission('payroll.salary_component.create');
  const canEdit = useHasPermission('payroll.salary_component.edit');
  const canDelete = useHasPermission('payroll.salary_component.delete');

  // Structures for filter dropdown
  const { state: structureState } = useSalaryStructureList({ page: 1, perPage: 100 });
  const structures = structureState.data?.data ?? [];

  const records = state.data?.data ?? [];
  const meta = state.data?.meta;

  function openAddForm() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function openEditForm(record: SalaryComponentWire) {
    setEditTarget(record);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await deleteMutation.mutate(deleteTarget.id);
    if (result !== undefined || deleteMutation.error === undefined) setDeleteTarget(undefined);
  }

  const structureName = (id: number) =>
    structures.find((s) => s.id === id)?.name ?? `#${id}`;

  return (
    <section className="flex flex-col gap-3">
      {/* Section header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-body font-semibold text-ink">{t('compensation.component.title')}</h2>
        {canCreate ? (
          <Button variant="primary" onClick={openAddForm}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            {t('compensation.component.add')}
          </Button>
        ) : null}
      </div>

      {/* Toolbar: search + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t('compensation.component.searchPlaceholder')}
        />

        {/* Structure filter */}
        <select
          value={structureFilter ?? ''}
          onChange={(e) => setStructureFilter(e.target.value ? Number(e.target.value) : undefined)}
          className="h-9 rounded-full border border-hairline bg-surface px-3 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-navy/40"
        >
          <option value="">{t('compensation.component.filterAllStructures')}</option>
          {structures.map((s) => (
            <option key={s.id} value={s.id}>
              {localize(s.name)}
            </option>
          ))}
        </select>

        {/* Type filter chips */}
        <div className="flex items-center gap-1.5">
          {(['all', 'earning', 'deduction'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setTypeFilter(opt)}
              className={cn(
                'rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors',
                typeFilter === opt
                  ? 'border-navy bg-navy text-on-navy'
                  : 'border-hairline bg-surface text-ink-muted hover:border-navy/40 hover:text-ink',
              )}
            >
              {opt === 'all'
                ? t('compensation.component.filterAll')
                : t(`compensation.typeOptions.${opt}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Load failure */}
      {state.error ? (
        <Card className="flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>{userFacingMessage(state.error) || t('compensation.loadFailed')}</span>
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {/* Loading */}
      {state.status === 'pending' && records.length === 0 ? (
        <SkeletonTable />
      ) : null}

      {/* Empty */}
      {state.status !== 'pending' && records.length === 0 ? (
        <Card className="px-5 py-8 text-center text-body-sm text-ink-muted">
          {t('compensation.component.empty')}
        </Card>
      ) : null}

      {records.length > 0 ? (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden lg:block">
            <div className="border-b border-divider px-5 py-2.5">
              <div className="grid grid-cols-[1fr_120px_100px_90px_120px_80px_80px_80px_auto] gap-4">
                {(
                  ['name', 'structure', 'type', 'code', 'calcType', 'amount', 'taxable', 'variable', 'actions'] as const
                ).map((col) => (
                  <span
                    key={col}
                    className="text-caption font-semibold uppercase tracking-wide text-ink-faint"
                  >
                    {t(`compensation.component.col.${col}`)}
                  </span>
                ))}
              </div>
            </div>

            {records.map((rec, idx) => (
              <div
                key={rec.id}
                className={cn(
                  'grid grid-cols-[1fr_120px_100px_90px_120px_80px_80px_80px_auto] items-center gap-4 px-5 py-3',
                  idx < records.length - 1 && 'border-b border-divider',
                  'transition-colors hover:bg-surface/60',
                )}
              >
                <span className="truncate text-body-sm font-semibold text-ink">{localize(rec.name)}</span>
                <span className="truncate text-body-sm text-ink-muted">{localize(structureName(rec.salary_structure_id))}</span>
                <TypeBadge type={rec.type} />
                <span className="nums font-mono text-[12px] text-ink-muted">{rec.code ?? '—'}</span>
                <span className="text-body-sm text-ink-muted">
                  {t(`compensation.calculationTypeOptions.${rec.calculation_type}`)}
                </span>
                <span className="nums font-mono text-body-sm text-ink">
                  {rec.default_amount !== undefined ? rec.default_amount.toLocaleString() : '—'}
                </span>
                <BoolPill value={rec.is_taxable} />
                <BoolPill value={rec.is_variable} />
                <RowActions
                  onEdit={canEdit ? () => openEditForm(rec) : undefined}
                  onDelete={canDelete ? () => setDeleteTarget(rec) : undefined}
                />
              </div>
            ))}
          </Card>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 lg:hidden">
            {records.map((rec) => (
              <Card key={rec.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-ink">{localize(rec.name)}</p>
                    <p className="truncate text-caption text-ink-muted">
                      {localize(structureName(rec.salary_structure_id))}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <TypeBadge type={rec.type} />
                    <RowActions
                      onEdit={canEdit ? () => openEditForm(rec) : undefined}
                      onDelete={canDelete ? () => setDeleteTarget(rec) : undefined}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-divider pt-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('compensation.component.col.calcType')}</span>
                    <span className="text-body-sm text-ink">
                      {t(`compensation.calculationTypeOptions.${rec.calculation_type}`)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('compensation.component.col.amount')}</span>
                    <span className="nums font-mono text-body-sm text-ink">
                      {rec.default_amount !== undefined ? rec.default_amount.toLocaleString() : '—'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('compensation.component.col.taxable')}</span>
                    <BoolPill value={rec.is_taxable} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('compensation.component.col.variable')}</span>
                    <BoolPill value={rec.is_variable} />
                  </div>
                </div>
              </Card>
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
      ) : null}

      <SalaryComponentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        record={editTarget}
        defaultStructureId={structureFilter}
      />

      <ConfirmDialog
        open={deleteTarget !== undefined}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t('compensation.component.deleteConfirm.title')}
        description={
          deleteTarget
            ? t('compensation.component.deleteConfirm.description', { name: deleteTarget.name })
            : undefined
        }
        isLoading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
}

// ─── Employee Salary Assignments Section ──────────────────────────────────────

function EmployeeSalaryAssignmentsSection() {
  const { t } = useTranslation();
  const localize = useLocalizeEntity();

  const [page, setPage] = useState(1);
  const [employeeFilter, setEmployeeFilter] = useState<number | undefined>(undefined);
  const [structureFilter, setStructureFilter] = useState<number | undefined>(undefined);
  const [currentFilter, setCurrentFilter] = useState<'all' | 'current' | 'historical'>('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeSalaryWire | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeSalaryWire | undefined>(undefined);

  useEffect(() => {
    setPage(1);
  }, [employeeFilter, structureFilter, currentFilter]);

  const params = useMemo<EmployeeSalaryListParams>(
    () => ({
      page,
      perPage: ASSIGNMENTS_PER_PAGE,
      employee_id: employeeFilter,
      salary_structure_id: structureFilter,
      is_current: currentFilter === 'all' ? undefined : currentFilter === 'current',
    }),
    [page, employeeFilter, structureFilter, currentFilter],
  );

  const { state, refetch } = useEmployeeSalaryList(params);
  const deleteMutation = useDeleteEmployeeSalary(params);
  const canCreate = useHasPermission('payroll.employee_salary.create');
  const canEdit = useHasPermission('payroll.employee_salary.edit');
  const canDelete = useHasPermission('payroll.employee_salary.delete');

  // Employees + structures for filter dropdowns and name resolution.
  const { state: employeeState } = useEmployeeList({ page: 1, perPage: 100 });
  const employees = employeeState.data?.data ?? [];
  const { state: structureState } = useSalaryStructureList({ page: 1, perPage: 100 });
  const structures = structureState.data?.data ?? [];

  const records = state.data?.data ?? [];
  const meta = state.data?.meta;

  function openAddForm() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function openEditForm(record: EmployeeSalaryWire) {
    setEditTarget(record);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await deleteMutation.mutate(deleteTarget.id);
    if (result !== undefined || deleteMutation.error === undefined) setDeleteTarget(undefined);
  }

  const structureName = (id: number) => structures.find((s) => s.id === id)?.name ?? `#${id}`;

  function employeeName(record: EmployeeSalaryWire): string {
    if (record.employee) return `${record.employee.first_name} ${record.employee.last_name}`;
    const emp = employees.find((e) => e.id === record.employee_id);
    return emp ? `${emp.first_name} ${emp.last_name}` : `#${record.employee_id}`;
  }

  return (
    <section className="flex flex-col gap-3">
      {/* Section header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-body font-semibold text-ink">{t('compensation.employeeSalary.title')}</h2>
        {canCreate ? (
          <Button variant="primary" onClick={openAddForm}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            {t('compensation.employeeSalary.add')}
          </Button>
        ) : null}
      </div>

      {/* Toolbar: filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={employeeFilter ?? ''}
          onChange={(e) => setEmployeeFilter(e.target.value ? Number(e.target.value) : undefined)}
          className="h-9 rounded-full border border-hairline bg-surface px-3 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-navy/40"
        >
          <option value="">{t('compensation.employeeSalary.filterAllEmployees')}</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.first_name} {emp.last_name} — {emp.employee_number}
            </option>
          ))}
        </select>

        <select
          value={structureFilter ?? ''}
          onChange={(e) => setStructureFilter(e.target.value ? Number(e.target.value) : undefined)}
          className="h-9 rounded-full border border-hairline bg-surface px-3 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-navy/40"
        >
          <option value="">{t('compensation.employeeSalary.filterAllStructures')}</option>
          {structures.map((s) => (
            <option key={s.id} value={s.id}>
              {localize(s.name)}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          {(['all', 'current', 'historical'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setCurrentFilter(opt)}
              className={cn(
                'rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors',
                currentFilter === opt
                  ? 'border-navy bg-navy text-on-navy'
                  : 'border-hairline bg-surface text-ink-muted hover:border-navy/40 hover:text-ink',
              )}
            >
              {t(`compensation.employeeSalary.filter${opt === 'all' ? 'All' : opt === 'current' ? 'Current' : 'Historical'}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Load failure */}
      {state.error ? (
        <Card className="flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>{userFacingMessage(state.error) || t('compensation.loadFailed')}</span>
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {/* Loading */}
      {state.status === 'pending' && records.length === 0 ? (
        <SkeletonTable />
      ) : null}

      {/* Empty */}
      {state.status !== 'pending' && records.length === 0 ? (
        <Card className="px-5 py-8 text-center text-body-sm text-ink-muted">
          {t('compensation.employeeSalary.empty')}
        </Card>
      ) : null}

      {records.length > 0 ? (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden lg:block">
            <div className="border-b border-divider px-5 py-2.5">
              <div className="grid grid-cols-[1.2fr_1fr_110px_110px_110px_90px_auto] gap-4">
                {(
                  ['employee', 'structure', 'effectiveDate', 'gross', 'net', 'current', 'actions'] as const
                ).map((col) => (
                  <span
                    key={col}
                    className="text-caption font-semibold uppercase tracking-wide text-ink-faint"
                  >
                    {t(`compensation.employeeSalary.col.${col}`)}
                  </span>
                ))}
              </div>
            </div>

            {records.map((rec, idx) => (
              <div
                key={rec.id}
                className={cn(
                  'grid grid-cols-[1.2fr_1fr_110px_110px_110px_90px_auto] items-center gap-4 px-5 py-3',
                  idx < records.length - 1 && 'border-b border-divider',
                  'transition-colors hover:bg-surface/60',
                )}
              >
                <span className="truncate text-body-sm font-semibold text-ink">{employeeName(rec)}</span>
                <span className="truncate text-body-sm text-ink-muted">
                  {localize(rec.salaryStructure?.name ?? structureName(rec.salary_structure_id))}
                </span>
                <span className="nums font-mono text-[12px] text-ink-muted">{rec.effective_date.slice(0, 10)}</span>
                <span className="nums font-mono text-body-sm text-ink">{formatAmount(rec.gross_salary)}</span>
                <span className="nums font-mono text-body-sm text-ink">{formatAmount(rec.net_salary)}</span>
                <BoolPill value={rec.is_current} />
                <RowActions
                  onEdit={canEdit ? () => openEditForm(rec) : undefined}
                  onDelete={canDelete ? () => setDeleteTarget(rec) : undefined}
                />
              </div>
            ))}
          </Card>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 lg:hidden">
            {records.map((rec) => (
              <Card key={rec.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-ink">{employeeName(rec)}</p>
                    <p className="truncate text-caption text-ink-muted">
                      {localize(rec.salaryStructure?.name ?? structureName(rec.salary_structure_id))}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <BoolPill value={rec.is_current} />
                    <RowActions
                      onEdit={canEdit ? () => openEditForm(rec) : undefined}
                      onDelete={canDelete ? () => setDeleteTarget(rec) : undefined}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-divider pt-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('compensation.employeeSalary.col.effectiveDate')}</span>
                    <span className="nums font-mono text-body-sm text-ink">{rec.effective_date.slice(0, 10)}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('compensation.employeeSalary.col.gross')}</span>
                    <span className="nums font-mono text-body-sm text-ink">{formatAmount(rec.gross_salary)}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-faint">{t('compensation.employeeSalary.col.net')}</span>
                    <span className="nums font-mono text-body-sm text-ink">{formatAmount(rec.net_salary)}</span>
                  </div>
                </div>
              </Card>
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
      ) : null}

      <EmployeeSalaryFormDialog open={formOpen} onOpenChange={setFormOpen} record={editTarget} />

      <ConfirmDialog
        open={deleteTarget !== undefined}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t('compensation.employeeSalary.deleteConfirm.title')}
        description={
          deleteTarget
            ? t('compensation.employeeSalary.deleteConfirm.description', { name: employeeName(deleteTarget) })
            : undefined
        }
        isLoading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CompensationPage() {
  const { t } = useTranslation();

  // Honest stat cards: only meta.total, no fabricated numbers.
  const { state: allStructuresState } = useSalaryStructureList({ page: 1, perPage: 1 });
  const { state: activeStructuresState } = useSalaryStructureList({ page: 1, perPage: 1, isActive: true });
  const { state: allComponentsState } = useSalaryComponentList({ page: 1, perPage: 1 });
  const { state: allAssignmentsState } = useEmployeeSalaryList({ page: 1, perPage: 1 });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t('compensation.title')} />

      {/* Stat strip — all values from real meta.total */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatCard
          label={t('compensation.stat.totalStructures')}
          value={allStructuresState.data?.meta.total}
        />
        <StatCard
          label={t('compensation.stat.activeStructures')}
          value={activeStructuresState.data?.meta.total}
          accent
        />
        <StatCard
          label={t('compensation.stat.totalComponents')}
          value={allComponentsState.data?.meta.total}
        />
        <StatCard
          label={t('compensation.stat.totalAssignments')}
          value={allAssignmentsState.data?.meta.total}
        />
      </div>

      <SalaryStructuresSection />

      <SalaryComponentsSection />

      <EmployeeSalaryAssignmentsSection />
    </div>
  );
}
