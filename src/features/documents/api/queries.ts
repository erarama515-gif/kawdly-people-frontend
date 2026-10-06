import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { employeeDocumentApi } from './client';
import { employeeDocumentKeys } from './resource';
import type {
  EmployeeDocumentInput,
  EmployeeDocumentListParams,
  EmployeeDocumentUpdateInput,
} from './resource';
import type {
  EmployeeDocumentListWire,
  EmployeeDocumentWire,
  DocumentTypeWire,
} from './schema';

/**
 * The Documents module's data hooks — the only place components talk to the
 * API. Mirrors the Attendance feature's `queries.ts`: each hook owns its cache
 * key and mutation strategy, and every mutation reconciles the cache itself
 * so `DocumentsPage` never writes to the query store by hand.
 */

export interface EmployeeDocumentListData {
  state: QueryState<EmployeeDocumentListWire>;
  refetch: () => void;
}

export function useEmployeeDocumentList(params: EmployeeDocumentListParams): EmployeeDocumentListData {
  const { state, refetch } = useQuery<EmployeeDocumentListWire>({
    queryKey: employeeDocumentKeys.list(params),
    queryFn: (context) => employeeDocumentApi.list(context, params),
    staleTime: 15_000,
  });

  return { state, refetch };
}

/** True for any cached key under this module. */
function isEmployeeDocumentKey(key: readonly unknown[]): boolean {
  return key[0] === 'employeeDocuments';
}

/** Creates an employee document, then invalidates every cached list. */
export function useCreateEmployeeDocument() {
  const client = useQueryClient();

  return useMutation<EmployeeDocumentInput, EmployeeDocumentWire>({
    mutationFn: (input, { signal }) => employeeDocumentApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isEmployeeDocumentKey });
    },
  });
}

export interface UpdateEmployeeDocumentInput extends EmployeeDocumentUpdateInput {
  id: number;
}

/** Updates an employee document, then invalidates every cached list. */
export function useUpdateEmployeeDocument() {
  const client = useQueryClient();

  return useMutation<UpdateEmployeeDocumentInput, EmployeeDocumentWire>({
    mutationFn: ({ id, ...input }, { signal }) =>
      employeeDocumentApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isEmployeeDocumentKey });
    },
  });
}

/**
 * Deletes one employee document. Optimistic: the row disappears from the
 * current list immediately so the table feels instant; a failure restores the
 * previous snapshot and refetches, so the ledger can never drift from the server.
 */
export function useDeleteEmployeeDocument(params: EmployeeDocumentListParams) {
  const client = useQueryClient();
  const key = employeeDocumentKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => employeeDocumentApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<EmployeeDocumentListWire>(key, (current) =>
        current
          ? {
              ...current,
              data: current.data.filter((doc) => doc.id !== id),
              meta: { ...current.meta, total: Math.max(0, current.meta.total - 1) },
            }
          : current,
      );
      return () => {
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate({ predicate: isEmployeeDocumentKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isEmployeeDocumentKey });
    },
  });
}

/** Read-only hook for populating document-type dropdowns and resolving IDs to names. */
export interface DocumentTypeListData {
  state: QueryState<DocumentTypeWire[]>;
}

export function useDocumentTypeList(): DocumentTypeListData {
  const { state } = useQuery<DocumentTypeWire[]>({
    queryKey: employeeDocumentKeys.documentTypes,
    queryFn: (context) => employeeDocumentApi.listDocumentTypes(context),
    staleTime: 300_000, // document types rarely change
  });

  return { state };
}

/** Read-only hook for the Templates stat card (reads meta.total only). */
export interface TemplateCountData {
  state: QueryState<number>;
}

export function useDocumentTemplateCount(): TemplateCountData {
  const { state } = useQuery<number>({
    queryKey: employeeDocumentKeys.templateCount,
    queryFn: (context) => employeeDocumentApi.countDocumentTemplates(context),
    staleTime: 300_000,
  });

  return { state };
}
