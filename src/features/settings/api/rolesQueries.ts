import { array, bool, nullable, num, object, optional, record, str } from '@/lib/api/decode';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { FetchContext, QueryKey, QueryState } from '@/lib/query';

/**
 * Self-contained Roles & Permissions API module, mirroring `usersQueries.ts`:
 * one file, no mock layer (always hits the real backend regardless of
 * `env.useMockApi`), decoders + cache keys + hooks together.
 *
 * Backend: `RoleController` (routes/api/roles.php). All role CRUD requires
 * `roles.manage`; `GET /permissions` requires `roles.manage` OR
 * `settings.view`. System roles (`is_system: true`) reject name changes and
 * deletion with a 422 — the UI disables those actions rather than letting
 * the request round-trip to fail.
 */

// ─── Wire types ───────────────────────────────────────────────────────────────

export const roleDecoder = object({
  id: num(),
  name: str(),
  company_id: nullable(num()),
  is_system: bool(),
  permissions_count: num(),
  users_count: nullable(num()),
  created_at: optional(str()),
});

export type RoleWire = ReturnType<typeof roleDecoder.decode>;

const roleListDecoder = object({ data: array(roleDecoder) });

const roleDetailDecoder = object({
  id: num(),
  name: str(),
  company_id: nullable(num()),
  is_system: bool(),
  permissions_count: num(),
  users_count: nullable(num()),
  created_at: optional(str()),
  permissions_by_module: record(array(str())),
});

export type RoleDetailWire = ReturnType<typeof roleDetailDecoder.decode>;

const roleDetailEnvelopeDecoder = object({ data: roleDetailDecoder });
const roleEnvelopeDecoder = object({ data: roleDecoder });

const permissionEntryDecoder = object({ name: str(), in_db: bool() });

export type PermissionEntryWire = ReturnType<typeof permissionEntryDecoder.decode>;

const permissionsCatalogDecoder = object({ data: record(array(permissionEntryDecoder)) });

export type PermissionsCatalogWire = ReturnType<typeof permissionsCatalogDecoder.decode>;

// ─── Cache keys ───────────────────────────────────────────────────────────────

export const roleKeys = {
  all: ['roles'] as const satisfies QueryKey,
  list: () => ['roles', 'list'] as const satisfies QueryKey,
  detail: (id: number) => ['roles', 'detail', id] as const satisfies QueryKey,
  permissions: ['roles', 'permissions'] as const satisfies QueryKey,
};

function isRoleKey(key: readonly unknown[]): boolean {
  return key[0] === 'roles';
}

// ─── API client functions ─────────────────────────────────────────────────────

const ROLES_BASE = '/roles';

export const roleApi = {
  async list(context: FetchContext): Promise<RoleWire[]> {
    const { data } = await http(ROLES_BASE, { signal: context.signal, schema: roleListDecoder });
    if (data === undefined) throw new Error('GET /roles returned an empty body');
    return data.data;
  },

  async show(context: FetchContext, id: number): Promise<RoleDetailWire> {
    const { data } = await http(`${ROLES_BASE}/${id}`, { signal: context.signal, schema: roleDetailEnvelopeDecoder });
    if (data === undefined) throw new Error(`GET /roles/${id} returned an empty body`);
    return data.data;
  },

  async create(context: FetchContext, input: RoleCreateInput): Promise<RoleWire> {
    const { data } = await http(ROLES_BASE, {
      method: 'POST',
      body: input,
      signal: context.signal,
      schema: roleEnvelopeDecoder,
    });
    if (data === undefined) throw new Error('POST /roles returned an empty body');
    return data.data;
  },

  async update(context: FetchContext, id: number, input: RoleUpdateInput): Promise<RoleWire> {
    const { data } = await http(`${ROLES_BASE}/${id}`, {
      method: 'PUT',
      body: input,
      signal: context.signal,
      schema: roleEnvelopeDecoder,
    });
    if (data === undefined) throw new Error(`PUT /roles/${id} returned an empty body`);
    return data.data;
  },

  async remove(context: FetchContext, id: number): Promise<void> {
    await http(`${ROLES_BASE}/${id}`, { method: 'DELETE', signal: context.signal, ignoreBody: true });
  },

  async permissions(context: FetchContext): Promise<PermissionsCatalogWire> {
    const { data } = await http('/permissions', { signal: context.signal, schema: permissionsCatalogDecoder });
    if (data === undefined) throw new Error('GET /permissions returned an empty body');
    return data;
  },
};

// ─── Input types ──────────────────────────────────────────────────────────────

export interface RoleCreateInput {
  name: string;
  permissions?: string[];
}

export interface RoleUpdateInput {
  name?: string;
  permissions?: string[];
}

// ─── React hooks ──────────────────────────────────────────────────────────────

export interface RoleListData {
  state: QueryState<RoleWire[]>;
  refetch: () => void;
}

export function useRoles(): RoleListData {
  const { state, refetch } = useQuery<RoleWire[]>({
    queryKey: roleKeys.list(),
    queryFn: (context) => roleApi.list(context),
    staleTime: 15_000,
  });
  return { state, refetch };
}

export interface RoleDetailData {
  state: QueryState<RoleDetailWire>;
  refetch: () => void;
}

export function useRole(id: number | null): RoleDetailData {
  const { state, refetch } = useQuery<RoleDetailWire>({
    queryKey: roleKeys.detail(id ?? -1),
    queryFn: (context) => roleApi.show(context, id as number),
    enabled: id !== null,
    staleTime: 15_000,
  });
  return { state, refetch };
}

export interface PermissionsCatalogData {
  state: QueryState<PermissionsCatalogWire>;
  refetch: () => void;
}

export function usePermissionsCatalog(): PermissionsCatalogData {
  const { state, refetch } = useQuery<PermissionsCatalogWire>({
    queryKey: roleKeys.permissions,
    queryFn: (context) => roleApi.permissions(context),
    staleTime: 60_000,
  });
  return { state, refetch };
}

export function useCreateRole() {
  const client = useQueryClient();
  return useMutation<RoleCreateInput, RoleWire>({
    mutationFn: (input, { signal }) => roleApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isRoleKey });
    },
  });
}

export interface UpdateRoleMutationInput extends RoleUpdateInput {
  id: number;
}

export function useUpdateRole() {
  const client = useQueryClient();
  return useMutation<UpdateRoleMutationInput, RoleWire>({
    mutationFn: ({ id, ...input }, { signal }) => roleApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isRoleKey });
    },
  });
}

export function useDeleteRole() {
  const client = useQueryClient();
  return useMutation<number, void>({
    mutationFn: (id, { signal }) => roleApi.remove({ signal }, id),
    onSuccess: () => {
      void client.invalidate({ predicate: isRoleKey });
    },
  });
}
