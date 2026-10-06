import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { leaveRequestApi } from './client';
import { leaveRequestKeys } from './resource';
import type { LeaveRequestInput, LeaveRequestListParams, LeaveRequestUpdateInput } from './resource';
import type { LeaveRequestListWire, LeaveRequestWire, LeaveTypeWire } from './schema';

/**
 * The Leave module's data hooks — the only place components talk to the API.
 * Mirrors the Employees feature's `queries.ts`: each hook owns its cache key
 * and mutation strategy, and every mutation reconciles the cache itself so
 * `LeavePage` never writes to the query store by hand.
 */

export interface LeaveRequestListData {
  state: QueryState<LeaveRequestListWire>;
  refetch: () => void;
}

export function useLeaveRequestList(params: LeaveRequestListParams): LeaveRequestListData {
  const { state, refetch } = useQuery<LeaveRequestListWire>({
    queryKey: leaveRequestKeys.list(params),
    queryFn: (context) => leaveRequestApi.list(context, params),
    staleTime: 15_000,
  });

  return { state, refetch };
}

/** True for any cached key under this module. */
function isLeaveRequestKey(key: readonly unknown[]): boolean {
  return key[0] === 'leaveRequests';
}

/** Creates a leave request, then invalidates every cached list so the new row shows up wherever it belongs. */
export function useCreateLeaveRequest() {
  const client = useQueryClient();

  return useMutation<LeaveRequestInput, LeaveRequestWire>({
    mutationFn: (input, { signal }) => leaveRequestApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isLeaveRequestKey });
    },
  });
}

export interface UpdateLeaveRequestInput extends LeaveRequestUpdateInput {
  id: number;
}

/** Updates a leave request, then invalidates every cached list. */
export function useUpdateLeaveRequest() {
  const client = useQueryClient();

  return useMutation<UpdateLeaveRequestInput, LeaveRequestWire>({
    mutationFn: ({ id, ...input }, { signal }) => leaveRequestApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isLeaveRequestKey });
    },
  });
}

/**
 * Deletes one leave request. Optimistic: the row disappears from the current
 * list immediately so the table feels instant; a failure restores the previous
 * snapshot and refetches, so the ledger can never drift from the server.
 */
export function useDeleteLeaveRequest(params: LeaveRequestListParams) {
  const client = useQueryClient();
  const key = leaveRequestKeys.list(params);

  return useMutation<number, void>({
    mutationFn: (id, { signal }) => leaveRequestApi.remove({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<LeaveRequestListWire>(key, (current) =>
        current
          ? {
              ...current,
              data: current.data.filter((req) => req.id !== id),
              meta: { ...current.meta, total: Math.max(0, current.meta.total - 1) },
            }
          : current,
      );
      return () => {
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate({ predicate: isLeaveRequestKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isLeaveRequestKey });
    },
  });
}

/**
 * Approves one leave request. Optimistic: the row's status flips to `approved`
 * immediately; a failure rolls back and refetches.
 */
export function useApproveLeaveRequest(params: LeaveRequestListParams) {
  const client = useQueryClient();
  const key = leaveRequestKeys.list(params);

  return useMutation<number, LeaveRequestWire>({
    mutationFn: (id, { signal }) => leaveRequestApi.approve({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<LeaveRequestListWire>(key, (current) =>
        current
          ? {
              ...current,
              data: current.data.map((req) =>
                req.id === id ? { ...req, status: 'approved' as const } : req,
              ),
            }
          : current,
      );
      return () => {
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate({ predicate: isLeaveRequestKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isLeaveRequestKey });
    },
  });
}

/**
 * Rejects one leave request. Optimistic: the row's status flips to `rejected`
 * immediately; a failure rolls back and refetches.
 */
export function useRejectLeaveRequest(params: LeaveRequestListParams) {
  const client = useQueryClient();
  const key = leaveRequestKeys.list(params);

  return useMutation<number, LeaveRequestWire>({
    mutationFn: (id, { signal }) => leaveRequestApi.reject({ signal }, id),

    onMutate: (id) => {
      const previous = client.setData<LeaveRequestListWire>(key, (current) =>
        current
          ? {
              ...current,
              data: current.data.map((req) =>
                req.id === id ? { ...req, status: 'rejected' as const } : req,
              ),
            }
          : current,
      );
      return () => {
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate({ predicate: isLeaveRequestKey });
      };
    },

    onSuccess: () => {
      void client.invalidate({ predicate: isLeaveRequestKey });
    },
  });
}

/** Read-only hook for populating leave-type dropdowns. */
export interface LeaveTypeListData {
  state: QueryState<LeaveTypeWire[]>;
}

export function useLeaveTypeList(): LeaveTypeListData {
  const { state } = useQuery<LeaveTypeWire[]>({
    queryKey: leaveRequestKeys.leaveTypes,
    queryFn: (context) => leaveRequestApi.listLeaveTypes(context),
    staleTime: 300_000, // leave types rarely change
  });

  return { state };
}
