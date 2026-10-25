import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { Location } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { isApiError, userFacingMessage } from '@/lib/api/errors';
import { useSessionStore } from '@/auth/session';
import { OrgChartBg } from './OrgChartBg';

/**
 * Kawdly Login v12 — Arabic-first sign-in page.
 *
 * - Pale grey (#f4f5f7) background with decorative SVG org-chart network.
 * - Sharp-cornered white card (2px radius) with shadow.
 * - "Kawdly People" text logo (no icon).
 * - Password visibility toggle.
 * - "Forgot password?" link.
 * - RTL layout on the --font-sans system stack (T3.5: no webfont at runtime).
 */

const REQUIRED = 'common.requiredField';

const loginFormSchema = z.object({
  email: z.string().min(1, REQUIRED).email('common.invalidEmail'),
  password: z.string().min(1, REQUIRED),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

interface LocationState {
  from?: Location;
}

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isRtl = i18n.language === 'ar';
  const status = useSessionStore((state) => state.status);
  const login = useSessionStore((state) => state.login);
  const [banner, setBanner] = useState<string | undefined>(undefined);
  const [showPassword, setShowPassword] = useState(false);

  const resolver = useMemo(() => zodResolver(loginFormSchema), []);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver, defaultValues: { email: '', password: '' } });

  // Already signed in — redirect back.
  if (status === 'authenticated') {
    const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? '/';
    return <Navigate to={redirectTo} replace />;
  }

  async function onSubmit(values: LoginFormValues) {
    setBanner(undefined);
    try {
      await login(values);
      const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? '/';
      navigate(redirectTo, { replace: true });
    } catch (error) {
      if (isApiError(error)) {
        if (error.status === 429) {
          setBanner(t('auth.login.tooManyAttempts'));
          return;
        }
        if (error.status === 422) {
          const body = error.body as { errors?: Record<string, string[]> } | undefined;
          const message = body?.errors?.email?.[0];
          if (message) {
            setError('email', { type: 'server', message });
            return;
          }
        }
      }
      setBanner(userFacingMessage(error));
    }
  }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={isRtl ? 'ar' : 'en'}
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-14"
      style={{ background: '#f4f5f7', fontFamily: 'var(--font-sans)' }}
    >
      {/* Decorative org-chart network */}
      <OrgChartBg />

      {/* Sign-in card */}
      <div className="relative z-10 w-full max-w-[400px]">
        {/* Language switcher + "You are here" label */}
        <div className="mb-3 flex items-center justify-between gap-2 text-xs font-medium leading-none" style={{ color: '#0f4a73' }}>
          <button
            type="button"
            onClick={() => void i18n.changeLanguage(isRtl ? 'en' : 'ar')}
            className="rounded-[2px] px-1.5 py-1 hover:underline"
            style={{ color: '#0f4a73', background: 'transparent', border: 0, cursor: 'pointer' }}
          >
            {t(isRtl ? 'common.switchToEnglish' : 'common.switchToArabic')}
          </button>
          <span className="flex items-center gap-2">
            <span className="block h-[7px] w-[7px]" style={{ background: '#0f4a73' }} />
            {t('auth.login.youAreHere')}
          </span>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col"
          style={{
            background: '#fff',
            border: '1px solid #dfe3e8',
            borderRadius: 2,
            boxShadow: '0 1px 2px rgba(15,31,53,.04), 0 12px 28px -14px rgba(15,31,53,.12)',
            padding: '36px 36px 40px',
          }}
          noValidate
        >
          {/* Brand */}
          <div dir="ltr" className="self-start" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1, color: '#0f1f35', fontFamily: 'var(--font-sans)' }}>
            Kawdly <span style={{ color: '#4a6074', fontWeight: 600 }}>People</span>
          </div>

          {/* Title */}
          <h1 className="mt-7" style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.4 }}>
            {t('auth.login.title')}
          </h1>
          <p className="mt-1" style={{ fontSize: 14, color: '#5b6778', lineHeight: 1.7 }}>
            {t('auth.login.subtitle')}
          </p>

          {/* Error banner */}
          {banner ? (
            <p
              role="alert"
              className="mt-5 rounded-sm px-3 py-2.5 text-xs font-medium"
              style={{
                border: '1px solid #F3C9BB',
                background: '#FDF1ED',
                color: '#8F3F26',
              }}
            >
              {banner}
            </p>
          ) : null}

          {/* Email */}
          <label htmlFor="email" className="mt-7" style={{ fontSize: 13, fontWeight: 500, color: '#2a3a50', lineHeight: 1.5 }}>
            {t('auth.login.email')} <span style={{ color: '#c0392b' }}>*</span>
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            dir="ltr"
            {...register('email')}
            className="mt-1.5 w-full outline-none"
            style={{
              height: 46,
              boxSizing: 'border-box',
              border: `1px solid ${errors.email ? '#e4714e' : '#c9d0d9'}`,
              borderRadius: 2,
              padding: '0 14px',
              /* Longhands, not the `font` shorthand: the shorthand would have to
                 inline the family list, and we want the --font-sans token. */
              fontWeight: 400,
              fontSize: 15,
              lineHeight: 'normal',
              fontFamily: 'var(--font-sans)',
              color: '#0f1f35',
              background: '#fff',
              textAlign: isRtl ? 'right' : 'left',
              transition: 'border-color .15s, box-shadow .15s',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#0f4a73';
              e.target.style.boxShadow = '0 0 0 3px rgba(15,74,115,.14)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = errors.email ? '#e4714e' : '#c9d0d9';
              e.target.style.boxShadow = 'none';
            }}
          />
          {errors.email?.message ? (
            <p role="alert" className="mt-1 text-xs" style={{ color: '#c0392b' }}>
              {t(errors.email.message)}
            </p>
          ) : null}

          {/* Password */}
          <div className="mt-5 flex items-baseline justify-between">
            <label htmlFor="pw" style={{ fontSize: 13, fontWeight: 500, color: '#2a3a50', lineHeight: 1.5 }}>
              {t('auth.login.password')} <span style={{ color: '#c0392b' }}>*</span>
            </label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium hover:underline"
              style={{ color: '#0f4a73', textDecoration: 'none' }}
            >
              {t('auth.login.forgotPassword')}
            </Link>
          </div>
          <div className="relative mt-1.5">
            <input
              id="pw"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              dir="ltr"
              {...register('password')}
              className="w-full outline-none"
              style={{
                height: 46,
                boxSizing: 'border-box',
                border: `1px solid ${errors.password ? '#e4714e' : '#c9d0d9'}`,
                borderRadius: 2,
                padding: '0 14px 0 46px',
                fontWeight: 400,
                fontSize: 15,
                lineHeight: 'normal',
                fontFamily: 'var(--font-sans)',
                color: '#0f1f35',
                background: '#fff',
                textAlign: isRtl ? 'right' : 'left',
                transition: 'border-color .15s, box-shadow .15s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#0f4a73';
                e.target.style.boxShadow = '0 0 0 3px rgba(15,74,115,.14)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = errors.password ? '#e4714e' : '#c9d0d9';
                e.target.style.boxShadow = 'none';
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={t(showPassword ? 'auth.login.hidePassword' : 'auth.login.showPassword')}
              className="absolute flex items-center justify-center"
              style={{
                left: 4,
                top: 5,
                width: 36,
                height: 36,
                border: 0,
                background: 'transparent',
                borderRadius: 2,
                cursor: 'pointer',
                color: '#6b7788',
                padding: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#0f4a73';
                e.currentTarget.style.background = '#f1f4f7';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#6b7788';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {showPassword ? (
                <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.7} />
              ) : (
                <Eye className="h-[18px] w-[18px]" strokeWidth={1.7} />
              )}
            </button>
          </div>
          {errors.password?.message ? (
            <p role="alert" className="mt-1 text-xs" style={{ color: '#c0392b' }}>
              {t(errors.password.message)}
            </p>
          ) : null}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-7 w-full outline-none disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              height: 48,
              border: '1px solid #0a3552',
              borderRadius: 2,
              background: '#0f4a73',
              color: '#fff',
              fontWeight: 600,
              fontSize: 15,
              lineHeight: 'normal',
              fontFamily: 'var(--font-sans)',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.12), 0 1px 2px rgba(15,31,53,.18)',
              transition: 'background .15s',
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) e.currentTarget.style.background = '#0c3d60';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#0f4a73';
            }}
            onMouseDown={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.background = '#0a3552';
                e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,.2)';
              }
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.background = '#0c3d60';
              e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.12), 0 1px 2px rgba(15,31,53,.18)';
            }}
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t('auth.login.submit')}
              </span>
            ) : (
              t('auth.login.submit')
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
