import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { departmentApi, companyApi, branchApi, jobPositionApi } from './client';
import { departmentKeys, companyKeys, branchKeys, jobPositionKeys } from './resource';
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
} from './schema';

/**
 * The Organization module's data hooks — the only place components talk to the
 * API. Mirrors the Employees feature's `queries.ts` pattern exactly.
 *
 * Department, Company, Branch, JobPosition: all have full CRUD hooks.
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
