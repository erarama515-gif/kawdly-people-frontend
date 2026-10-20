import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Plus, Pencil, Trash2, Key } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/form';
import { userFacingMessage } from '@/lib/api/errors';
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeactivateUser,
  useResetUserPassword,
} from '../api/usersQueries';
import type { UserWire } from '../api/usersQueries';
import { useRoles } from '../api/rolesQueries';

// ─── Constants ────────────────────────────────────────────────────────────────

interface RoleOption {
  value: string;
  label: string;
}

/**
 * Static fallback only. The dropdowns are fed from `GET /roles` so custom
 * roles created in the Roles tab show up here too — but that endpoint
 * requires `platform.roles_permissions.view` (or `.manage`), which a user with only
 * `users.manage` may not hold. If the roles query fails (or hasn't resolved yet) we fall back to
 * the system-role vocabulary so the dialog never renders an empty dropdown.
 */
const FALLBACK_ROLE_OPTIONS: RoleOption[] = [
  { value: 'hr_admin', label: 'HR Admin' },
  { value: 'hr_manager', label: 'HR Manager' },
  { value: 'hr_officer', label: 'HR Officer' },
  { value: 'payroll_manager', label: 'Payroll Manager' },
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'department_manager', label: 'Department Manager' },
  { value: 'employee', label: 'Employee' },
  { value: 'finance', label: 'Finance' },
  { value: 'auditor', label: 'Auditor' },
];

/** "hr_admin" → "HR Admin", "payroll_manager" → "Payroll Manager". */
function formatRoleLabel(name: string): string {
  return name
    .split('_')
    .map((token) => (token.length <= 2 ? token.toUpperCase() : token.charAt(0).toUpperCase() + token.slice(1)))
    .join(' ');
}

const LIST_PARAMS = {};

// ─── Zod schemas ──────────────────────────────────────────────────────────────

// Validation messages are i18n keys, resolved at render time via `translate`
// (same pattern as the employees feature's form dialogs).
const addUserSchema = z.object({
  name: z.string().min(1, 'settings.users.validation.nameRequired').max(255),
  email: z.string().min(1, 'settings.users.validation.emailRequired').email('settings.users.validation.emailInvalid'),
  password: z.string().min(8, 'settings.users.validation.passwordMin'),
  role: z.string().min(1, 'settings.users.validation.roleRequired'),
});

type AddUserValues = z.infer<typeof addUserSchema>;

const editUserSchema = z.object({
  name: z.string().min(1, 'settings.users.validation.nameRequired').max(255),
  email: z.string().min(1, 'settings.users.validation.emailRequired').email('settings.users.validation.emailInvalid'),
  role: z.string().min(1, 'settings.users.validation.roleRequired'),
  is_active: z.boolean(),
});

type EditUserValues = z.infer<typeof editUserSchema>;

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'settings.users.validation.passwordMin'),
    confirm: z.string().min(1, 'settings.users.validation.confirmRequired'),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'settings.users.validation.passwordsMismatch',
    path: ['confirm'],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

function translate(t: TFunction, message: string | undefined): string | undefined {
  return message ? t(message) : undefined;
}

// ─── Add User Dialog ──────────────────────────────────────────────────────────

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleOptions: RoleOption[];
}

function AddUserDialog({ open, onOpenChange, roleOptions }: AddUserDialogProps) {
  const { t } = useTranslation();
  const { mutate, isPending, error } = useCreateUser();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddUserValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: { name: '', email: '', password: '', role: '' },
  });

  async function onSubmit(values: AddUserValues) {
    const result = await mutate({
      name: values.name,
      email: values.email,
      password: values.password,
      role: values.role,
      is_active: true,
    });
    if (result !== undefined) {
      reset();
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t('settings.users.addDialog.title')}
        description={t('settings.users.addDialog.description')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost" onClick={() => { reset(); onOpenChange(false); }}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button
              variant="primary"
              form="add-user-form"
              type="submit"
              isLoading={isPending}
            >
              {t('settings.users.addDialog.submit')}
            </Button>
          </>
        }
      >
        <form
          id="add-user-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          {error ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-4 py-2 text-caption text-coral">
              {userFacingMessage(error)}
            </p>
          ) : null}

          <Field label={t('settings.users.fields.name')} htmlFor="add-name" required error={translate(t, errors.name?.message)}>
            <Input id="add-name" invalid={!!errors.name} {...register('name')} />
          </Field>

          <Field label={t('settings.users.fields.email')} htmlFor="add-email" required error={translate(t, errors.email?.message)}>
            <Input id="add-email" type="email" invalid={!!errors.email} {...register('email')} />
          </Field>

          <Field label={t('settings.users.fields.password')} htmlFor="add-password" required error={translate(t, errors.password?.message)}>
            <Input id="add-password" type="password" autoComplete="new-password" invalid={!!errors.password} {...register('password')} />
          </Field>

          <Field label={t('settings.users.fields.role')} htmlFor="add-role" required error={translate(t, errors.role?.message)}>
            <Select id="add-role" invalid={!!errors.role} {...register('role')}>
              <option value="">{t('settings.users.selectRole')}</option>
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit User Dialog ─────────────────────────────────────────────────────────

interface EditUserDialogProps {
  user: UserWire | null;
  onOpenChange: (open: boolean) => void;
  roleOptions: RoleOption[];
}

function EditUserDialog({ user, onOpenChange, roleOptions }: EditUserDialogProps) {
  const { t } = useTranslation();
  const { mutate, isPending, error } = useUpdateUser();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditUserValues>({
    resolver: zodResolver(editUserSchema),
    ...(user
      ? {
          values: {
            name: user.name,
            email: user.email,
            role: user.roles[0] ?? '',
            is_active: user.is_active,
          },
        }
      : {}),
  });

  async function onSubmit(values: EditUserValues) {
    if (!user) return;
    const result = await mutate({
      id: user.id,
      name: values.name,
      email: values.email,
      role: values.role,
      is_active: values.is_active,
    });
    if (result !== undefined) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent
        title={t('settings.users.editDialog.title')}
        description={t('settings.users.editDialog.description')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button
              variant="primary"
              form="edit-user-form"
              type="submit"
              isLoading={isPending}
            >
              {t('settings.users.editDialog.submit')}
            </Button>
          </>
        }
      >
        <form
          id="edit-user-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          {error ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-4 py-2 text-caption text-coral">
              {userFacingMessage(error)}
            </p>
          ) : null}

          <Field label={t('settings.users.fields.name')} htmlFor="edit-name" required error={translate(t, errors.name?.message)}>
            <Input id="edit-name" invalid={!!errors.name} {...register('name')} />
          </Field>

          <Field label={t('settings.users.fields.email')} htmlFor="edit-email" required error={translate(t, errors.email?.message)}>
            <Input id="edit-email" type="email" invalid={!!errors.email} {...register('email')} />
          </Field>

          <Field label={t('settings.users.fields.role')} htmlFor="edit-role" required error={translate(t, errors.role?.message)}>
            <Select id="edit-role" invalid={!!errors.role} {...register('role')}>
              <option value="">{t('settings.users.selectRole')}</option>
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
          </Field>

          <Field label={t('settings.users.fields.status')} htmlFor="edit-is-active" error={translate(t, errors.is_active?.message)}>
            <Select id="edit-is-active" {...register('is_active', { setValueAs: (v) => v === 'true' })}>
              <option value="true">{t('settings.users.active')}</option>
              <option value="false">{t('settings.users.inactive')}</option>
            </Select>
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reset Password Dialog ────────────────────────────────────────────────────

interface ResetPasswordDialogProps {
  user: UserWire | null;
  onOpenChange: (open: boolean) => void;
}

function ResetPasswordDialog({ user, onOpenChange }: ResetPasswordDialogProps) {
  const { t } = useTranslation();
  const { mutate, isPending, error, reset: resetMutation } = useResetUserPassword();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirm: '' },
  });

  async function onSubmit(values: ResetPasswordValues) {
    if (!user) return;
    const result = await mutate({ id: user.id, password: values.password });
    if (result !== undefined || !error) {
      reset();
      resetMutation();
      onOpenChange(false);
    }
  }

  function handleClose() {
    reset();
    resetMutation();
    onOpenChange(false);
  }

  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent
        title={t('settings.users.resetDialog.title')}
        description={user ? t('settings.users.resetDialog.description', { name: user.name }) : undefined}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost" onClick={handleClose}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button
              variant="danger"
              form="reset-pw-form"
              type="submit"
              isLoading={isPending}
            >
              {t('settings.users.resetDialog.submit')}
            </Button>
          </>
        }
      >
        <form
          id="reset-pw-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          {error ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-4 py-2 text-caption text-coral">
              {userFacingMessage(error)}
            </p>
          ) : null}

          <Field label={t('settings.users.fields.newPassword')} htmlFor="rp-password" required error={translate(t, errors.password?.message)}>
            <Input id="rp-password" type="password" autoComplete="new-password" invalid={!!errors.password} {...register('password')} />
          </Field>

          <Field label={t('settings.users.fields.confirmPassword')} htmlFor="rp-confirm" required error={translate(t, errors.confirm?.message)}>
            <Input id="rp-confirm" type="password" autoComplete="new-password" invalid={!!errors.confirm} {...register('confirm')} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Confirm Deactivate Dialog ────────────────────────────────────────────────

interface ConfirmDeactivateProps {
  user: UserWire | null;
  onOpenChange: (open: boolean) => void;
}

function ConfirmDeactivateDialog({ user, onOpenChange }: ConfirmDeactivateProps) {
  const { t } = useTranslation();
  const { mutate, isPending, error } = useDeactivateUser();

  async function handleConfirm() {
    if (!user) return;
    const result = await mutate(user.id);
    if (result !== undefined || !error) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent
        title={t('settings.users.deactivateDialog.title')}
        description={user ? t('settings.users.deactivateDialog.description', { name: user.name }) : undefined}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button variant="danger" isLoading={isPending} onClick={handleConfirm}>
              {t('settings.users.deactivateDialog.submit')}
            </Button>
          </>
        }
      >
        {error ? (
          <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-4 py-2 text-caption text-coral">
            {userFacingMessage(error)}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={
        active
          ? 'rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700'
          : 'rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-red-50 text-red-700'
      }
    >
      {active ? t('settings.users.active') : t('settings.users.inactive')}
    </span>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function UsersSkeleton() {
  return (
    <div className="flex flex-col gap-0" aria-busy="true" aria-label="Loading users…">
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} className="flex items-center gap-4 border-b border-divider px-5 py-3.5">
          <div className="h-4 w-40 animate-pulse rounded bg-divider" />
          <div className="h-4 w-48 animate-pulse rounded bg-divider" />
          <div className="h-4 w-24 animate-pulse rounded bg-divider" />
          <div className="h-4 w-16 animate-pulse rounded bg-divider" />
          <div className="h-4 w-28 animate-pulse rounded bg-divider" />
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UsersTab() {
  const { t } = useTranslation();
  const { state, refetch } = useUsers(LIST_PARAMS);
  const { state: rolesState } = useRoles();
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserWire | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<UserWire | null>(null);
  const [resetPwUser, setResetPwUser] = useState<UserWire | null>(null);

  const users = state.data?.data ?? [];

  // Live roles (system + custom) from the Roles API; static fallback if the
  // session can't read /roles (requires platform.roles_permissions.view) or while it loads.
  const liveRoles = rolesState.status === 'success' ? rolesState.data : undefined;
  const roleOptions = useMemo<RoleOption[]>(
    () =>
      liveRoles && liveRoles.length > 0
        ? liveRoles.map((role) => ({ value: role.name, label: formatRoleLabel(role.name) }))
        : FALLBACK_ROLE_OPTIONS,
    [liveRoles],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-ink">{t('settings.users.title')}</h2>
          <p className="mt-0.5 text-body-sm text-ink-muted">
            {t('settings.users.subtitle')}
          </p>
        </div>
        <Button variant="primary" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          {t('settings.users.addUser')}
        </Button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_1fr_140px_100px_160px_130px] gap-4 border-b border-divider bg-surface px-5 py-2.5">
          {(['name', 'email', 'role', 'status', 'lastLogin', 'actions'] as const).map((col) => (
            <span key={col} className="text-caption font-semibold text-ink-muted">
              {t(`settings.users.columns.${col}`)}
            </span>
          ))}
        </div>

        {/* Loading */}
        {state.status === 'pending' && <UsersSkeleton />}

        {/* Error */}
        {state.status === 'error' && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-body-sm text-coral">{userFacingMessage(state.error)}</p>
            <Button variant="ghost" onClick={refetch}>
              {t('common.retry')}
            </Button>
          </div>
        )}

        {/* Empty */}
        {state.status === 'success' && users.length === 0 && (
          <div className="py-12 text-center text-body-sm text-ink-muted">
            {t('settings.users.empty')}
          </div>
        )}

        {/* Rows */}
        {state.status === 'success' &&
          users.map((user, idx) => (
            <div
              key={user.id}
              className={`grid grid-cols-[1fr_1fr_140px_100px_160px_130px] items-center gap-4 px-5 py-3.5 ${idx < users.length - 1 ? 'border-b border-divider' : ''}`}
            >
              <span className="truncate text-body-sm font-medium text-ink">{user.name}</span>
              <span className="truncate text-body-sm text-ink-muted">{user.email}</span>
              <span className="text-body-sm text-ink-muted capitalize">
                {user.roles[0]?.replace(/_/g, ' ') ?? '—'}
              </span>
              <StatusBadge active={user.is_active} />
              <span className="text-body-sm text-ink-faint">
                {user.last_login_at
                  ? new Date(user.last_login_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '—'}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  className="h-7 w-7 px-0 text-ink-faint hover:text-ink"
                  aria-label={`${t('settings.users.actions.edit')}: ${user.name}`}
                  onClick={() => setEditUser(user)}
                  title={t('settings.users.actions.edit')}
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  className="h-7 w-7 px-0 text-ink-faint hover:text-navy"
                  aria-label={`${t('settings.users.actions.resetPassword')}: ${user.name}`}
                  onClick={() => setResetPwUser(user)}
                  title={t('settings.users.actions.resetPassword')}
                >
                  <Key className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  className="h-7 w-7 px-0 text-ink-faint hover:text-coral"
                  aria-label={`${t('settings.users.actions.deactivate')}: ${user.name}`}
                  onClick={() => setDeactivateUser(user)}
                  title={t('settings.users.actions.deactivate')}
                  disabled={!user.is_active}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
      </Card>

      {/* Pagination hint */}
      {state.status === 'success' && state.data && state.data.meta.total > state.data.meta.per_page && (
        <p className="text-caption text-ink-faint">
          {t('settings.users.showing', { count: users.length, total: state.data.meta.total })}
        </p>
      )}

      {/* Dialogs */}
      <AddUserDialog open={addOpen} onOpenChange={setAddOpen} roleOptions={roleOptions} />
      <EditUserDialog user={editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }} roleOptions={roleOptions} />
      <ResetPasswordDialog user={resetPwUser} onOpenChange={(open) => { if (!open) setResetPwUser(null); }} />
      <ConfirmDeactivateDialog user={deactivateUser} onOpenChange={(open) => { if (!open) setDeactivateUser(null); }} />
    </div>
  );
}
