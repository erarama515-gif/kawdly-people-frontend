import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutList, Network, Pencil, Plus, Search, Trash2 } from 'lucide-react';
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
import {
  useDepartmentList,
  useDeleteDepartment,
  useCompanyList,
  useDeleteCompany,
  useBranchList,
  useDeleteBranch,
  useJobPositionList,
  useDeleteJobPosition,
  useJobGradeList,
  useDeleteJobGrade,
  useJobLevelList,
  useDeleteJobLevel,
  useCostCenterList,
  useDeleteCostCenter,
} from '../api/queries';
import type {
  DepartmentListParams,
  CompanyListParams,
  BranchListParams,
  JobPositionListParams,
  JobGradeListParams,
  JobLevelListParams,
  CostCenterListParams,
} from '../api/resource';
import type {
  DepartmentWire,
  CompanyWire,
  BranchWire,
  JobPositionWire,
  JobGradeWire,
  JobLevelWire,
  CostCenterWire,
} from '../api/schema';
import { DepartmentFormDialog } from './DepartmentFormDialog';
import { CompanyFormDialog } from './CompanyFormDialog';
import { BranchFormDialog } from './BranchFormDialog';
import { JobPositionFormDialog } from './JobPositionFormDialog';
import { JobGradeFormDialog } from './JobGradeFormDialog';
import { JobLevelFormDialog } from './JobLevelFormDialog';
import { CostCenterFormDialog } from './CostCenterFormDialog';
import { toast } from '@/components/ui/Toast';
import { OrgChart } from './OrgChart';
import { useHasPermission } from '@/auth/session';

/**
 * Organization module live-data page.
 *
 * Seven stacked CRUD sections: Companies, Branches, Departments, Job
 * Positions, Job Grades, Job Levels, Cost Centers.
 * Stat strip at top shows honest backend counts (perPage:1 queries).
 * Each section manages its own page/search/filter state independently.
 */

const PER_PAGE = 10;

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number | undefined }) {
  return (
    <Card className="flex flex-col gap-1 px-5 pb-4 pt-4">
      <span className="text-caption text-ink-muted">{label}</span>
      <span className="nums font-mono text-[32px] font-bold leading-[1.1] tracking-[-0.04em] text-navy">
        {value !== undefined ? value.toLocaleString() : '—'}
      </span>
    </Card>
  );
}

// ─── Active / Inactive Badge ──────────────────────────────────────────────────

function ActiveBadge({ isActive }: { isActive: boolean | undefined }) {
  const { t } = useTranslation();
  if (isActive === false) {
    return (
      <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-500">
        {t('organization.department.inactive')}
      </span>
    );
  }
  return (
    <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700">
      {t('organization.department.active')}
    </span>
  );
}

// ─── HQ Badge ────────────────────────────────────────────────────────────────

function HQBadge() {
  const { t } = useTranslation();
  return (
    <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-navy/10 text-navy">
      {t('organization.branch.hq')}
    </span>
  );
}

// ─── Row Actions ──────────────────────────────────────────────────────────────

function RowActions({
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
  canEdit = true,
  canDelete = true,
}: {
  onEdit: () => void;
  onDelete: () => void;
  editLabel: string;
  deleteLabel: string;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  if (!canEdit && !canDelete) return null;
  return (
    <div className="flex items-center gap-1">
      {canEdit && (
        <Button variant="ghost" className="h-7 w-7 px-0" aria-label={editLabel} onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      )}
      {canDelete && (
        <Button
          variant="ghost"
          className="h-7 w-7 px-0 hover:!text-coral"
          aria-label={deleteLabel}
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

function initialsOf(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// ─── Search Input ─────────────────────────────────────────────────────────────

function SearchInput({ value, onChange, placeholder }: {
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

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, addLabel, onAdd, canAdd = true }: {
  title: string;
  addLabel: string;
  onAdd: () => void;
  canAdd?: boolean;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-body font-semibold text-ink">{title}</h2>
      {canAdd && (
        <Button variant="primary" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          {addLabel}
        </Button>
      )}
    </div>
  );
}

// ─── View Toggle ─────────────────────────────────────────────────────────────

type OrgView = 'list' | 'chart';

function ViewToggle({ view, onChange }: { view: OrgView; onChange: (v: OrgView) => void }) {
  const { t } = useTranslation();
  return (
    <div className="inline-flex rounded-full border border-hairline bg-surface p-0.5 shadow-sm">
      <button
        type="button"
        onClick={() => onChange('list')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors',
          view === 'list'
            ? 'bg-navy text-white shadow-sm'
            : 'text-ink-muted hover:text-ink',
        )}
        aria-pressed={view === 'list'}
      >
        <LayoutList className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        {t('organization.listView')}
      </button>
      <button
        type="button"
        onClick={() => onChange('chart')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors',
          view === 'chart'
            ? 'bg-navy text-white shadow-sm'
            : 'text-ink-muted hover:text-ink',
        )}
        aria-pressed={view === 'chart'}
      >
        <Network className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        {t('organization.chartView')}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function OrganizationPage() {
  const { t } = useTranslation();

  // ── View mode (list vs chart) ─────────────────────────────────────────────
  const [view, setView] = useState<OrgView>('list');

  // ── Department state ─────────────────────────────────────────────────────────
  const [deptSearchInput, setDeptSearchInput] = useState('');
  const [deptSearch, setDeptSearch] = useState('');
  const [deptPage, setDeptPage] = useState(1);
  const [deptFormOpen, setDeptFormOpen] = useState(false);
  const [editDept, setEditDept] = useState<DepartmentWire | undefined>(undefined);
  const [deleteDept, setDeleteDept] = useState<DepartmentWire | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => setDeptSearch(deptSearchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [deptSearchInput]);

  useEffect(() => { setDeptPage(1); }, [deptSearch]);

  const deptParams = useMemo<DepartmentListParams>(
    () => ({ page: deptPage, perPage: PER_PAGE, search: deptSearch || undefined }),
    [deptPage, deptSearch],
  );

  const { state: deptState, refetch: refetchDepts } = useDepartmentList(deptParams);
  const { state: totalDeptState } = useDepartmentList({ page: 1, perPage: 1 });
  const deleteDeptMutation = useDeleteDepartment(deptParams);
  const departments = deptState.data?.data ?? [];
  const deptMeta = deptState.data?.meta;

  // ── Company state ────────────────────────────────────────────────────────────
  const [companySearchInput, setCompanySearchInput] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [companyPage, setCompanyPage] = useState(1);
  const [companyFormOpen, setCompanyFormOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<CompanyWire | undefined>(undefined);
  const [deleteCompany, setDeleteCompany] = useState<CompanyWire | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => setCompanySearch(companySearchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [companySearchInput]);

  useEffect(() => { setCompanyPage(1); }, [companySearch]);

  const companyParams = useMemo<CompanyListParams>(
    () => ({ page: companyPage, perPage: PER_PAGE, search: companySearch || undefined }),
    [companyPage, companySearch],
  );

  const { state: companyState, refetch: refetchCompanies } = useCompanyList(companyParams);
  const { state: totalCompanyState } = useCompanyList({ page: 1, perPage: 1 });
  const deleteCompanyMutation = useDeleteCompany(companyParams);
  const companies = companyState.data?.data ?? [];
  const companyMeta = companyState.data?.meta;

  // Company list for pickers (branches + job positions filters)
  const { state: companyPickerState } = useCompanyList({ page: 1, perPage: 100 });
  const allCompanies = companyPickerState.data?.data ?? [];

  // ── Branch state ─────────────────────────────────────────────────────────────
  const [branchSearchInput, setBranchSearchInput] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
  const [branchPage, setBranchPage] = useState(1);
  const [branchCompanyFilter, setBranchCompanyFilter] = useState<number | undefined>(undefined);
  const [branchFormOpen, setBranchFormOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<BranchWire | undefined>(undefined);
  const [deleteBranch, setDeleteBranch] = useState<BranchWire | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => setBranchSearch(branchSearchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [branchSearchInput]);

  useEffect(() => { setBranchPage(1); }, [branchSearch, branchCompanyFilter]);

  const branchParams = useMemo<BranchListParams>(
    () => ({
      page: branchPage,
      perPage: PER_PAGE,
      search: branchSearch || undefined,
      companyId: branchCompanyFilter,
    }),
    [branchPage, branchSearch, branchCompanyFilter],
  );

  const { state: branchState, refetch: refetchBranches } = useBranchList(branchParams);
  const { state: totalBranchState } = useBranchList({ page: 1, perPage: 1 });
  const deleteBranchMutation = useDeleteBranch(branchParams);
  const branches = branchState.data?.data ?? [];
  const branchMeta = branchState.data?.meta;

  // ── JobPosition state ─────────────────────────────────────────────────────────
  const [jpSearchInput, setJpSearchInput] = useState('');
  const [jpSearch, setJpSearch] = useState('');
  const [jpPage, setJpPage] = useState(1);
  const [jpCompanyFilter, setJpCompanyFilter] = useState<number | undefined>(undefined);
  const [jpDeptFilter, setJpDeptFilter] = useState<number | undefined>(undefined);
  const [jpFormOpen, setJpFormOpen] = useState(false);
  const [editJp, setEditJp] = useState<JobPositionWire | undefined>(undefined);
  const [deleteJp, setDeleteJp] = useState<JobPositionWire | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => setJpSearch(jpSearchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [jpSearchInput]);

  useEffect(() => { setJpPage(1); }, [jpSearch, jpCompanyFilter, jpDeptFilter]);

  const jpParams = useMemo<JobPositionListParams>(
    () => ({
      page: jpPage,
      perPage: PER_PAGE,
      search: jpSearch || undefined,
      companyId: jpCompanyFilter,
      departmentId: jpDeptFilter,
    }),
    [jpPage, jpSearch, jpCompanyFilter, jpDeptFilter],
  );

  const { state: jpState, refetch: refetchJp } = useJobPositionList(jpParams);
  const { state: totalJpState } = useJobPositionList({ page: 1, perPage: 1 });
  const deleteJpMutation = useDeleteJobPosition(jpParams);
  const jobPositions = jpState.data?.data ?? [];
  const jpMeta = jpState.data?.meta;

  // Department list for JobPosition filter picker
  const { state: deptPickerState } = useDepartmentList({ page: 1, perPage: 200 });
  const allDepartments = deptPickerState.data?.data ?? [];

  // ── JobGrade state ───────────────────────────────────────────────────────────
  const [jgSearchInput, setJgSearchInput] = useState('');
  const [jgSearch, setJgSearch] = useState('');
  const [jgPage, setJgPage] = useState(1);
  const [jgFormOpen, setJgFormOpen] = useState(false);
  const [editJg, setEditJg] = useState<JobGradeWire | undefined>(undefined);
  const [deleteJg, setDeleteJg] = useState<JobGradeWire | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => setJgSearch(jgSearchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [jgSearchInput]);

  useEffect(() => { setJgPage(1); }, [jgSearch]);

  const jgParams = useMemo<JobGradeListParams>(
    () => ({ page: jgPage, perPage: PER_PAGE, search: jgSearch || undefined }),
    [jgPage, jgSearch],
  );

  const { state: jgState, refetch: refetchJg } = useJobGradeList(jgParams);
  const { state: totalJgState } = useJobGradeList({ page: 1, perPage: 1 });
  const deleteJgMutation = useDeleteJobGrade(jgParams);
  const jobGrades = jgState.data?.data ?? [];
  const jgMeta = jgState.data?.meta;

  // ── JobLevel state ───────────────────────────────────────────────────────────
  const [jlSearchInput, setJlSearchInput] = useState('');
  const [jlSearch, setJlSearch] = useState('');
  const [jlPage, setJlPage] = useState(1);
  const [jlFormOpen, setJlFormOpen] = useState(false);
  const [editJl, setEditJl] = useState<JobLevelWire | undefined>(undefined);
  const [deleteJl, setDeleteJl] = useState<JobLevelWire | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => setJlSearch(jlSearchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [jlSearchInput]);

  useEffect(() => { setJlPage(1); }, [jlSearch]);

  const jlParams = useMemo<JobLevelListParams>(
    () => ({ page: jlPage, perPage: PER_PAGE, search: jlSearch || undefined }),
    [jlPage, jlSearch],
  );

  const { state: jlState, refetch: refetchJl } = useJobLevelList(jlParams);
  const { state: totalJlState } = useJobLevelList({ page: 1, perPage: 1 });
  const deleteJlMutation = useDeleteJobLevel(jlParams);
  const jobLevels = jlState.data?.data ?? [];
  const jlMeta = jlState.data?.meta;

  // ── CostCenter state ─────────────────────────────────────────────────────────
  const [ccSearchInput, setCcSearchInput] = useState('');
  const [ccSearch, setCcSearch] = useState('');
  const [ccPage, setCcPage] = useState(1);
  const [ccFormOpen, setCcFormOpen] = useState(false);
  const [editCc, setEditCc] = useState<CostCenterWire | undefined>(undefined);
  const [deleteCc, setDeleteCc] = useState<CostCenterWire | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => setCcSearch(ccSearchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [ccSearchInput]);

  useEffect(() => { setCcPage(1); }, [ccSearch]);

  const ccParams = useMemo<CostCenterListParams>(
    () => ({ page: ccPage, perPage: PER_PAGE }),
    [ccPage],
  );

  const { state: ccState, refetch: refetchCc } = useCostCenterList(ccParams);
  const { state: totalCcState } = useCostCenterList({ page: 1, perPage: 1 });
  const deleteCcMutation = useDeleteCostCenter(ccParams);
  const allCostCenters = ccState.data?.data ?? [];
  const costCenters = ccSearch
    ? allCostCenters.filter((cc) =>
        cc.name.toLowerCase().includes(ccSearch.toLowerCase()) ||
        (cc.code ?? '').toLowerCase().includes(ccSearch.toLowerCase()),
      )
    : allCostCenters;
  const ccMeta = ccState.data?.meta;

  // ── Actions ───────────────────────────────────────────────────────────────────

  async function confirmDeleteDept() {
    if (!deleteDept) return;

    try {
      await deleteDeptMutation.mutateAsync(deleteDept.id);
      toast.success('common.deleted');
      setDeleteDept(undefined);
    } catch (error) {
      toast.error(userFacingMessage(error));
    }
  }

  async function confirmDeleteCompany() {
    if (!deleteCompany) return;

    try {
      await deleteCompanyMutation.mutateAsync(deleteCompany.id);
      toast.success('common.deleted');
      setDeleteCompany(undefined);
    } catch (error) {
      toast.error(userFacingMessage(error));
    }
  }

  async function confirmDeleteBranch() {
    if (!deleteBranch) return;

    try {
      await deleteBranchMutation.mutateAsync(deleteBranch.id);
      toast.success('common.deleted');
      setDeleteBranch(undefined);
    } catch (error) {
      toast.error(userFacingMessage(error));
    }
  }

  async function confirmDeleteJp() {
    if (!deleteJp) return;

    try {
      await deleteJpMutation.mutateAsync(deleteJp.id);
      toast.success('common.deleted');
      setDeleteJp(undefined);
    } catch (error) {
      toast.error(userFacingMessage(error));
    }
  }

  async function confirmDeleteJg() {
    if (!deleteJg) return;

    try {
      await deleteJgMutation.mutateAsync(deleteJg.id);
      toast.success('common.deleted');
      setDeleteJg(undefined);
    } catch (error) {
      toast.error(userFacingMessage(error));
    }
  }

  async function confirmDeleteJl() {
    if (!deleteJl) return;

    try {
      await deleteJlMutation.mutateAsync(deleteJl.id);
      toast.success('common.deleted');
      setDeleteJl(undefined);
    } catch (error) {
      toast.error(userFacingMessage(error));
    }
  }

  async function confirmDeleteCc() {
    if (!deleteCc) return;

    try {
      await deleteCcMutation.mutateAsync(deleteCc.id);
      toast.success('common.deleted');
      setDeleteCc(undefined);
    } catch (error) {
      toast.error(userFacingMessage(error));
    }
  }

  // ── Permissions ─────────────────────────────────────────────────────────────
  const canCreateDept    = useHasPermission('organization.department.create');
  const canEditDept      = useHasPermission('organization.department.edit');
  const canDeleteDept    = useHasPermission('organization.department.delete');

  const canCreateCompany = useHasPermission('organization.company.create');
  const canEditCompany   = useHasPermission('organization.company.edit');
  const canDeleteCompany = useHasPermission('organization.company.delete');

  const canCreateBranch  = useHasPermission('organization.branch.create');
  const canEditBranch    = useHasPermission('organization.branch.edit');
  const canDeleteBranch  = useHasPermission('organization.branch.delete');

  const canCreateJp      = useHasPermission('organization.job_position.create');
  const canEditJp        = useHasPermission('organization.job_position.edit');
  const canDeleteJp      = useHasPermission('organization.job_position.delete');

  const canCreateJg      = useHasPermission('organization.job_grade.create');
  const canEditJg        = useHasPermission('organization.job_grade.edit');
  const canDeleteJg      = useHasPermission('organization.job_grade.delete');

  const canCreateJl      = useHasPermission('organization.job_level.create');
  const canEditJl        = useHasPermission('organization.job_level.edit');
  const canDeleteJl      = useHasPermission('organization.job_level.delete');

  const canCreateCc      = useHasPermission('organization.cost_center.create');
  const canEditCc        = useHasPermission('organization.cost_center.edit');
  const canDeleteCc      = useHasPermission('organization.cost_center.delete');

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t('organization.title')}
        actions={
          canCreateDept ? (
            <Button variant="primary" onClick={() => { setEditDept(undefined); setDeptFormOpen(true); }}>
              <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              {t('organization.addDepartment')}
            </Button>
          ) : undefined
        }
      />

      {/* Stat strip — all honest backend counts */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <StatCard label={t('organization.stat.companies')} value={totalCompanyState.data?.meta.total} />
        <StatCard label={t('organization.stat.branches')} value={totalBranchState.data?.meta.total} />
        <StatCard label={t('organization.stat.departments')} value={totalDeptState.data?.meta.total} />
        <StatCard label={t('organization.stat.positions')} value={totalJpState.data?.meta.total} />
        <StatCard label={t('organization.stat.jobGrades')} value={totalJgState.data?.meta.total} />
        <StatCard label={t('organization.stat.jobLevels')} value={totalJlState.data?.meta.total} />
        <StatCard label={t('organization.stat.costCenters')} value={totalCcState.data?.meta.total} />
      </div>

      {/* View toggle — List vs Org Chart */}
      <div className="mb-8 flex items-center justify-between gap-4">
        <h2 className="text-body font-semibold text-ink">
          {view === 'chart' ? t('organization.orgChart') : t('organization.title')}
        </h2>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {/* ═══ Org Chart View ══════════════════════════════════════════════════ */}
      {view === 'chart' && (
        <div className="mb-8">
          <OrgChart />
        </div>
      )}

      {/* ═══ List View (existing CRUD sections) ══════════════════════════════ */}
      {view === 'list' && (
        <>

      {/* ═══ Section 1: Companies ═══════════════════════════════════════════════ */}
      <SectionHeader
        title={t('organization.companiesSectionTitle')}
        addLabel={t('organization.addCompany')}
        onAdd={() => { setEditCompany(undefined); setCompanyFormOpen(true); }}
        canAdd={canCreateCompany}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={companySearchInput}
          onChange={setCompanySearchInput}
          placeholder={t('organization.searchPlaceholder')}
        />
      </div>

      {companyState.error ? (
        <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>{userFacingMessage(companyState.error) || t('organization.loadFailed')}</span>
          <Button variant="secondary" onClick={() => void refetchCompanies()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {companyState.status === 'pending' && companies.length === 0 ? (
        <SkeletonTable />
      ) : null}

      {companyState.status !== 'pending' && companies.length === 0 && !companyState.error ? (
        <Card className="mb-4 px-5 py-10 text-center text-body-sm text-ink-muted">{t('organization.emptySearch')}</Card>
      ) : null}

      {companies.length > 0 && (
        <>
          {/* Companies table — desktop */}
          <Card className="mb-4 hidden lg:block">
            <div className="border-b border-divider px-5 py-3">
              <div className="grid grid-cols-[2fr_1fr_1fr_100px_auto] gap-4">
                {(['company.table.name', 'company.table.registration', 'company.table.country', 'company.table.status', 'company.table.actions'] as const).map((key) => (
                  <span key={key} className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                    {t(`organization.${key}`)}
                  </span>
                ))}
              </div>
            </div>
            {companies.map((company, idx) => (
              <div
                key={company.id}
                className={cn(
                  'grid grid-cols-[2fr_1fr_1fr_100px_auto] items-center gap-4 px-5 py-3',
                  idx < companies.length - 1 && 'border-b border-divider',
                  'transition-colors hover:bg-surface/60',
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-semibold text-ink">{company.name}</p>
                  {company.legal_name ? (
                    <p className="truncate text-caption text-ink-muted">{company.legal_name}</p>
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-body-sm text-ink">{company.registration_number ?? '—'}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-body-sm text-ink">{company.country_code} / {company.currency_code}</p>
                  {company.city ? <p className="truncate text-caption text-ink-muted">{company.city}</p> : null}
                </div>
                <div><ActiveBadge isActive={company.is_active} /></div>
                <RowActions
                  onEdit={() => { setEditCompany(company); setCompanyFormOpen(true); }}
                  onDelete={() => setDeleteCompany(company)}
                  editLabel={t('organization.company.editAction')}
                  deleteLabel={t('organization.company.deleteAction')}
                  canEdit={canEditCompany}
                  canDelete={canDeleteCompany}
                />
              </div>
            ))}
          </Card>

          {/* Companies cards — mobile */}
          <div className="mb-4 flex flex-col gap-3 lg:hidden">
            {companies.map((company) => (
              <Card key={company.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-ink">{company.name}</p>
                    {company.registration_number ? (
                      <p className="truncate text-caption text-ink-muted">{company.registration_number}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <ActiveBadge isActive={company.is_active} />
                    <RowActions
                      onEdit={() => { setEditCompany(company); setCompanyFormOpen(true); }}
                      onDelete={() => setDeleteCompany(company)}
                      editLabel={t('organization.company.editAction')}
                      deleteLabel={t('organization.company.deleteAction')}
                      canEdit={canEditCompany}
                      canDelete={canDeleteCompany}
                    />
                  </div>
                </div>
                <div className="border-t border-divider pt-3 text-body-sm text-ink-muted">
                  {company.country_code} / {company.currency_code}
                  {company.city ? ` · ${company.city}` : ''}
                </div>
              </Card>
            ))}
          </div>

          {companyMeta ? (
            <div className="mb-8">
              <Pagination
                currentPage={companyMeta.current_page}
                lastPage={companyMeta.last_page}
                total={companyMeta.total}
                perPage={companyMeta.per_page}
                onPageChange={setCompanyPage}
              />
            </div>
          ) : <div className="mb-8" />}
        </>
      )}

      {companies.length === 0 && <div className="mb-8" />}

      {/* ═══ Section 2: Branches ════════════════════════════════════════════════ */}
      <SectionHeader
        title={t('organization.branchesSectionTitle')}
        addLabel={t('organization.addBranch')}
        onAdd={() => { setEditBranch(undefined); setBranchFormOpen(true); }}
        canAdd={canCreateBranch}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          className="h-9 w-44 text-[13px]"
          value={branchCompanyFilter !== undefined ? String(branchCompanyFilter) : ''}
          onChange={(e) => {
            const val = e.target.value;
            setBranchCompanyFilter(val ? Number(val) : undefined);
          }}
          aria-label={t('organization.allCompanies')}
        >
          <option value="">{t('organization.allCompanies')}</option>
          {allCompanies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <SearchInput
          value={branchSearchInput}
          onChange={setBranchSearchInput}
          placeholder={t('organization.searchPlaceholder')}
        />
      </div>

      {branchState.error ? (
        <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>{userFacingMessage(branchState.error) || t('organization.loadFailed')}</span>
          <Button variant="secondary" onClick={() => void refetchBranches()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {branchState.status === 'pending' && branches.length === 0 ? (
        <SkeletonTable />
      ) : null}

      {branchState.status !== 'pending' && branches.length === 0 && !branchState.error ? (
        <Card className="mb-4 px-5 py-10 text-center text-body-sm text-ink-muted">{t('organization.emptySearch')}</Card>
      ) : null}

      {branches.length > 0 && (
        <>
          {/* Branches table — desktop */}
          <Card className="mb-4 hidden lg:block">
            <div className="border-b border-divider px-5 py-3">
              <div className="grid grid-cols-[2fr_1fr_1fr_90px_100px_auto] gap-4">
                {(['branch.table.name', 'branch.table.company', 'branch.table.city', 'branch.table.hq', 'branch.table.status', 'branch.table.actions'] as const).map((key) => (
                  <span key={key} className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                    {t(`organization.${key}`)}
                  </span>
                ))}
              </div>
            </div>
            {branches.map((branch, idx) => (
              <div
                key={branch.id}
                className={cn(
                  'grid grid-cols-[2fr_1fr_1fr_90px_100px_auto] items-center gap-4 px-5 py-3',
                  idx < branches.length - 1 && 'border-b border-divider',
                  'transition-colors hover:bg-surface/60',
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-semibold text-ink">{branch.name}</p>
                  {branch.code ? <p className="truncate text-caption text-ink-muted">{branch.code}</p> : null}
                </div>
                <p className="truncate text-body-sm text-ink">{branch.company?.name ?? '—'}</p>
                <p className="truncate text-body-sm text-ink">{branch.city ?? '—'}</p>
                <div>{branch.is_headquarters ? <HQBadge /> : null}</div>
                <div><ActiveBadge isActive={branch.is_active} /></div>
                <RowActions
                  onEdit={() => { setEditBranch(branch); setBranchFormOpen(true); }}
                  onDelete={() => setDeleteBranch(branch)}
                  editLabel={t('organization.branch.editAction')}
                  deleteLabel={t('organization.branch.deleteAction')}
                  canEdit={canEditBranch}
                  canDelete={canDeleteBranch}
                />
              </div>
            ))}
          </Card>

          {/* Branches cards — mobile */}
          <div className="mb-4 flex flex-col gap-3 lg:hidden">
            {branches.map((branch) => (
              <Card key={branch.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-ink">{branch.name}</p>
                    {branch.code ? <p className="truncate text-caption text-ink-muted">{branch.code}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className="flex items-center gap-1.5">
                      {branch.is_headquarters ? <HQBadge /> : null}
                      <ActiveBadge isActive={branch.is_active} />
                    </div>
                    <RowActions
                      onEdit={() => { setEditBranch(branch); setBranchFormOpen(true); }}
                      onDelete={() => setDeleteBranch(branch)}
                      editLabel={t('organization.branch.editAction')}
                      deleteLabel={t('organization.branch.deleteAction')}
                      canEdit={canEditBranch}
                      canDelete={canDeleteBranch}
                    />
                  </div>
                </div>
                <div className="border-t border-divider pt-3 text-body-sm text-ink-muted">
                  {branch.company?.name ?? '—'}
                  {branch.city ? ` · ${branch.city}` : ''}
                </div>
              </Card>
            ))}
          </div>

          {branchMeta ? (
            <div className="mb-8">
              <Pagination
                currentPage={branchMeta.current_page}
                lastPage={branchMeta.last_page}
                total={branchMeta.total}
                perPage={branchMeta.per_page}
                onPageChange={setBranchPage}
              />
            </div>
          ) : <div className="mb-8" />}
        </>
      )}

      {branches.length === 0 && <div className="mb-8" />}

      {/* ═══ Section 3: Departments ═════════════════════════════════════════════ */}
      <SectionHeader
        title={t('organization.departmentsSectionTitle')}
        addLabel={t('organization.addDepartment')}
        onAdd={() => { setEditDept(undefined); setDeptFormOpen(true); }}
        canAdd={canCreateDept}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={deptSearchInput}
          onChange={setDeptSearchInput}
          placeholder={t('organization.searchPlaceholder')}
        />
      </div>

      {deptState.error ? (
        <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>{userFacingMessage(deptState.error) || t('organization.loadFailed')}</span>
          <Button variant="secondary" onClick={() => void refetchDepts()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {deptState.status === 'pending' && departments.length === 0 ? (
        <SkeletonTable />
      ) : null}

      {deptState.status !== 'pending' && departments.length === 0 && !deptState.error ? (
        <Card className="mb-4 px-5 py-10 text-center text-body-sm text-ink-muted">{t('organization.emptySearch')}</Card>
      ) : null}

      {departments.length > 0 && (
        <>
          {/* Department table — desktop/tablet-landscape */}
          <Card className="mb-4 hidden lg:block">
            <div className="border-b border-divider px-5 py-3">
              <div className="grid grid-cols-[2fr_2fr_120px_auto] gap-4">
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('organization.table.department')}
                </span>
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('organization.table.head')}
                </span>
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('organization.table.status')}
                </span>
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                  {t('organization.table.actions')}
                </span>
              </div>
            </div>

            {departments.map((dept, idx) => (
              <div
                key={dept.id}
                className={cn(
                  'grid grid-cols-[2fr_2fr_120px_auto] items-center gap-4 px-5 py-3',
                  idx < departments.length - 1 && 'border-b border-divider',
                  'transition-colors hover:bg-surface/60',
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-semibold text-ink">{dept.name}</p>
                  {dept.code ? <p className="truncate text-caption text-ink-muted">{dept.code}</p> : null}
                </div>

                <div className="flex min-w-0 items-center gap-2">
                  {dept.head ? (
                    <>
                      <Avatar
                        initials={initialsOf(dept.head.first_name, dept.head.last_name)}
                        photo={dept.head.photo}
                        size={32}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-body-sm text-ink">
                          {dept.head.first_name} {dept.head.last_name}
                        </p>
                        <p className="truncate text-caption text-ink-muted">{dept.head.employee_number}</p>
                      </div>
                    </>
                  ) : (
                    <span className="text-body-sm text-ink-faint">{t('organization.department.vacant')}</span>
                  )}
                </div>

                <div><ActiveBadge isActive={dept.is_active} /></div>

                <RowActions
                  onEdit={() => { setEditDept(dept); setDeptFormOpen(true); }}
                  onDelete={() => setDeleteDept(dept)}
                  editLabel={t('organization.department.editAction')}
                  deleteLabel={t('organization.department.deleteAction')}
                  canEdit={canEditDept}
                  canDelete={canDeleteDept}
                />
              </div>
            ))}
          </Card>

          {/* Department cards — mobile/tablet-portrait */}
          <div className="mb-4 flex flex-col gap-3 lg:hidden">
            {departments.map((dept) => (
              <Card key={dept.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-ink">{dept.name}</p>
                    {dept.code ? <p className="truncate text-caption text-ink-muted">{dept.code}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <ActiveBadge isActive={dept.is_active} />
                    <RowActions
                      onEdit={() => { setEditDept(dept); setDeptFormOpen(true); }}
                      onDelete={() => setDeleteDept(dept)}
                      editLabel={t('organization.department.editAction')}
                      deleteLabel={t('organization.department.deleteAction')}
                      canEdit={canEditDept}
                      canDelete={canDeleteDept}
                    />
                  </div>
                </div>

                <div className="border-t border-divider pt-3">
                  <span className="text-caption text-ink-faint">{t('organization.table.head')}</span>
                  <div className="mt-1 flex items-center gap-2">
                    {dept.head ? (
                      <>
                        <Avatar
                          initials={initialsOf(dept.head.first_name, dept.head.last_name)}
                          photo={dept.head.photo}
                          size={24}
                        />
                        <span className="truncate text-body-sm text-ink">
                          {dept.head.first_name} {dept.head.last_name}
                        </span>
                      </>
                    ) : (
                      <span className="text-body-sm text-ink-faint">{t('organization.department.vacant')}</span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {deptMeta ? (
            <div className="mb-8">
              <Pagination
                currentPage={deptMeta.current_page}
                lastPage={deptMeta.last_page}
                total={deptMeta.total}
                perPage={deptMeta.per_page}
                onPageChange={setDeptPage}
              />
            </div>
          ) : <div className="mb-8" />}
        </>
      )}

      {departments.length === 0 && <div className="mb-8" />}

      {/* ═══ Section 4: Job Positions ════════════════════════════════════════════ */}
      <SectionHeader
        title={t('organization.jobPositionsSectionTitle')}
        addLabel={t('organization.addJobPosition')}
        onAdd={() => { setEditJp(undefined); setJpFormOpen(true); }}
        canAdd={canCreateJp}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          className="h-9 w-44 text-[13px]"
          value={jpCompanyFilter !== undefined ? String(jpCompanyFilter) : ''}
          onChange={(e) => {
            const val = e.target.value;
            setJpCompanyFilter(val ? Number(val) : undefined);
          }}
          aria-label={t('organization.allCompanies')}
        >
          <option value="">{t('organization.allCompanies')}</option>
          {allCompanies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select
          className="h-9 w-44 text-[13px]"
          value={jpDeptFilter !== undefined ? String(jpDeptFilter) : ''}
          onChange={(e) => {
            const val = e.target.value;
            setJpDeptFilter(val ? Number(val) : undefined);
          }}
          aria-label={t('organization.allDepartments')}
        >
          <option value="">{t('organization.allDepartments')}</option>
          {allDepartments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </Select>
        <SearchInput
          value={jpSearchInput}
          onChange={setJpSearchInput}
          placeholder={t('organization.searchPlaceholder')}
        />
      </div>

      {jpState.error ? (
        <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>{userFacingMessage(jpState.error) || t('organization.loadFailed')}</span>
          <Button variant="secondary" onClick={() => void refetchJp()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {jpState.status === 'pending' && jobPositions.length === 0 ? (
        <SkeletonTable />
      ) : null}

      {jpState.status !== 'pending' && jobPositions.length === 0 && !jpState.error ? (
        <Card className="mb-4 px-5 py-10 text-center text-body-sm text-ink-muted">{t('organization.emptySearch')}</Card>
      ) : null}

      {jobPositions.length > 0 && (
        <>
          {/* Job Positions table — desktop */}
          <Card className="mb-4 hidden lg:block">
            <div className="border-b border-divider px-5 py-3">
              <div className="grid grid-cols-[2fr_1fr_1fr_80px_100px_auto] gap-4">
                {(['jobPosition.table.title', 'jobPosition.table.company', 'jobPosition.table.department', 'jobPosition.table.headcount', 'jobPosition.table.status', 'jobPosition.table.actions'] as const).map((key) => (
                  <span key={key} className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                    {t(`organization.${key}`)}
                  </span>
                ))}
              </div>
            </div>
            {jobPositions.map((jp, idx) => (
              <div
                key={jp.id}
                className={cn(
                  'grid grid-cols-[2fr_1fr_1fr_80px_100px_auto] items-center gap-4 px-5 py-3',
                  idx < jobPositions.length - 1 && 'border-b border-divider',
                  'transition-colors hover:bg-surface/60',
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-semibold text-ink">{jp.title}</p>
                  {jp.code ? <p className="truncate text-caption text-ink-muted">{jp.code}</p> : null}
                </div>
                <p className="truncate text-body-sm text-ink">{jp.company?.name ?? '—'}</p>
                <p className="truncate text-body-sm text-ink">
                  {jp.department?.name ?? <span className="text-ink-faint">{t('organization.jobPosition.unassigned')}</span>}
                </p>
                <p className="nums font-mono text-body-sm text-ink">{jp.headcount ?? '—'}</p>
                <div><ActiveBadge isActive={jp.is_active} /></div>
                <RowActions
                  onEdit={() => { setEditJp(jp); setJpFormOpen(true); }}
                  onDelete={() => setDeleteJp(jp)}
                  editLabel={t('organization.jobPosition.editAction')}
                  deleteLabel={t('organization.jobPosition.deleteAction')}
                  canEdit={canEditJp}
                  canDelete={canDeleteJp}
                />
              </div>
            ))}
          </Card>

          {/* Job Positions cards — mobile */}
          <div className="mb-4 flex flex-col gap-3 lg:hidden">
            {jobPositions.map((jp) => (
              <Card key={jp.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-ink">{jp.title}</p>
                    {jp.code ? <p className="truncate text-caption text-ink-muted">{jp.code}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <ActiveBadge isActive={jp.is_active} />
                    <RowActions
                      onEdit={() => { setEditJp(jp); setJpFormOpen(true); }}
                      onDelete={() => setDeleteJp(jp)}
                      editLabel={t('organization.jobPosition.editAction')}
                      deleteLabel={t('organization.jobPosition.deleteAction')}
                      canEdit={canEditJp}
                      canDelete={canDeleteJp}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-divider pt-3">
                  <div>
                    <p className="text-caption text-ink-faint">{t('organization.jobPosition.table.company')}</p>
                    <p className="truncate text-body-sm text-ink">{jp.company?.name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-caption text-ink-faint">{t('organization.jobPosition.table.department')}</p>
                    <p className="truncate text-body-sm text-ink">
                      {jp.department?.name ?? t('organization.jobPosition.unassigned')}
                    </p>
                  </div>
                  {jp.headcount !== undefined ? (
                    <div>
                      <p className="text-caption text-ink-faint">{t('organization.jobPosition.table.headcount')}</p>
                      <p className="nums font-mono text-body-sm text-ink">{jp.headcount}</p>
                    </div>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>

          {jpMeta ? (
            <div className="mb-8">
              <Pagination
                currentPage={jpMeta.current_page}
                lastPage={jpMeta.last_page}
                total={jpMeta.total}
                perPage={jpMeta.per_page}
                onPageChange={setJpPage}
              />
            </div>
          ) : <div className="mb-8" />}
        </>
      )}

      {jobPositions.length === 0 && <div className="mb-8" />}

      {/* ═══ Section 5: Job Grades ═══════════════════════════════════════════════ */}
      <SectionHeader
        title={t('organization.jobGradesSectionTitle')}
        addLabel={t('organization.addJobGrade')}
        onAdd={() => { setEditJg(undefined); setJgFormOpen(true); }}
        canAdd={canCreateJg}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={jgSearchInput}
          onChange={setJgSearchInput}
          placeholder={t('organization.searchPlaceholder')}
        />
      </div>

      {jgState.error ? (
        <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>{userFacingMessage(jgState.error) || t('organization.loadFailed')}</span>
          <Button variant="secondary" onClick={() => void refetchJg()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {jgState.status === 'pending' && jobGrades.length === 0 ? (
        <SkeletonTable />
      ) : null}

      {jgState.status !== 'pending' && jobGrades.length === 0 && !jgState.error ? (
        <Card className="mb-4 px-5 py-10 text-center text-body-sm text-ink-muted">{t('organization.emptySearch')}</Card>
      ) : null}

      {jobGrades.length > 0 && (
        <>
          {/* Job Grades table — desktop */}
          <Card className="mb-4 hidden lg:block">
            <div className="border-b border-divider px-5 py-3">
              <div className="grid grid-cols-[2fr_1fr_2fr_100px_auto] gap-4">
                {(['jobGrade.table.name', 'jobGrade.table.code', 'jobGrade.table.salaryRange', 'jobGrade.table.sortOrder', 'jobGrade.table.actions'] as const).map((key) => (
                  <span key={key} className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                    {t(`organization.${key}`)}
                  </span>
                ))}
              </div>
            </div>
            {jobGrades.map((jg, idx) => (
              <div
                key={jg.id}
                className={cn(
                  'grid grid-cols-[2fr_1fr_2fr_100px_auto] items-center gap-4 px-5 py-3',
                  idx < jobGrades.length - 1 && 'border-b border-divider',
                  'transition-colors hover:bg-surface/60',
                )}
              >
                <p className="truncate text-body-sm font-semibold text-ink">{jg.name}</p>
                <p className="truncate text-body-sm text-ink">{jg.code ?? '—'}</p>
                <p className="nums truncate font-mono text-body-sm text-ink">
                  {jg.min_salary ?? '—'} / {jg.mid_salary ?? '—'} / {jg.max_salary ?? '—'}
                </p>
                <p className="nums font-mono text-body-sm text-ink">{jg.sort_order ?? '—'}</p>
                <RowActions
                  onEdit={() => { setEditJg(jg); setJgFormOpen(true); }}
                  onDelete={() => setDeleteJg(jg)}
                  editLabel={t('organization.jobGrade.editAction')}
                  deleteLabel={t('organization.jobGrade.deleteAction')}
                  canEdit={canEditJg}
                  canDelete={canDeleteJg}
                />
              </div>
            ))}
          </Card>

          {/* Job Grades cards — mobile */}
          <div className="mb-4 flex flex-col gap-3 lg:hidden">
            {jobGrades.map((jg) => (
              <Card key={jg.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-ink">{jg.name}</p>
                    {jg.code ? <p className="truncate text-caption text-ink-muted">{jg.code}</p> : null}
                  </div>
                  <RowActions
                    onEdit={() => { setEditJg(jg); setJgFormOpen(true); }}
                    onDelete={() => setDeleteJg(jg)}
                    editLabel={t('organization.jobGrade.editAction')}
                    deleteLabel={t('organization.jobGrade.deleteAction')}
                    canEdit={canEditJg}
                    canDelete={canDeleteJg}
                  />
                </div>
                <div className="border-t border-divider pt-3 text-body-sm text-ink-muted">
                  {jg.min_salary ?? '—'} / {jg.mid_salary ?? '—'} / {jg.max_salary ?? '—'}
                </div>
              </Card>
            ))}
          </div>

          {jgMeta ? (
            <div className="mb-8">
              <Pagination
                currentPage={jgMeta.current_page}
                lastPage={jgMeta.last_page}
                total={jgMeta.total}
                perPage={jgMeta.per_page}
                onPageChange={setJgPage}
              />
            </div>
          ) : <div className="mb-8" />}
        </>
      )}

      {jobGrades.length === 0 && <div className="mb-8" />}

      {/* ═══ Section 6: Job Levels ═══════════════════════════════════════════════ */}
      <SectionHeader
        title={t('organization.jobLevelsSectionTitle')}
        addLabel={t('organization.addJobLevel')}
        onAdd={() => { setEditJl(undefined); setJlFormOpen(true); }}
        canAdd={canCreateJl}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={jlSearchInput}
          onChange={setJlSearchInput}
          placeholder={t('organization.searchPlaceholder')}
        />
      </div>

      {jlState.error ? (
        <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>{userFacingMessage(jlState.error) || t('organization.loadFailed')}</span>
          <Button variant="secondary" onClick={() => void refetchJl()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {jlState.status === 'pending' && jobLevels.length === 0 ? (
        <SkeletonTable />
      ) : null}

      {jlState.status !== 'pending' && jobLevels.length === 0 && !jlState.error ? (
        <Card className="mb-4 px-5 py-10 text-center text-body-sm text-ink-muted">{t('organization.emptySearch')}</Card>
      ) : null}

      {jobLevels.length > 0 && (
        <>
          {/* Job Levels table — desktop */}
          <Card className="mb-4 hidden lg:block">
            <div className="border-b border-divider px-5 py-3">
              <div className="grid grid-cols-[2fr_1fr_auto] gap-4">
                {(['jobLevel.table.name', 'jobLevel.table.sortOrder', 'jobLevel.table.actions'] as const).map((key) => (
                  <span key={key} className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                    {t(`organization.${key}`)}
                  </span>
                ))}
              </div>
            </div>
            {jobLevels.map((jl, idx) => (
              <div
                key={jl.id}
                className={cn(
                  'grid grid-cols-[2fr_1fr_auto] items-center gap-4 px-5 py-3',
                  idx < jobLevels.length - 1 && 'border-b border-divider',
                  'transition-colors hover:bg-surface/60',
                )}
              >
                <p className="truncate text-body-sm font-semibold text-ink">{jl.name}</p>
                <p className="nums font-mono text-body-sm text-ink">{jl.sort_order ?? '—'}</p>
                <RowActions
                  onEdit={() => { setEditJl(jl); setJlFormOpen(true); }}
                  onDelete={() => setDeleteJl(jl)}
                  editLabel={t('organization.jobLevel.editAction')}
                  deleteLabel={t('organization.jobLevel.deleteAction')}
                  canEdit={canEditJl}
                  canDelete={canDeleteJl}
                />
              </div>
            ))}
          </Card>

          {/* Job Levels cards — mobile */}
          <div className="mb-4 flex flex-col gap-3 lg:hidden">
            {jobLevels.map((jl) => (
              <Card key={jl.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-ink">{jl.name}</p>
                  </div>
                  <RowActions
                    onEdit={() => { setEditJl(jl); setJlFormOpen(true); }}
                    onDelete={() => setDeleteJl(jl)}
                    editLabel={t('organization.jobLevel.editAction')}
                    deleteLabel={t('organization.jobLevel.deleteAction')}
                    canEdit={canEditJl}
                    canDelete={canDeleteJl}
                  />
                </div>
              </Card>
            ))}
          </div>

          {jlMeta ? (
            <div className="mb-8">
              <Pagination
                currentPage={jlMeta.current_page}
                lastPage={jlMeta.last_page}
                total={jlMeta.total}
                perPage={jlMeta.per_page}
                onPageChange={setJlPage}
              />
            </div>
          ) : <div className="mb-8" />}
        </>
      )}

      {jobLevels.length === 0 && <div className="mb-8" />}

      {/* ═══ Section 7: Cost Centers ═════════════════════════════════════════════ */}
      <SectionHeader
        title={t('organization.costCentersSectionTitle')}
        addLabel={t('organization.addCostCenter')}
        onAdd={() => { setEditCc(undefined); setCcFormOpen(true); }}
        canAdd={canCreateCc}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={ccSearchInput}
          onChange={setCcSearchInput}
          placeholder={t('organization.searchPlaceholder')}
        />
      </div>

      {ccState.error ? (
        <Card className="mb-4 flex items-center justify-between gap-3 px-5 py-3 text-body-sm text-coral">
          <span>{userFacingMessage(ccState.error) || t('organization.loadFailed')}</span>
          <Button variant="secondary" onClick={() => void refetchCc()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {ccState.status === 'pending' && costCenters.length === 0 ? (
        <SkeletonTable />
      ) : null}

      {ccState.status !== 'pending' && costCenters.length === 0 && !ccState.error ? (
        <Card className="mb-4 px-5 py-10 text-center text-body-sm text-ink-muted">{t('organization.emptySearch')}</Card>
      ) : null}

      {costCenters.length > 0 && (
        <>
          {/* Cost Centers table — desktop */}
          <Card className="mb-4 hidden lg:block">
            <div className="border-b border-divider px-5 py-3">
              <div className="grid grid-cols-[2fr_1fr_100px_auto] gap-4">
                {(['costCenter.table.name', 'costCenter.table.code', 'costCenter.table.status', 'costCenter.table.actions'] as const).map((key) => (
                  <span key={key} className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                    {t(`organization.${key}`)}
                  </span>
                ))}
              </div>
            </div>
            {costCenters.map((cc, idx) => (
              <div
                key={cc.id}
                className={cn(
                  'grid grid-cols-[2fr_1fr_100px_auto] items-center gap-4 px-5 py-3',
                  idx < costCenters.length - 1 && 'border-b border-divider',
                  'transition-colors hover:bg-surface/60',
                )}
              >
                <p className="truncate text-body-sm font-semibold text-ink">{cc.name}</p>
                <p className="truncate text-body-sm text-ink">{cc.code ?? '—'}</p>
                <div><ActiveBadge isActive={cc.is_active} /></div>
                <RowActions
                  onEdit={() => { setEditCc(cc); setCcFormOpen(true); }}
                  onDelete={() => setDeleteCc(cc)}
                  editLabel={t('organization.costCenter.editAction')}
                  deleteLabel={t('organization.costCenter.deleteAction')}
                  canEdit={canEditCc}
                  canDelete={canDeleteCc}
                />
              </div>
            ))}
          </Card>

          {/* Cost Centers cards — mobile */}
          <div className="mb-4 flex flex-col gap-3 lg:hidden">
            {costCenters.map((cc) => (
              <Card key={cc.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-ink">{cc.name}</p>
                    {cc.code ? <p className="truncate text-caption text-ink-muted">{cc.code}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <ActiveBadge isActive={cc.is_active} />
                    <RowActions
                      onEdit={() => { setEditCc(cc); setCcFormOpen(true); }}
                      onDelete={() => setDeleteCc(cc)}
                      editLabel={t('organization.costCenter.editAction')}
                      deleteLabel={t('organization.costCenter.deleteAction')}
                      canEdit={canEditCc}
                      canDelete={canDeleteCc}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {ccMeta ? (
            <Pagination
              currentPage={ccMeta.current_page}
              lastPage={ccMeta.last_page}
              total={ccMeta.total}
              perPage={ccMeta.per_page}
              onPageChange={setCcPage}
            />
          ) : null}
        </>
      )}

      </> )} {/* end list view */}

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      <DepartmentFormDialog open={deptFormOpen} onOpenChange={setDeptFormOpen} dept={editDept} />

      <CompanyFormDialog open={companyFormOpen} onOpenChange={setCompanyFormOpen} company={editCompany} />

      <BranchFormDialog open={branchFormOpen} onOpenChange={setBranchFormOpen} branch={editBranch} />

      <JobPositionFormDialog open={jpFormOpen} onOpenChange={setJpFormOpen} jobPosition={editJp} />

      <JobGradeFormDialog open={jgFormOpen} onOpenChange={setJgFormOpen} jobGrade={editJg} />

      <JobLevelFormDialog open={jlFormOpen} onOpenChange={setJlFormOpen} jobLevel={editJl} />

      <CostCenterFormDialog open={ccFormOpen} onOpenChange={setCcFormOpen} costCenter={editCc} />

      <ConfirmDialog
        open={deleteDept !== undefined}
        onOpenChange={(open) => !open && setDeleteDept(undefined)}
        title={t('organization.department.deleteConfirm.title')}
        description={
          deleteDept
            ? t('organization.department.deleteConfirm.description', { name: deleteDept.name })
            : undefined
        }
        isLoading={deleteDeptMutation.isPending}
        onConfirm={() => void confirmDeleteDept()}
      />

      <ConfirmDialog
        open={deleteCompany !== undefined}
        onOpenChange={(open) => !open && setDeleteCompany(undefined)}
        title={t('organization.company.deleteConfirm.title')}
        description={
          deleteCompany
            ? t('organization.company.deleteConfirm.description', { name: deleteCompany.name })
            : undefined
        }
        isLoading={deleteCompanyMutation.isPending}
        onConfirm={() => void confirmDeleteCompany()}
      />

      <ConfirmDialog
        open={deleteBranch !== undefined}
        onOpenChange={(open) => !open && setDeleteBranch(undefined)}
        title={t('organization.branch.deleteConfirm.title')}
        description={
          deleteBranch
            ? t('organization.branch.deleteConfirm.description', { name: deleteBranch.name })
            : undefined
        }
        isLoading={deleteBranchMutation.isPending}
        onConfirm={() => void confirmDeleteBranch()}
      />

      <ConfirmDialog
        open={deleteJp !== undefined}
        onOpenChange={(open) => !open && setDeleteJp(undefined)}
        title={t('organization.jobPosition.deleteConfirm.title')}
        description={
          deleteJp
            ? t('organization.jobPosition.deleteConfirm.description', { name: deleteJp.title })
            : undefined
        }
        isLoading={deleteJpMutation.isPending}
        onConfirm={() => void confirmDeleteJp()}
      />

      <ConfirmDialog
        open={deleteJg !== undefined}
        onOpenChange={(open) => !open && setDeleteJg(undefined)}
        title={t('organization.jobGrade.deleteConfirm.title')}
        description={
          deleteJg
            ? t('organization.jobGrade.deleteConfirm.description', { name: deleteJg.name })
            : undefined
        }
        isLoading={deleteJgMutation.isPending}
        onConfirm={() => void confirmDeleteJg()}
      />

      <ConfirmDialog
        open={deleteJl !== undefined}
        onOpenChange={(open) => !open && setDeleteJl(undefined)}
        title={t('organization.jobLevel.deleteConfirm.title')}
        description={
          deleteJl
            ? t('organization.jobLevel.deleteConfirm.description', { name: deleteJl.name })
            : undefined
        }
        isLoading={deleteJlMutation.isPending}
        onConfirm={() => void confirmDeleteJl()}
      />

      <ConfirmDialog
        open={deleteCc !== undefined}
        onOpenChange={(open) => !open && setDeleteCc(undefined)}
        title={t('organization.costCenter.deleteConfirm.title')}
        description={
          deleteCc
            ? t('organization.costCenter.deleteConfirm.description', { name: deleteCc.name })
            : undefined
        }
        isLoading={deleteCcMutation.isPending}
        onConfirm={() => void confirmDeleteCc()}
      />
    </div>
  );
}
