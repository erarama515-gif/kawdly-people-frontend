import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { settingApi } from './client';
import { settingKeys } from './resource';
import type { SettingListParams, SettingUpdateInput } from './resource';
import type { SettingListWire, SettingWire } from './schema';

/**
 * The Settings module's data hooks.
 *
 * `useSettingList` — fetches all settings (or a filtered subset) as a flat list.
 * `useUpdateSetting` — PATCHes a single setting's value with optimistic update
 *   and rollback on failure. The optimistic write patches the specific row in
 *   the cached list immediately so the UI never shows a stale value while the
 *   request is in flight; on error the previous cache snapshot is restored and
 *   the list is refetched.
 */

// ─── List ─────────────────────────────────────────────────────────────────────

export interface SettingListData {
  state: QueryState<SettingListWire>;
  refetch: () => void;
}

export function useSettingList(params: SettingListParams): SettingListData {
  const { state, refetch } = useQuery<SettingListWire>({
    queryKey: settingKeys.list(params),
    queryFn: (context) => settingApi.list(context, params),
    staleTime: 30_000,
  });

  return { state, refetch };
}

function isSettingKey(key: readonly unknown[]): boolean {
  return key[0] === 'settings';
}

// ─── Update (inline edit) ─────────────────────────────────────────────────────

export interface UpdateSettingInput extends SettingUpdateInput {
  /** The setting row's numeric id — required to locate the backend record. */
  id: number;
  /**
   * The list params this mutation should optimistically update.
   * The component passes the same params object it used for `useSettingList`.
   */
  listParams: SettingListParams;
}

/**
 * Optimistic PATCH. The flow mirrors `useDeleteDepartment` / `useDeleteBranch`
 * from `organization/api/queries.ts`, adapted for an in-place value swap:
 *
 *   1. `onMutate` — immediately patch the matching row in the cache, capture
 *      the previous snapshot, and return a rollback closure.
 *   2. On success — invalidate so the server value is eventually confirmed.
 *   3. On error  — the rollback closure restores the snapshot, then the
 *      invalidation triggers a fresh fetch.
 */
export function useUpdateSetting() {
  const client = useQueryClient();

  return useMutation<UpdateSettingInput, SettingWire>({
    mutationFn: ({ id, listParams: _listParams, ...input }, { signal }) =>
      settingApi.update({ signal }, id, input),

    onMutate: ({ id, listParams, value }) => {
      const key = settingKeys.list(listParams);

      const previous = client.setData<SettingListWire>(key, (current) =>
        current
          ? {
              ...current,
              data: current.data.map((row) =>
                row.id === id
                  ? { ...row, ...(value !== undefined ? { value: value ?? null } : {}) }
                  : row,
              ),
            }
          : current,
      );

      return () => {
        if (previous) client.setData(key, () => previous.data);
        void client.invalidate({ predicate: isSettingKey });
      };
    },

    onSuccess: (_data, { listParams: _listParams }) => {
      void client.invalidate({ predicate: isSettingKey });
    },
  });
}
