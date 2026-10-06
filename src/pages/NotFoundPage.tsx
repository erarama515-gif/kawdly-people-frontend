import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <FileQuestion className="h-10 w-10 text-ink-faint" strokeWidth={1.5} aria-hidden="true" />
      <h2 className="mt-5 text-section-title text-ink">{t('notFound.title')}</h2>
      <p className="mt-2 max-w-md text-body-sm text-ink-muted">{t('notFound.description')}</p>
      <Link
        to="/"
        className="mt-6 inline-flex h-10 items-center justify-center rounded-[3px] bg-navy px-4 text-body-sm font-medium text-on-navy transition-colors duration-150 hover:bg-navy-deep"
      >
        {t('notFound.backToDashboard')}
      </Link>
    </div>
  );
}