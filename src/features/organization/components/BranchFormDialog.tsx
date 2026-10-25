import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/form';
import { userFacingMessage } from '@/lib/api/errors';
import type { ApiError } from '@/lib/api/errors';
import { toast } from '@/components/ui/Toast';
import { useCreateBranch, useUpdateBranch } from '../api/queries';
import type { BranchInput } from '../api/resource';
import type { BranchWire } from '../api/schema';

/**
 * Add/Edit modal for one Branch record.
 *
 * Confirmed fields from StoreBranchRequest.php:
 *   company_id (required FK), name (required), code, address (textarea),
 *   city, country_code (size:2), latitude, longitude, geofence_radius,
 *   phone, is_headquarters (boolean), is_active (boolean).
 *
 * Footer Save is wired via form="branch-form" attribute.
 */

const REQUIRED = 'common.requiredField';

const branchFormSchema = z.object({
  name: z.string().min(1, REQUIRED).max(255),
  code: z.string().max(20),
  address: z.string(),
  city: z.string().max(100),
  country_code: z.string().max(2),
  latitude: z.string(),
  longitude: z.string(),
  geofence_radius: z.string(),
  phone: z.string().max(50),
  is_headquarters: z.string(),
  is_active: z.string(),
});

type BranchFormValues = z.infer<typeof branchFormSchema>;

function buildDefaultValues(branch: BranchWire | undefined): BranchFormValues {
  if (!branch) {
    return {
      name: '',
      code: '',
      address: '',
      city: '',
      country_code: '',
      latitude: '',
      longitude: '',
      geofence_radius: '',
      phone: '',
      is_headquarters: 'false',
      is_active: 'true',
    };
  }
  return {
    name: branch.name,
    code: branch.code ?? '',
    address: branch.address ?? '',
    city: branch.city ?? '',
    country_code: branch.country_code ?? '',
    latitude: branch.latitude !== undefined ? String(branch.latitude) : '',
    longitude: branch.longitude !== undefined ? String(branch.longitude) : '',
    geofence_radius: branch.geofence_radius !== undefined ? String(branch.geofence_radius) : '',
    phone: branch.phone ?? '',
    is_headquarters: branch.is_headquarters === true ? 'true' : 'false',
    is_active: branch.is_active === false ? 'false' : 'true',
  };
}

function toBranchInput(values: BranchFormValues): BranchInput {
  return {
    name: values.name.trim(),
    code: values.code.trim() || null,
    address: values.address.trim() || null,
    city: values.city.trim() || null,
    country_code: values.country_code.trim().toUpperCase() || null,
    latitude: values.latitude ? Number(values.latitude) : null,
    longitude: values.longitude ? Number(values.longitude) : null,
    geofence_radius: values.geofence_radius ? Number(values.geofence_radius) : null,
    phone: values.phone.trim() || null,
    is_headquarters: values.is_headquarters === 'true',
    is_active: values.is_active === 'false' ? false : true,
  };
}

function fieldErrorsFrom(error: ApiError | undefined): Record<string, string> {
  if (!error || error.status !== 422) return {};
  const body = error.body as { errors?: Record<string, string[]> } | undefined;
  if (!body?.errors) return {};
  const result: Record<string, string> = {};
  for (const [field, messages] of Object.entries(body.errors)) {
    if (messages[0]) result[field] = messages[0];
  }
  return result;
}

function translate(t: TFunction, message: string | undefined): string | undefined {
  return message ? t(message) : undefined;
}

export interface BranchFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch?: BranchWire | undefined;
}

export function BranchFormDialog({ open, onOpenChange, branch }: BranchFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = branch !== undefined;

  const createMutation = useCreateBranch();
  const updateMutation = useUpdateBranch();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  const resolver = useMemo(() => zodResolver(branchFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<BranchFormValues>({
    resolver,
    defaultValues: buildDefaultValues(branch),
  });

  useEffect(() => {
    if (open) reset(buildDefaultValues(branch));
  }, [open, branch, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: BranchFormValues) {
    const input = toBranchInput(values);
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: branch.id, ...input });
      } else {
        await createMutation.mutateAsync(input);
      }
    } catch (error) {
      const failure = error as ApiError;
      toast.error(userFacingMessage(failure));
      const fieldErrors = fieldErrorsFrom(failure);
      for (const [field, message] of Object.entries(fieldErrors)) {
        setError(field as keyof BranchFormValues, { type: 'server', message });
      }
      return;
    }

    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('organization.branch.editTitle') : t('organization.branch.addTitle')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="branch-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="branch-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutationError ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          {/* Name */}
          <Field
            label={t('organization.branch.form.name')}
            htmlFor="branch_name"
            required
            error={translate(t, errors.name?.message)}
          >
            <Input id="branch_name" invalid={!!errors.name} {...register('name')} />
          </Field>

          {/* Code */}
          <Field
            label={t('organization.branch.form.code')}
            htmlFor="branch_code"
            error={translate(t, errors.code?.message)}
          >
            <Input id="branch_code" maxLength={20} invalid={!!errors.code} {...register('code')} />
          </Field>

          {/* Address */}
          <Field
            label={t('organization.branch.form.address')}
            htmlFor="branch_address"
            error={translate(t, errors.address?.message)}
          >
            <textarea
              id="branch_address"
              rows={2}
              className="w-full rounded border border-hairline bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-navy/40"
              {...register('address')}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            {/* City */}
            <Field
              label={t('organization.branch.form.city')}
              htmlFor="branch_city"
              error={translate(t, errors.city?.message)}
            >
              <Input id="branch_city" maxLength={100} invalid={!!errors.city} {...register('city')} />
            </Field>

            {/* Country Code */}
            <Field
              label={t('organization.branch.form.countryCode')}
              htmlFor="branch_country_code"
              error={translate(t, errors.country_code?.message)}
            >
              <Input id="branch_country_code" maxLength={2} placeholder="EG" invalid={!!errors.country_code} {...register('country_code')} />
            </Field>
          </div>

          {/* Phone */}
          <Field
            label={t('organization.branch.form.phone')}
            htmlFor="branch_phone"
            error={translate(t, errors.phone?.message)}
          >
            <Input id="branch_phone" maxLength={50} invalid={!!errors.phone} {...register('phone')} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            {/* Latitude */}
            <Field
              label={t('organization.branch.form.latitude')}
              htmlFor="branch_latitude"
              error={translate(t, errors.latitude?.message)}
            >
              <Input id="branch_latitude" type="number" step="any" min="-90" max="90" invalid={!!errors.latitude} {...register('latitude')} />
            </Field>

            {/* Longitude */}
            <Field
              label={t('organization.branch.form.longitude')}
              htmlFor="branch_longitude"
              error={translate(t, errors.longitude?.message)}
            >
              <Input id="branch_longitude" type="number" step="any" min="-180" max="180" invalid={!!errors.longitude} {...register('longitude')} />
            </Field>
          </div>

          {/* Geofence Radius */}
          <Field
            label={t('organization.branch.form.geofenceRadius')}
            htmlFor="branch_geofence_radius"
            error={translate(t, errors.geofence_radius?.message)}
          >
            <Input id="branch_geofence_radius" type="number" min="0" invalid={!!errors.geofence_radius} {...register('geofence_radius')} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            {/* Is Headquarters */}
            <Field
              label={t('organization.branch.form.isHeadquarters')}
              htmlFor="branch_is_headquarters"
              error={translate(t, errors.is_headquarters?.message)}
            >
              <Select id="branch_is_headquarters" invalid={!!errors.is_headquarters} {...register('is_headquarters')}>
                <option value="false">{t('common.no')}</option>
                <option value="true">{t('common.yes')}</option>
              </Select>
            </Field>

            {/* Active status */}
            <Field
              label={t('organization.branch.form.isActive')}
              htmlFor="branch_is_active"
              error={translate(t, errors.is_active?.message)}
            >
              <Select id="branch_is_active" invalid={!!errors.is_active} {...register('is_active')}>
                <option value="true">{t('organization.branch.form.activeOption')}</option>
                <option value="false">{t('organization.branch.form.inactiveOption')}</option>
              </Select>
            </Field>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
