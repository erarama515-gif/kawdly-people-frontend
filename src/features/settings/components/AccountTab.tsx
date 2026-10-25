import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { KeyRound } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/form/Field';
import { Input } from '@/components/ui/form/Input';
import { toast } from '@/components/ui/Toast';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import { isApiError, userFacingMessage } from '@/lib/api/errors';

/**
 * Settings → My Account (Sprint A / A1.2).
 *
 * The desktop install has no mail server, so this is the only place a user can
 * rotate their own password. The backend keeps the session that made the
 * change and revokes every other token; the toast says how many were signed
 * out so a user on two machines is not surprised.
 */

const MIN_LENGTH = 12;

const accountFormSchema = z
  .object({
    current_password: z.string().min(1, 'common.requiredField'),
    new_password: z.string().min(MIN_LENGTH, 'settings.account.validation.min'),
    new_password_confirmation: z.string().min(1, 'common.requiredField'),
  })
  .refine((values) => values.new_password === values.new_password_confirmation, {
    path: ['new_password_confirmation'],
    message: 'settings.account.validation.mismatch',
  })
  .refine((values) => values.new_password !== values.current_password, {
    path: ['new_password'],
    message: 'settings.account.validation.sameAsCurrent',
  });

type AccountFormValues = z.infer<typeof accountFormSchema>;

interface ChangePasswordResponse {
  data: { revoked_sessions: number };
}

export function AccountTab() {
  const { t } = useTranslation();

  const resolver = useMemo(() => zodResolver(accountFormSchema), []);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormValues>({
    resolver,
    defaultValues: {
      current_password: '',
      new_password: '',
      new_password_confirmation: '',
    },
  });

  async function onSubmit(values: AccountFormValues) {
    try {
      const response = await http<ChangePasswordResponse>('/auth/change-password', {
        method: 'POST',
        body: values,
      });

      const revoked = response.data?.data?.revoked_sessions ?? 0;
      toast.success(
        revoked > 0
          ? `${t('settings.account.success')} ${t('settings.account.revoked', { count: revoked })}`
          : t('settings.account.success'),
      );
      reset();
    } catch (error) {
      if (isApiError(error) && error.status === 422) {
        const body = error.body as { errors?: Record<string, string[]> } | undefined;
        const fieldMessage = body?.errors?.current_password?.[0];
        if (fieldMessage) {
          setError('current_password', { type: 'server', message: fieldMessage });
          return;
        }
        const newPasswordMessage = body?.errors?.new_password?.[0];
        if (newPasswordMessage) {
          setError('new_password', { type: 'server', message: newPasswordMessage });
          return;
        }
      }
      toast.error(userFacingMessage(error) || t('settings.account.error'));
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <Card className="p-5">
        <div className="mb-4 flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-surface-hover text-navy">
            <KeyRound className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-body font-semibold text-ink">{t('settings.account.title')}</h2>
            <p className="mt-0.5 text-body-sm text-ink-muted">{t('settings.account.subtitle')}</p>
          </div>
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <Field
            label={t('settings.account.currentPassword')}
            htmlFor="current_password"
            required
            error={errors.current_password?.message ? t(errors.current_password.message) : undefined}
          >
            <Input
              id="current_password"
              type="password"
              autoComplete="current-password"
              invalid={!!errors.current_password}
              {...register('current_password')}
            />
          </Field>

          <Field
            label={t('settings.account.newPassword')}
            htmlFor="new_password"
            required
            hint={t('settings.account.hint')}
            error={errors.new_password?.message ? t(errors.new_password.message) : undefined}
          >
            <Input
              id="new_password"
              type="password"
              autoComplete="new-password"
              invalid={!!errors.new_password}
              {...register('new_password')}
            />
          </Field>

          <Field
            label={t('settings.account.confirmPassword')}
            htmlFor="new_password_confirmation"
            required
            error={
              errors.new_password_confirmation?.message
                ? t(errors.new_password_confirmation.message)
                : undefined
            }
          >
            <Input
              id="new_password_confirmation"
              type="password"
              autoComplete="new-password"
              invalid={!!errors.new_password_confirmation}
              {...register('new_password_confirmation')}
            />
          </Field>

          <div className="flex justify-end">
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              {t('settings.account.submit')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
