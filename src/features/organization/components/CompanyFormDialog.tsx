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
import { useCreateCompany, useUpdateCompany } from '../api/queries';
import type { CompanyInput } from '../api/resource';
import type { CompanyWire } from '../api/schema';

/**
 * Add/Edit modal for one Company record.
 *
 * Confirmed fields from StoreCompanyRequest.php:
 *   name (required), name_ar, legal_name, registration_number, tax_number,
 *   logo (plain text URL/path), email, phone, website, address (textarea),
 *   city, country_code (required, size:2), currency_code (required, size:3),
 *   timezone, fiscal_year_start (int 1-12), is_active (boolean).
 *
 * Omitted (not simple scalars): work_week (array), settings (array).
 * Footer Save is wired via form="company-form" attribute.
 */

const REQUIRED = 'common.requiredField';

const companyFormSchema = z.object({
  name: z.string().min(1, REQUIRED).max(255),
  name_ar: z.string().max(255),
  legal_name: z.string().max(255),
  registration_number: z.string().max(100),
  tax_number: z.string().max(100),
  logo: z.string().max(500),
  email: z.string().max(255),
  phone: z.string().max(50),
  website: z.string().max(255),
  address: z.string(),
  city: z.string().max(100),
  country_code: z.string().min(1, REQUIRED).max(2),
  currency_code: z.string().min(1, REQUIRED).max(3),
  timezone: z.string().max(50),
  fiscal_year_start: z.string(),
  is_active: z.string(),
});

type CompanyFormValues = z.infer<typeof companyFormSchema>;

function buildDefaultValues(company: CompanyWire | undefined): CompanyFormValues {
  if (!company) {
    return {
      name: '',
      name_ar: '',
      legal_name: '',
      registration_number: '',
      tax_number: '',
      logo: '',
      email: '',
      phone: '',
      website: '',
      address: '',
      city: '',
      country_code: '',
      currency_code: '',
      timezone: '',
      fiscal_year_start: '',
      is_active: 'true',
    };
  }
  return {
    name: company.name,
    name_ar: company.name_ar ?? '',
    legal_name: company.legal_name ?? '',
    registration_number: company.registration_number ?? '',
    tax_number: company.tax_number ?? '',
    logo: company.logo ?? '',
    email: company.email ?? '',
    phone: company.phone ?? '',
    website: company.website ?? '',
    address: company.address ?? '',
    city: company.city ?? '',
    country_code: company.country_code,
    currency_code: company.currency_code,
    timezone: company.timezone ?? '',
    fiscal_year_start: company.fiscal_year_start !== undefined ? String(company.fiscal_year_start) : '',
    is_active: company.is_active === false ? 'false' : 'true',
  };
}

function toCompanyInput(values: CompanyFormValues): CompanyInput {
  return {
    name: values.name.trim(),
    name_ar: values.name_ar.trim() || null,
    legal_name: values.legal_name.trim() || null,
    registration_number: values.registration_number.trim() || null,
    tax_number: values.tax_number.trim() || null,
    logo: values.logo.trim() || null,
    email: values.email.trim() || null,
    phone: values.phone.trim() || null,
    website: values.website.trim() || null,
    address: values.address.trim() || null,
    city: values.city.trim() || null,
    country_code: values.country_code.trim().toUpperCase(),
    currency_code: values.currency_code.trim().toUpperCase(),
    timezone: values.timezone.trim() || null,
    fiscal_year_start: values.fiscal_year_start ? Number(values.fiscal_year_start) : null,
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

export interface CompanyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: CompanyWire | undefined;
}

export function CompanyFormDialog({ open, onOpenChange, company }: CompanyFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = company !== undefined;

  const createMutation = useCreateCompany();
  const updateMutation = useUpdateCompany();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  const resolver = useMemo(() => zodResolver(companyFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CompanyFormValues>({
    resolver,
    defaultValues: buildDefaultValues(company),
  });

  useEffect(() => {
    if (open) reset(buildDefaultValues(company));
  }, [open, company, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: CompanyFormValues) {
    const input = toCompanyInput(values);
    const result = isEdit
      ? await updateMutation.mutate({ id: company.id, ...input })
      : await createMutation.mutate(input);

    if (result) {
      handleOpenChange(false);
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof CompanyFormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('organization.company.editTitle') : t('organization.company.addTitle')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="company-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="company-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutationError ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          {/* Name */}
          <Field
            label={t('organization.company.form.name')}
            htmlFor="company_name"
            required
            error={translate(t, errors.name?.message)}
          >
            <Input id="company_name" invalid={!!errors.name} {...register('name')} />
          </Field>

          {/* Name (Arabic) */}
          <Field
            label={t('organization.company.form.nameAr')}
            htmlFor="company_name_ar"
            error={translate(t, errors.name_ar?.message)}
          >
            <Input id="company_name_ar" dir="rtl" invalid={!!errors.name_ar} {...register('name_ar')} />
          </Field>

          {/* Legal Name */}
          <Field
            label={t('organization.company.form.legalName')}
            htmlFor="company_legal_name"
            error={translate(t, errors.legal_name?.message)}
          >
            <Input id="company_legal_name" invalid={!!errors.legal_name} {...register('legal_name')} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            {/* Registration Number */}
            <Field
              label={t('organization.company.form.registrationNumber')}
              htmlFor="company_registration_number"
              error={translate(t, errors.registration_number?.message)}
            >
              <Input id="company_registration_number" maxLength={100} invalid={!!errors.registration_number} {...register('registration_number')} />
            </Field>

            {/* Tax Number */}
            <Field
              label={t('organization.company.form.taxNumber')}
              htmlFor="company_tax_number"
              error={translate(t, errors.tax_number?.message)}
            >
              <Input id="company_tax_number" maxLength={100} invalid={!!errors.tax_number} {...register('tax_number')} />
            </Field>
          </div>

          {/* Logo URL */}
          <Field
            label={t('organization.company.form.logo')}
            htmlFor="company_logo"
            error={translate(t, errors.logo?.message)}
          >
            <Input id="company_logo" type="url" invalid={!!errors.logo} {...register('logo')} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            {/* Email */}
            <Field
              label={t('organization.company.form.email')}
              htmlFor="company_email"
              error={translate(t, errors.email?.message)}
            >
              <Input id="company_email" type="email" maxLength={255} invalid={!!errors.email} {...register('email')} />
            </Field>

            {/* Phone */}
            <Field
              label={t('organization.company.form.phone')}
              htmlFor="company_phone"
              error={translate(t, errors.phone?.message)}
            >
              <Input id="company_phone" maxLength={50} invalid={!!errors.phone} {...register('phone')} />
            </Field>
          </div>

          {/* Website */}
          <Field
            label={t('organization.company.form.website')}
            htmlFor="company_website"
            error={translate(t, errors.website?.message)}
          >
            <Input id="company_website" type="url" maxLength={255} invalid={!!errors.website} {...register('website')} />
          </Field>

          {/* Address */}
          <Field
            label={t('organization.company.form.address')}
            htmlFor="company_address"
            error={translate(t, errors.address?.message)}
          >
            <textarea
              id="company_address"
              rows={3}
              className="w-full rounded border border-hairline bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-navy/40"
              {...register('address')}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            {/* City */}
            <Field
              label={t('organization.company.form.city')}
              htmlFor="company_city"
              error={translate(t, errors.city?.message)}
            >
              <Input id="company_city" maxLength={100} invalid={!!errors.city} {...register('city')} />
            </Field>

            {/* Country Code */}
            <Field
              label={t('organization.company.form.countryCode')}
              htmlFor="company_country_code"
              required
              error={translate(t, errors.country_code?.message)}
            >
              <Input id="company_country_code" maxLength={2} placeholder="EG" invalid={!!errors.country_code} {...register('country_code')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Currency Code */}
            <Field
              label={t('organization.company.form.currencyCode')}
              htmlFor="company_currency_code"
              required
              error={translate(t, errors.currency_code?.message)}
            >
              <Input id="company_currency_code" maxLength={3} placeholder="EGP" invalid={!!errors.currency_code} {...register('currency_code')} />
            </Field>

            {/* Fiscal Year Start */}
            <Field
              label={t('organization.company.form.fiscalYearStart')}
              htmlFor="company_fiscal_year_start"
              error={translate(t, errors.fiscal_year_start?.message)}
            >
              <Input id="company_fiscal_year_start" type="number" min={1} max={12} invalid={!!errors.fiscal_year_start} {...register('fiscal_year_start')} />
            </Field>
          </div>

          {/* Timezone */}
          <Field
            label={t('organization.company.form.timezone')}
            htmlFor="company_timezone"
            error={translate(t, errors.timezone?.message)}
          >
            <Input id="company_timezone" maxLength={50} placeholder="Africa/Cairo" invalid={!!errors.timezone} {...register('timezone')} />
          </Field>

          {/* Active status */}
          <Field
            label={t('organization.company.form.isActive')}
            htmlFor="company_is_active"
            error={translate(t, errors.is_active?.message)}
          >
            <Select id="company_is_active" invalid={!!errors.is_active} {...register('is_active')}>
              <option value="true">{t('organization.company.form.activeOption')}</option>
              <option value="false">{t('organization.company.form.inactiveOption')}</option>
            </Select>
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
