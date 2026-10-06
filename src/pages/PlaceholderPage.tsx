import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import type { NavEntry } from '@/config/navigation';

interface PlaceholderPageProps {
  entry: NavEntry;
}

export function PlaceholderPage({ entry }: PlaceholderPageProps) {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader title={t(`nav.${entry.id}`)} />
      <p className="max-w-2xl text-body-sm text-ink-muted">
        {t('emptyState.comingSoonDescription')}
      </p>
    </>
  );
}