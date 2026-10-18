import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GraduationCap, ListTree } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/ui/PageHeader';
import { TrainingProgramsTab } from './TrainingProgramsTab';
import { LearningPathsTab } from './LearningPathsTab';

/**
 * The Learning module page — one nav leaf (`/talent/learning`) with two
 * sub-views, using the same tab bar as `SettingsPage`:
 *   - 'programs': TrainingProgram CRUD + per-program enrollment dialog.
 *   - 'paths':    LearningPath CRUD + per-path step dialog.
 *
 * Each tab owns its own data, filters, pagination and dialogs so nothing is
 * fetched for the tab that is not on screen.
 */

type LearningTabId = 'programs' | 'paths';

interface LearningTabDef {
  id: LearningTabId;
  labelKey: string;
  icon: React.ReactNode;
}

const LEARNING_TABS: LearningTabDef[] = [
  {
    id: 'programs',
    labelKey: 'learning.tabs.programs',
    icon: <GraduationCap className="h-4 w-4" strokeWidth={1.75} />,
  },
  {
    id: 'paths',
    labelKey: 'learning.tabs.paths',
    icon: <ListTree className="h-4 w-4" strokeWidth={1.75} />,
  },
];

export function LearningPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<LearningTabId>('programs');

  return (
    <div className="flex flex-col">
      <PageHeader title={t('learning.title')} />

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 border-b border-divider">
        {LEARNING_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-body-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border-navy text-navy'
                : 'border-transparent text-ink-muted hover:border-divider hover:text-ink',
            )}
          >
            {tab.icon}
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'programs' ? <TrainingProgramsTab /> : <LearningPathsTab />}
    </div>
  );
}
