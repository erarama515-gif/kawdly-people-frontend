import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/form';
import { userFacingMessage } from '@/lib/api/errors';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import { Brand } from '@/components/layout/Brand';

/**
 * Self-service forgot-password page.
 *
 * POST /api/v1/auth/forgot-password  — always returns 200 (avoids enumeration).
 * On success shows a confirmation message without revealing whether the email
 * is registered.
 *
 * Not wired into the app router yet — a route entry in App.tsx is needed:
 *   <Route path="/forgot-password" element={<ForgotPasswordPage />} />
 */

const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'common.requiredField').email('common.invalidEmail'),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | undefined>(undefined);

  const resolver = useMemo(() => zodResolver(forgotPasswordSchema), []);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver,
    defaultValues: { email: '' },
  });

  async function onSubmit(values: ForgotPasswordValues) {
    setServerError(undefined);
    try {
      await http('/auth/forgot-password', {
        method: 'POST',
        body: { email: values.email },
        ignoreBody: false,
      });
      setSubmitted(true);
    } catch (error) {
      setServerError(userFacingMessage(error));
    }
  }

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12"
      style={{
        background: 'linear-gradient(135deg, #072d4a 0%, #0c4874 40%, #1f7bb8 100%)',
      }}
    >
      {/* Decorative glow */}
      <div
        className="pointer-events-none absolute end-0 top-0 h-[400px] w-[400px] opacity-20"
        style={{
          background: 'radial-gradient(circle at 100% 0%, #e4714e 0%, transparent 65%)',
        }}
        aria-hidden="true"
      />

      <div className="rise relative z-10 w-full max-w-[400px] rounded-2xl border border-on-navy-border-18 bg-surface p-8 shadow-2xl md:p-10">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <Brand tone="light" className="scale-125" />
        </div>

        {submitted ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" strokeWidth={1.5} aria-hidden="true" />
            <h1 className="text-section-title font-semibold text-ink">Check your email</h1>
            <p className="text-body-sm text-ink-muted">
              If that email address is registered, you will receive a link to reset your password
              within a few minutes.
            </p>
            <Link
              to="/login"
              className="mt-2 inline-flex items-center gap-1.5 text-body-sm font-medium text-navy hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              Back to sign in
            </Link>
          </div>
        ) : (
          /* ── Form state ── */
          <>
            <h1 className="mb-2 text-center text-section-title font-semibold text-ink">
              Forgot password?
            </h1>
            <p className="mb-6 text-center text-body-sm text-ink-muted">
              Enter your email and we'll send you a reset link.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
              {serverError ? (
                <p
                  role="alert"
                  className="rounded-lg border border-coral/30 bg-coral/5 px-4 py-2.5 text-caption text-coral"
                >
                  {serverError}
                </p>
              ) : null}

              <Field
                label="Email address"
                htmlFor="fp-email"
                required
                error={errors.email?.message}
              >
                <Input
                  id="fp-email"
                  type="email"
                  autoComplete="email"
                  invalid={!!errors.email}
                  {...register('email')}
                />
              </Field>

              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                className="mt-1 w-full py-2.5 text-[14px] font-semibold"
              >
                Send reset link
              </Button>
            </form>

            <div className="mt-5 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-ink"
              >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>

      <p className="rise mt-8 text-[12px] text-on-navy-muted-70" style={{ animationDelay: '150ms' }}>
        Powered by <span className="font-semibold text-on-navy-muted-85">Kawdly</span>
      </p>
    </div>
  );
}
