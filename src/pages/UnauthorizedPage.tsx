import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

export function UnauthorizedPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-coral/10">
        <ShieldAlert className="h-8 w-8 text-coral" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-section-title text-ink">{t('unauthorized.title')}</h2>
      <p className="mt-2 max-w-md text-body-sm text-ink-muted">{t('unauthorized.description')}</p>
      <Link
        to="/"
        className="mt-6 inline-flex h-10 items-center justify-center rounded-[3px] bg-navy px-4 text-body-sm font-medium text-on-navy transition-colors duration-150 hover:bg-navy-deep"
      >
        {t('unauthorized.backToDashboard')}
      </Link>
    </div>
  );
}
