import { useTranslation } from 'react-i18next';
import type { DepartmentShare, Kpi } from '../model';

interface WhatChangedProps {
  kpis: Kpi[];
  departments: DepartmentShare[];
  language: 'ar' | 'en';
}

interface ChangeItem {
  color: string;
  text: string;
  when: string;
}

/**
 * "What changed" timeline feed — derived from KPI deltas and department data.
 * Each change shows a colored dot, text, and a timestamp. This mirrors the new
 * dashboard design's right-side "ما الذي تغيّر" panel.
 *
 * **Never fabricate statistics** — every line here comes from the actual KPI
 * deltas and department data already loaded from the server.
 */
export function WhatChanged({ kpis, departments, language }: WhatChangedProps) {
  const { t } = useTranslation();

  // Derive change items from real KPI data.
  const changes: ChangeItem[] = [];
  const navy = 'var(--color-navy, #0b4a78)';
  const coral = 'var(--color-coral, #e8694a)';
  const muted = 'var(--color-ink-muted, #5d6b7a)';

  for (const kpi of kpis) {
    const first = kpi.trend[0];
    const last = kpi.trend[kpi.trend.length - 1];
    const diff = last - first;
    const suffix = kpi.suffix ?? '';
    const caption = t(kpi.captionKey);

    if (diff > 0) {
      changes.push({
        color: navy,
        text: language === 'ar'
          ? `ارتفع ${caption} بمقدار ${diff.toFixed(suffix === '%' ? 1 : 0)}${suffix}`
          : `${caption} increased by ${diff.toFixed(suffix === '%' ? 1 : 0)}${suffix}`,
        when: t('dashboard.whatChanged.mtd'),
      });
    } else if (diff < 0) {
      changes.push({
        color: coral,
        text: language === 'ar'
          ? `انخفض ${caption} بمقدار ${Math.abs(diff).toFixed(suffix === '%' ? 1 : 0)}${suffix}`
          : `${caption} decreased by ${Math.abs(diff).toFixed(suffix === '%' ? 1 : 0)}${suffix}`,
        when: t('dashboard.whatChanged.mtd'),
      });
    }
  }

  // Add department info if available.
  if (departments.length > 0) {
    const largest = departments.reduce((best, d) => (d.count > best.count ? d : best), departments[0]);
    const total = departments.reduce((s, d) => s + d.count, 0);
    const name = language === 'ar' ? largest.name.ar : largest.name.en;
    changes.push({
      color: muted,
      text: language === 'ar'
        ? `${name} هي أكبر إدارة (${largest.count} من ${total})`
        : `${name} is the largest department (${largest.count} of ${total})`,
      when: t('dashboard.whatChanged.mtd'),
    });
  }

  if (changes.length === 0) return null;

  return (
    <div>
      <div className="border-b border-ink pb-2 text-[15px] font-bold text-ink">
        {t('dashboard.whatChanged.title')}
      </div>
      <div className="flex flex-col">
        {changes.map((item, index) => (
          <div
            key={index}
            className="grid items-baseline gap-2.5 border-b border-divider py-2.5"
            style={{ gridTemplateColumns: '8px 1fr auto' }}
          >
            <span
              className="mt-1 h-1.5 w-1.5 self-center rounded-none"
              style={{ background: item.color }}
              aria-hidden="true"
            />
            <span className="text-[12.5px] text-ink">{item.text}</span>
            <span className="nums whitespace-nowrap font-mono text-[11px] text-ink-muted">{item.when}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
