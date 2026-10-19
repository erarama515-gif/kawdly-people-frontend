import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { departmentApi, companyApi, branchApi, jobPositionApi, jobGradeApi, jobLevelApi, costCenterApi } from './client';
import { departmentKeys, companyKeys, branchKeys, jobPositionKeys, jobGradeKeys, jobLevelKeys, costCenterKeys } from './resource';
import type {
  DepartmentInput,
  DepartmentListParams,
  DepartmentUpdateInput,
  CompanyInput,
  CompanyListParams,
  CompanyUpdateInput,
  BranchInput,
  BranchListParams,
  BranchUpdateInput,
  JobPositionInput,
  JobPositionListParams,
  JobPositionUpdateInput,
  JobGradeInput,
  JobGradeListParams,
  JobGradeUpdateInput,
  JobLevelInput,
  JobLevelListParams,
  JobLevelUpdateInput,
  CostCenterInput,
  CostCenterListParams,
  CostCenterUpdateInput,
} from './resource';
import type {
  DepartmentListWire,
  DepartmentWire,
  CompanyListWire,
  CompanyWire,
  BranchListWire,
  BranchWire,
  JobPositionListWire,
  JobPositionWire,
  JobGradeListWire,
  JobGradeWire,
  JobLevelListWire,
  JobLevelWire,
  CostCenterListWire,
  CostCenterWire,
} from './schema';

/**
 * The Organization module's data hooks — the only place components talk to the
 * API. Mirrors the Employees feature's `queries.ts` pattern exactly.
 *
 * Department, Company, Branch, JobPosition, JobGrade, JobLevel, CostCenter:
 * all have full CRUD hooks.
 */

// ─── Department ───────────────────────────────────────────────────────────────

export interface DepartmentListData {
  state: QueryState<DepartmentListWire>;
  refetch: () => void;
}

export function useDepartmentList(params: DepartmentListParams): DepartmentListData {
  const { state, refetch } = useQuery<DepartmentListWire>({
    queryKey: departmentKeys.list(params),
    queryFn: (context) => departmentApi.list(context, params),
    staleTime: 15_000,
  });

  return { state, refetch };
}

/** True for any cached key under this module, list or single-item alike. */
function isDepartmentKey(key: readonly unknown[]): boolean {
  return key[0] === 'departments';
}

/** Creates a department, then invalidates every cached list. */
export function useCreateDepartment() {
  const client = useQueryClient();

  return useMutation<DepartmentInput, DepartmentWire>({
    mutationFn: (input, { signal }) => departmentApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isDepartmentKey });
    },
  });
}

export interface UpdateDepartmentInput extends DepartmentUpdateInput {
  id: number;
}

/** Updates a department, then invalidates every cached list. */
export function useUpdateDepartment() {
  const client = useQueryClient();

  return useMutation<UpdateDepartmentInput, DepartmentWire>({
    mutationFn: ({ id, ...input }, { signal }) => departmentApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isDepartmentKey });
    },
  });
}

/**
 * Deletes one department. Optimistic: the row disappears immediately; a failure
 * restores the previous snapshot and refetches.
 */
export function useDeleteDepartment(params: DepartmentListParams) {
  const client = useQueryClient();
  const key = departmentKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => departmentApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<DepartmentListWire>(key, (current) =>
        current
          ? {
              ...current,
              data: current.data.filter((dept) => dept.id !== id),
              meta: { ...current.meta, total: Math.max(0, current.meta.total - 1) },
            }
          : current,
      );
      return () => {
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate({ predicate: isDepartmentKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isDepartmentKey });
    },
  });
}

// ─── Company ─────────────────────────────────────────────────────────────────

export interface CompanyListData {
  state: QueryState<CompanyListWire>;
  refetch: () => void;
}

export function useCompanyList(params: CompanyListParams): CompanyListData {
  const { state, refetch } = useQuery<CompanyListWire>({
    queryKey: companyKeys.list(params),
    queryFn: (context) => companyApi.list(context, params),
    staleTime: 15_000,
  });

  return { state, refetch };
}

function isCompanyKey(key: readonly unknown[]): boolean {
  return key[0] === 'companies';
}

export function useCreateCompany() {
  const client = useQueryClient();

  return useMutation<CompanyInput, CompanyWire>({
    mutationFn: (input, { signal }) => companyApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isCompanyKey });
    },
  });
}

export interface UpdateCompanyInput extends CompanyUpdateInput {
  id: number;
}

export function useUpdateCompany() {
  const client = useQueryClient();

  return useMutation<UpdateCompanyInput, CompanyWire>({
    mutationFn: ({ id, ...input }, { signal }) => companyApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isCompanyKey });
    },
  });
}

export function useDeleteCompany(params: CompanyListParams) {
  const client = useQueryClient();
  const key = companyKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => companyApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<CompanyListWire>(key, (current) =>
        current
          ? {
              ...current,
              data: current.data.filter((company) => company.id !== id),
              meta: { ...current.meta, total: Math.max(0, current.meta.total - 1) },
            }
          : current,
      );
      return () => {
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate({ predicate: isCompanyKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isCompanyKey });
    },
  });
}

// ─── Branch ──────────────────────────────────────────────────────────────────

export interface BranchListData {
  state: QueryState<BranchListWire>;
  refetch: () => void;
}

export function useBranchList(params: BranchListParams): BranchListData {
  const { state, refetch } = useQuery<BranchListWire>({
    queryKey: branchKeys.list(params),
    queryFn: (context) => branchApi.list(context, params),
    staleTime: 15_000,
  });

  return { state, refetch };
}

function isBranchKey(key: readonly unknown[]): boolean {
  return key[0] === 'branches';
}

export function useCreateBranch() {
  const client = useQueryClient();

  return useMutation<BranchInput, BranchWire>({
    mutationFn: (input, { signal }) => branchApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isBranchKey });
    },
  });
}

export interface UpdateBranchInput extends BranchUpdateInput {
  id: number;
}

export function useUpdateBranch() {
  const client = useQueryClient();

  return useMutation<UpdateBranchInput, BranchWire>({
    mutationFn: ({ id, ...input }, { signal }) => branchApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isBranchKey });
    },
  });
}

export function useDeleteBranch(params: BranchListParams) {
  const client = useQueryClient();
  const key = branchKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => branchApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<BranchListWire>(key, (current) =>
        current
          ? {
              ...current,
              data: current.data.filter((branch) => branch.id !== id),
              meta: { ...current.meta, total: Math.max(0, current.meta.total - 1) },
            }
          : current,
      );
      return () => {
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate({ predicate: isBranchKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isBranchKey });
    },
  });
}

// ─── JobPosition ──────────────────────────────────────────────────────────────

export interface JobPositionListData {
  state: QueryState<JobPositionListWire>;
  refetch: () => void;
}

export function useJobPositionList(params: JobPositionListParams): JobPositionListData {
  const { state, refetch } = useQuery<JobPositionListWire>({
    queryKey: jobPositionKeys.list(params),
    queryFn: (context) => jobPositionApi.list(context, params),
    staleTime: 15_000,
  });

  return { state, refetch };
}

function isJobPositionKey(key: readonly unknown[]): boolean {
  return key[0] === 'job-positions';
}

export function useCreateJobPosition() {
  const client = useQueryClient();

  return useMutation<JobPositionInput, JobPositionWire>({
    mutationFn: (input, { signal }) => jobPositionApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isJobPositionKey });
    },
  });
}

export interface UpdateJobPositionInput extends JobPositionUpdateInput {
  id: number;
}

export function useUpdateJobPosition() {
  const client = useQueryClient();

  return useMutation<UpdateJobPositionInput, JobPositionWire>({
    mutationFn: ({ id, ...input }, { signal }) => jobPositionApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isJobPositionKey });
    },
  });
}

export function useDeleteJobPosition(params: JobPositionListParams) {
  const client = useQueryClient();
  const key = jobPositionKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => jobPositionApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<JobPositionListWire>(key, (current) =>
        current
          ? {
              ...current,
              data: current.data.filter((jp) => jp.id !== id),
              meta: { ...current.meta, total: Math.max(0, current.meta.total - 1) },
            }
          : current,
      );
      return () => {
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate({ predicate: isJobPositionKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isJobPositionKey });
    },
  });
}

// ─── JobGrade ─────────────────────────────────────────────────────────────────

export interface JobGradeListData {
  state: QueryState<JobGradeListWire>;
  refetch: () => void;
}

export function useJobGradeList(params: JobGradeListParams): JobGradeListData {
  const { state, refetch } = useQuery<JobGradeListWire>({
    queryKey: jobGradeKeys.list(params),
    queryFn: (context) => jobGradeApi.list(context, params),
    staleTime: 15_000,
  });

  return { state, refetch };
}

function isJobGradeKey(key: readonly unknown[]): boolean {
  return key[0] === 'job-grades';
}

export function useCreateJobGrade() {
  const client = useQueryClient();

  return useMutation<JobGradeInput, JobGradeWire>({
    mutationFn: (input, { signal }) => jobGradeApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isJobGradeKey });
    },
  });
}

export interface UpdateJobGradeInput extends JobGradeUpdateInput {
  id: number;
}

export function useUpdateJobGrade() {
  const client = useQueryClient();

  return useMutation<UpdateJobGradeInput, JobGradeWire>({
    mutationFn: ({ id, ...input }, { signal }) => jobGradeApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isJobGradeKey });
    },
  });
}

export function useDeleteJobGrade(params: JobGradeListParams) {
  const client = useQueryClient();
  const key = jobGradeKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => jobGradeApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<JobGradeListWire>(key, (current) =>
        current
          ? {
              ...current,
              data: current.data.filter((grade) => grade.id !== id),
              meta: { ...current.meta, total: Math.max(0, current.meta.total - 1) },
            }
          : current,
      );
      return () => {
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate({ predicate: isJobGradeKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isJobGradeKey });
    },
  });
}

// ─── JobLevel ─────────────────────────────────────────────────────────────────

export interface JobLevelListData {
  state: QueryState<JobLevelListWire>;
  refetch: () => void;
}

export function useJobLevelList(params: JobLevelListParams): JobLevelListData {
  const { state, refetch } = useQuery<JobLevelListWire>({
    queryKey: jobLevelKeys.list(params),
    queryFn: (context) => jobLevelApi.list(context, params),
    staleTime: 15_000,
  });

  return { state, refetch };
}

function isJobLevelKey(key: readonly unknown[]): boolean {
  return key[0] === 'job-levels';
}

export function useCreateJobLevel() {
  const client = useQueryClient();

  return useMutation<JobLevelInput, JobLevelWire>({
    mutationFn: (input, { signal }) => jobLevelApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isJobLevelKey });
    },
  });
}

export interface UpdateJobLevelInput extends JobLevelUpdateInput {
  id: number;
}

export function useUpdateJobLevel() {
  const client = useQueryClient();

  return useMutation<UpdateJobLevelInput, JobLevelWire>({
    mutationFn: ({ id, ...input }, { signal }) => jobLevelApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isJobLevelKey });
    },
  });
}

export function useDeleteJobLevel(params: JobLevelListParams) {
  const client = useQueryClient();
  const key = jobLevelKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => jobLevelApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<JobLevelListWire>(key, (current) =>
        current
          ? {
              ...current,
              data: current.data.filter((level) => level.id !== id),
              meta: { ...current.meta, total: Math.max(0, current.meta.total - 1) },
            }
          : current,
      );
      return () => {
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate({ predicate: isJobLevelKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isJobLevelKey });
    },
  });
}

// ─── CostCenter ───────────────────────────────────────────────────────────────

export interface CostCenterListData {
  state: QueryState<CostCenterListWire>;
  refetch: () => void;
}

export function useCostCenterList(params: CostCenterListParams): CostCenterListData {
  const { state, refetch } = useQuery<CostCenterListWire>({
    queryKey: costCenterKeys.list(params),
    queryFn: (context) => costCenterApi.list(context, params),
    staleTime: 15_000,
  });

  return { state, refetch };
}

function isCostCenterKey(key: readonly unknown[]): boolean {
  return key[0] === 'cost-centers';
}

export function useCreateCostCenter() {
  const client = useQueryClient();

  return useMutation<CostCenterInput, CostCenterWire>({
    mutationFn: (input, { signal }) => costCenterApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isCostCenterKey });
    },
  });
}

export interface UpdateCostCenterInput extends CostCenterUpdateInput {
  id: number;
}

export function useUpdateCostCenter() {
  const client = useQueryClient();

  return useMutation<UpdateCostCenterInput, CostCenterWire>({
    mutationFn: ({ id, ...input }, { signal }) => costCenterApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isCostCenterKey });
    },
  });
}

export function useDeleteCostCenter(params: CostCenterListParams) {
  const client = useQueryClient();
  const key = costCenterKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => costCenterApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<CostCenterListWire>(key, (current) =>
        current
          ? {
              ...current,
              data: current.data.filter((costCenter) => costCenter.id !== id),
              meta: { ...current.meta, total: Math.max(0, current.meta.total - 1) },
            }
          : current,
      );
      return () => {
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate({ predicate: isCostCenterKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isCostCenterKey });
    },
  });
}
