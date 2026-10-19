import { array, bool, nullable, num, object, optional, str } from '@/lib/api/decode';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { FetchContext, QueryKey, QueryState } from '@/lib/query';

// ─── Wire types ───────────────────────────────────────────────────────────────

export const userDecoder = object({
  id: num(),
  name: str(),
  email: str(),
  is_active: bool(),
  last_login_at: nullable(str()),
  employee_id: nullable(num()),
  roles: array(str()),
  created_at: optional(str()),
});

export type UserWire = ReturnType<typeof userDecoder.decode>;

const pageMetaDecoder = object({
  current_page: num(),
  per_page: num(),
  total: num(),
  last_page: num(),
});

const userListDecoder = object({
  data: array(userDecoder),
  meta: pageMetaDecoder,
});

export type UserListWire = ReturnType<typeof userListDecoder.decode>;

const userEnvelopeDecoder = object({ data: userDecoder });

// ─── List params ──────────────────────────────────────────────────────────────

export interface UserListParams {
  page?: number;
  perPage?: number;
  search?: string;
  is_active?: boolean;
}

// ─── Cache keys ───────────────────────────────────────────────────────────────

export const userKeys = {
  all: ['users'] as const satisfies QueryKey,
  list: (params: UserListParams) => ['users', 'list', params] as const satisfies QueryKey,
};

function isUserKey(key: readonly unknown[]): boolean {
  return key[0] === 'users';
}

// ─── API client functions ─────────────────────────────────────────────────────

const USERS_BASE = '/users';

export const userApi = {
  async list(context: FetchContext, params: UserListParams): Promise<UserListWire> {
    const { data } = await http(USERS_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        search: params.search,
        is_active: params.is_active === undefined ? undefined : String(params.is_active),
      },
      signal: context.signal,
      schema: userListDecoder,
    });
    if (data === undefined) throw new Error('GET /users returned an empty body');
    return data;
  },

  async create(context: FetchContext, input: UserCreateInput): Promise<UserWire> {
    const { data } = await http(USERS_BASE, {
      method: 'POST',
      body: input,
      signal: context.signal,
      schema: userEnvelopeDecoder,
    });
    if (data === undefined) throw new Error('POST /users returned an empty body');
    return data.data;
  },

  async update(context: FetchContext, id: number, input: UserUpdateInput): Promise<UserWire> {
    const { data } = await http(`${USERS_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal: context.signal,
      schema: userEnvelopeDecoder,
    });
    if (data === undefined) throw new Error(`PATCH /users/${id} returned an empty body`);
    return data.data;
  },

  async remove(context: FetchContext, id: number): Promise<void> {
    await http(`${USERS_BASE}/${id}`, { method: 'DELETE', signal: context.signal, ignoreBody: true });
  },

  async resetPassword(context: FetchContext, id: number, password: string): Promise<void> {
    await http(`${USERS_BASE}/${id}/reset-password`, {
      method: 'POST',
      body: { password, password_confirmation: password },
      signal: context.signal,
      ignoreBody: true,
    });
  },
};

// ─── Input types ──────────────────────────────────────────────────────────────

export interface UserCreateInput {
  name: string;
  email: string;
  password: string;
  role: string;
  employee_id?: number | null;
  is_active?: boolean;
}

export interface UserUpdateInput {
  name?: string;
  email?: string;
  role?: string;
  is_active?: boolean;
}

export interface ResetPasswordInput {
  id: number;
  password: string;
}

// ─── React hooks ──────────────────────────────────────────────────────────────

export interface UserListData {
  state: QueryState<UserListWire>;
  refetch: () => void;
}

export function useUsers(params: UserListParams): UserListData {
  const { state, refetch } = useQuery<UserListWire>({
    queryKey: userKeys.list(params),
    queryFn: (context) => userApi.list(context, params),
    staleTime: 15_000,
  });
  return { state, refetch };
}

export function useCreateUser() {
  const client = useQueryClient();
  return useMutation<UserCreateInput, UserWire>({
    mutationFn: (input, { signal }) => userApi.create({ signal }, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isUserKey });
    },
  });
}

export interface UpdateUserMutationInput extends UserUpdateInput {
  id: number;
}

export function useUpdateUser() {
  const client = useQueryClient();
  return useMutation<UpdateUserMutationInput, UserWire>({
    mutationFn: ({ id, ...input }, { signal }) => userApi.update({ signal }, id, input),
    onSuccess: () => {
      void client.invalidate({ predicate: isUserKey });
    },
  });
}

export function useDeactivateUser() {
  const client = useQueryClient();
  return useMutation<number, void>({
    mutationFn: (id, { signal }) => userApi.remove({ signal }, id),
    onSuccess: () => {
      void client.invalidate({ predicate: isUserKey });
    },
  });
}

export function useResetUserPassword() {
  return useMutation<ResetPasswordInput, void>({
    mutationFn: ({ id, password }, { signal }) => userApi.resetPassword({ signal }, id, password),
  });
}
