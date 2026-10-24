import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Copy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import { isApiError } from '@/lib/api/errors';
import { Brand } from '@/components/layout/Brand';

/**
 * Founder-only local password reset.
 *
 * There is no email server in the desktop app, so the usual "send a reset
 * link" flow cannot work. Electron injects KAWDLY_DEV_RESET=1 only when the
 * per-user DEV_MODE marker exists; the read-only GET probe on /auth/dev-reset
 * tells this page whether the reset exists, so a beta user on a normal install
 * sees the support message straight away instead of a button that 404s. The
 * generated password is shown once and is never written to the audit log.
 */

interface DevResetResponse {
  email: string;
  password: string;
  warning: string;
}

type Mode = 'initial' | 'contact-support' | 'show-new-password';

/**
 * Whether this install exposes the founder-only reset at all. The POST returns
 * 404 when Electron did not inject KAWDLY_DEV_RESET=1, so we ask the read-only
 * GET probe on mount: a beta user should never see a button that is guaranteed
 * to dead-end.
 */
type Capability = 'probing' | 'available' | 'unavailable';

export function ForgotPasswordPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('initial');
  const [capability, setCapability] = useState<Capability>('probing');
  const [credentials, setCredentials] = useState<DevResetResponse | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const isRtl = i18n.language === 'ar';

  useEffect(() => {
    let cancelled = false;

    http<{ data: { available: boolean } }>('/auth/dev-reset', { method: 'GET' })
      .then((response) => {
        if (cancelled) return;

        if (response.data?.data?.available === true) {
          setCapability('available');
        } else {
          setCapability('unavailable');
          setMode('contact-support');
        }
      })
      .catch(() => {
        if (cancelled) return;
        // An older backend has no probe at all: treat that as "no reset here"
        // rather than showing a button that would 404 on click.
        setCapability('unavailable');
        setMode('contact-support');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleReset() {
    setError(undefined);
    setIsSubmitting(true);

    try {
      const response = await http<DevResetResponse>('/auth/dev-reset', {
        method: 'POST',
        body: {},
      });

      if (!response.data) {
        throw new Error('Dev reset returned an empty response');
      }

      setCredentials(response.data);
      setCopied(false);
      setMode('show-new-password');
    } catch (err) {
      if (isApiError(err) && err.status === 404) {
        setMode('contact-support');
      } else {
        setError(t('auth.forgotPassword.error'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopy() {
    if (!credentials) return;

    try {
      await navigator.clipboard.writeText(credentials.password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t('auth.forgotPassword.copyError'));
    }
  }

  function handleDialogOpenChange(open: boolean) {
    if (!open) {
      setMode('initial');
      setCredentials(null);
      setCopied(false);
      setError(undefined);
    }
  }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={i18n.language}
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

        {mode === 'contact-support' ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <h1 className="text-section-title font-semibold text-ink">
              {t('auth.forgotPassword.contactSupport.title')}
            </h1>
            <p className="text-body-sm text-ink-muted">
              {t('auth.forgotPassword.contactSupport.message')}
            </p>
            <a
              href={`mailto:${t('auth.forgotPassword.contactSupport.supportEmail')}`}
              className="text-body-sm font-medium text-navy hover:underline"
            >
              {t('auth.forgotPassword.contactSupport.supportEmail')}
            </a>
            <Link
              to="/login"
              className="mt-2 inline-flex items-center gap-1.5 text-body-sm font-medium text-navy hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              {t('auth.forgotPassword.backToLogin')}
            </Link>
          </div>
        ) : (
          <>
            <h1 className="mb-2 text-center text-section-title font-semibold text-ink">
              {t('auth.forgotPassword.title')}
            </h1>
            <p className="mb-6 text-center text-body-sm text-ink-muted">
              {t('auth.forgotPassword.subtitle')}
            </p>

            {error ? (
              <p
                role="alert"
                className="mb-4 rounded-lg border border-coral/30 bg-coral/5 px-4 py-2.5 text-caption text-coral"
              >
                {error}
              </p>
            ) : null}

            <Button
              variant="primary"
              isLoading={isSubmitting || capability === 'probing'}
              disabled={capability !== 'available'}
              onClick={() => void handleReset()}
              className="w-full py-2.5 text-[14px] font-semibold"
            >
              {t('auth.forgotPassword.button')}
            </Button>

            <div className="mt-5 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-ink"
              >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                {t('auth.forgotPassword.backToLogin')}
              </Link>
            </div>
          </>
        )}
      </div>

      <p className="rise mt-8 text-[12px] text-on-navy-muted-70" style={{ animationDelay: '150ms' }}>
        Powered by <span className="font-semibold text-on-navy-muted-85">Kawdly</span>
      </p>

      <Dialog open={mode === 'show-new-password'} onOpenChange={handleDialogOpenChange}>
        {credentials ? (
          <DialogContent
            title={t('auth.forgotPassword.newPassword.title')}
            description={t('auth.forgotPassword.newPassword.warning')}
            footer={
              <Button variant="primary" onClick={() => navigate('/login')}>
                {t('auth.forgotPassword.newPassword.goToLogin')}
              </Button>
            }
          >
            <div className="flex flex-col gap-4">
              {error ? (
                <p role="alert" className="text-caption text-coral">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-col gap-1">
                <span className="text-caption font-medium text-ink-muted">
                  {t('auth.forgotPassword.newPassword.emailLabel')}
                </span>
                <span
                  dir="ltr"
                  className="break-all rounded-lg border border-hairline bg-surface-hover px-3 py-2 text-body-sm text-ink"
                >
                  {credentials.email}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-caption font-medium text-ink-muted">
                  {t('auth.forgotPassword.newPassword.passwordLabel')}
                </span>
                <div className="flex items-center gap-2">
                  <code
                    dir="ltr"
                    className="min-w-0 flex-1 break-all rounded-lg border border-hairline bg-surface-hover px-3 py-2 font-mono text-body-sm text-ink"
                  >
                    {credentials.password}
                  </code>
                  <Button
                    variant="secondary"
                    onClick={() => void handleCopy()}
                    className="shrink-0"
                  >
                    <Copy className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                    {copied
                      ? t('auth.forgotPassword.newPassword.copied')
                      : t('auth.forgotPassword.newPassword.copyButton')}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
