import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Plus, Pencil, Trash2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input } from '@/components/ui/form';
import { userFacingMessage } from '@/lib/api/errors';
import {
  useRoles,
  useRole,
  usePermissionsCatalog,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
} from '../api/rolesQueries';
import type { RoleWire, PermissionsCatalogWire } from '../api/rolesQueries';

/**
 * Roles & Permissions tab, mirroring `UsersTab.tsx`'s structure (self-contained
 * API module, no mock layer). Permission and module names render as the
 * backend's own slugs (e.g. `employees`, `view_own`) in both languages — they
 * are technical identifiers defined in `PermissionRegistry`, not UI copy.
 */

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const addRoleSchema = z.object({
  name: z.string().min(1, 'settings.roles.validation.nameRequired').max(125),
});

type AddRoleValues = z.infer<typeof addRoleSchema>;

const editRoleSchema = z.object({
  name: z.string().min(1, 'settings.roles.validation.nameRequired').max(125),
});

type EditRoleValues = z.infer<typeof editRoleSchema>;

function translate(t: TFunction, message: string | undefined): string | undefined {
  return message ? t(message) : undefined;
}

// ─── Permission checklist ─────────────────────────────────────────────────────

function permissionLabel(name: string, module: string): string {
  const action = name.startsWith(`${module}.`) ? name.slice(module.length + 1) : name;
  return action.replace(/_/g, ' ');
}

function moduleTitle(module: string): string {
  return module.charAt(0).toUpperCase() + module.slice(1);
}

interface PermissionChecklistProps {
  catalog: PermissionsCatalogWire;
  selected: Set<string>;
  onToggle: (name: string) => void;
  disabled?: boolean;
}

function PermissionChecklist({ catalog, selected, onToggle, disabled }: PermissionChecklistProps) {
  const modules = Object.entries(catalog.data);

  return (
    <div className="flex max-h-80 flex-col gap-4 overflow-y-auto rounded-[3px] border border-divider p-3">
      {modules.map(([module, entries]) => (
        <div key={module} className="flex flex-col gap-1.5">
          <p className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
            {moduleTitle(module)}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {entries.map((entry) => (
              <label key={entry.name} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(entry.name)}
                  onChange={() => onToggle(entry.name)}
                  disabled={disabled}
                  className="h-4 w-4 rounded border-divider accent-navy disabled:opacity-60"
                />
                <span className="text-body-sm capitalize text-ink">
                  {permissionLabel(entry.name, module)}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function usePermissionSelection(initial: string[]) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial));

  function reset(next: string[]) {
    setSelected(new Set(next));
  }

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return { selected, toggle, reset };
}

// ─── Add Role Dialog ──────────────────────────────────────────────────────────

interface AddRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: PermissionsCatalogWire | undefined;
}

function AddRoleDialog({ open, onOpenChange, catalog }: AddRoleDialogProps) {
  const { t } = useTranslation();
  const { mutate, isPending, error, reset: resetMutation } = useCreateRole();
  const { selected, toggle, reset: resetSelection } = usePermissionSelection([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddRoleValues>({ resolver: zodResolver(addRoleSchema), defaultValues: { name: '' } });

  useEffect(() => {
    if (open) {
      reset({ name: '' });
      resetSelection([]);
      resetMutation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: AddRoleValues) {
    const result = await mutate({ name: values.name, permissions: Array.from(selected) });
    if (result !== undefined) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t('settings.roles.addDialog.title')}
        description={t('settings.roles.addDialog.description')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button variant="primary" form="add-role-form" type="submit" isLoading={isPending}>
              {t('settings.roles.addDialog.submit')}
            </Button>
          </>
        }
      >
        <form id="add-role-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          {error ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-4 py-2 text-caption text-coral">
              {userFacingMessage(error)}
            </p>
          ) : null}

          <Field label={t('settings.roles.fields.name')} htmlFor="add-role-name" required error={translate(t, errors.name?.message)}>
            <Input id="add-role-name" invalid={!!errors.name} {...register('name')} />
          </Field>

          <Field label={t('settings.roles.fields.permissions')} htmlFor="add-role-permissions">
            {catalog ? (
              <PermissionChecklist catalog={catalog} selected={selected} onToggle={toggle} />
            ) : (
              <p className="text-body-sm text-ink-muted">{t('settings.roles.loadingPermissions')}</p>
            )}
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Role Dialog ─────────────────────────────────────────────────────────

interface EditRoleDialogProps {
  role: RoleWire | null;
  onOpenChange: (open: boolean) => void;
  catalog: PermissionsCatalogWire | undefined;
}

function EditRoleDialog({ role, onOpenChange, catalog }: EditRoleDialogProps) {
  const { t } = useTranslation();
  const { state: detailState } = useRole(role?.id ?? null);
  const { mutate, isPending, error, reset: resetMutation } = useUpdateRole();
  const { selected, toggle, reset: resetSelection } = usePermissionSelection([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditRoleValues>({ resolver: zodResolver(editRoleSchema), defaultValues: { name: '' } });

  useEffect(() => {
    if (role) {
      reset({ name: role.name });
      resetMutation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    if (detailState.status === 'success') {
      const flat = Object.values(detailState.data?.permissions_by_module ?? {}).flat();
      resetSelection(flat);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailState.status === 'success' ? detailState.data : undefined]);

  async function onSubmit(values: EditRoleValues) {
    if (!role) return;
    const result = await mutate({
      id: role.id,
      permissions: Array.from(selected),
      ...(role.is_system ? {} : { name: values.name }),
    });
    if (result !== undefined) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={role !== null} onOpenChange={onOpenChange}>
      <DialogContent
        title={t('settings.roles.editDialog.title')}
        description={
          role?.is_system
            ? t('settings.roles.editDialog.descriptionSystem')
            : t('settings.roles.editDialog.description')
        }
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button variant="primary" form="edit-role-form" type="submit" isLoading={isPending}>
              {t('settings.roles.editDialog.submit')}
            </Button>
          </>
        }
      >
        <form id="edit-role-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          {error ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-4 py-2 text-caption text-coral">
              {userFacingMessage(error)}
            </p>
          ) : null}

          <Field label={t('settings.roles.fields.name')} htmlFor="edit-role-name" required error={translate(t, errors.name?.message)}>
            <Input id="edit-role-name" invalid={!!errors.name} disabled={role?.is_system} {...register('name')} />
          </Field>

          <Field label={t('settings.roles.fields.permissions')} htmlFor="edit-role-permissions">
            {catalog && detailState.status === 'success' ? (
              <PermissionChecklist catalog={catalog} selected={selected} onToggle={toggle} />
            ) : (
              <p className="text-body-sm text-ink-muted">{t('settings.roles.loadingPermissions')}</p>
            )}
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Status / type badges ─────────────────────────────────────────────────────

function TypeBadge({ isSystem }: { isSystem: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={
        isSystem
          ? 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-navy/10 text-navy'
          : 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700'
      }
    >
      {isSystem ? <Lock className="h-2.5 w-2.5" strokeWidth={2} aria-hidden="true" /> : null}
      {isSystem ? t('settings.roles.system') : t('settings.roles.custom')}
    </span>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function RolesSkeleton() {
  return (
    <div className="flex flex-col gap-0" aria-busy="true" aria-label="Loading roles…">
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} className="flex items-center gap-4 border-b border-divider px-5 py-3.5">
          <div className="h-4 w-40 animate-pulse rounded bg-divider" />
          <div className="h-4 w-24 animate-pulse rounded bg-divider" />
          <div className="h-4 w-20 animate-pulse rounded bg-divider" />
          <div className="h-4 w-16 animate-pulse rounded bg-divider" />
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RolesTab() {
  const { t } = useTranslation();
  const { state, refetch } = useRoles();
  const { state: catalogState } = usePermissionsCatalog();
  const [addOpen, setAddOpen] = useState(false);
  const [editRole, setEditRole] = useState<RoleWire | null>(null);
  const [deleteRole, setDeleteRole] = useState<RoleWire | null>(null);

  const { mutate: removeRole, isPending: isDeleting, error: deleteError } = useDeleteRole();

  const roles = state.data ?? [];
  const catalog = useMemo(
    () => (catalogState.status === 'success' ? catalogState.data : undefined),
    [catalogState.status === 'success' ? catalogState.data : undefined],
  );

  async function handleConfirmDelete() {
    if (!deleteRole) return;
    const result = await removeRole(deleteRole.id);
    if (result !== undefined) {
      setDeleteRole(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-ink">{t('settings.roles.title')}</h2>
          <p className="mt-0.5 text-body-sm text-ink-muted">
            {t('settings.roles.subtitle')}
          </p>
        </div>
        <Button variant="primary" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          {t('settings.roles.addRole')}
        </Button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_120px_110px_130px] gap-4 border-b border-divider bg-surface px-5 py-2.5">
          {(['name', 'type', 'permissions', 'users', 'actions'] as const).map((col) => (
            <span key={col} className="text-caption font-semibold text-ink-muted">
              {t(`settings.roles.columns.${col}`)}
            </span>
          ))}
        </div>

        {state.status === 'pending' && <RolesSkeleton />}

        {state.status === 'error' && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-body-sm text-coral">{userFacingMessage(state.error)}</p>
            <Button variant="ghost" onClick={refetch}>
              {t('common.retry')}
            </Button>
          </div>
        )}

        {state.status === 'success' && roles.length === 0 && (
          <div className="py-12 text-center text-body-sm text-ink-muted">
            {t('settings.roles.empty')}
          </div>
        )}

        {state.status === 'success' &&
          roles.map((role, idx) => (
            <div
              key={role.id}
              className={`grid grid-cols-[1fr_120px_120px_110px_130px] items-center gap-4 px-5 py-3.5 ${idx < roles.length - 1 ? 'border-b border-divider' : ''}`}
            >
              <span className="truncate text-body-sm font-medium text-ink capitalize">
                {role.name.replace(/_/g, ' ')}
              </span>
              <TypeBadge isSystem={role.is_system} />
              <span className="text-body-sm text-ink-muted">{role.permissions_count}</span>
              <span className="text-body-sm text-ink-muted">{role.users_count ?? '—'}</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  className="h-7 w-7 px-0 text-ink-faint hover:text-ink"
                  aria-label={`${t('settings.roles.actions.edit')}: ${role.name}`}
                  onClick={() => setEditRole(role)}
                  title={t('settings.roles.actions.edit')}
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  className="h-7 w-7 px-0 text-ink-faint hover:text-coral"
                  aria-label={`${t('settings.roles.actions.delete')}: ${role.name}`}
                  onClick={() => setDeleteRole(role)}
                  title={role.is_system ? t('settings.roles.actions.deleteProtected') : t('settings.roles.actions.delete')}
                  disabled={role.is_system}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
      </Card>

      {/* Dialogs */}
      <AddRoleDialog open={addOpen} onOpenChange={setAddOpen} catalog={catalog} />
      <EditRoleDialog role={editRole} onOpenChange={(open) => { if (!open) setEditRole(null); }} catalog={catalog} />
      <ConfirmDialog
        open={deleteRole !== null}
        onOpenChange={(open) => { if (!open) setDeleteRole(null); }}
        title={t('settings.roles.deleteDialog.title')}
        description={
          deleteRole
            ? `${t('settings.roles.deleteDialog.description', { name: deleteRole.name.replace(/_/g, ' ') })}${deleteError ? ` ${userFacingMessage(deleteError)}` : ''}`
            : undefined
        }
        confirmLabel={t('settings.roles.deleteDialog.submit')}
        confirmVariant="danger"
        isLoading={isDeleting}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
