import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { pathById } from '@/config/navigation';
import { resolveLocaleText } from '../model';
import type { DepartmentShare } from '../model';

interface OrgTreemapProps {
  rows: DepartmentShare[];
  language: 'ar' | 'en';
}

/**
 * Treemap visualisation of the organizational structure. Each department gets
 * an area proportional to its headcount, arranged in 2–3 rows. Uses the new
 * navy palette with coral accent for the smallest department.
 *
 * The treemap rows are computed by splitting departments into groups that
 * roughly balance total area.
 */

const BG_SHADES = ['#0b4a78', '#2a6a99', '#587f9f', '#7694ac', '#a1b8c9'];

function buildRows(departments: DepartmentShare[]): DepartmentShare[][] {
  if (departments.length === 0) return [];
  // Sort descending by count.
  const sorted = [...departments].sort((a, b) => b.count - a.count);
  if (sorted.length <= 3) return [sorted];
  if (sorted.length <= 5) return [sorted.slice(0, 3), sorted.slice(3)];
  // Aim for 3 balanced rows.
  const total = sorted.reduce((s, d) => s + d.count, 0);
  const target = total / 3;
  const rows: DepartmentShare[][] = [];
  let current: DepartmentShare[] = [];
  let currentSum = 0;
  for (const dept of sorted) {
    if (currentSum >= target && rows.length < 2) {
      rows.push(current);
      current = [];
      currentSum = 0;
    }
    current.push(dept);
    currentSum += dept.count;
  }
  if (current.length > 0) rows.push(current);
  return rows;
}

export function OrgTreemap({ rows: departments, language }: OrgTreemapProps) {
  const { t } = useTranslation();
  const total = departments.reduce((sum, d) => sum + d.count, 0);
  const treemapRows = buildRows(departments);

  if (departments.length === 0) return null;

  return (
    <div>
      {/* Section header */}
      <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-ink pb-2">
        <span className="text-[19px] font-bold text-ink">{t('dashboard.orgTreemap.title')}</span>
        <span className="text-[11px] text-ink-muted">
          {t('dashboard.orgTreemap.subtitle')} · {total} {t('dashboard.orgTreemap.employee')}
        </span>
      </div>

      {/* Treemap */}
      <div className="flex flex-col gap-[3px]" style={{ height: 330 }}>
        {treemapRows.map((row, rowIndex) => {
          const rowTotal = row.reduce((s, d) => s + d.count, 0);
          return (
            <div
              key={rowIndex}
              className="flex min-h-0 gap-[3px]"
              style={{ flex: `${rowTotal} 1 0` }}
            >
              {row.map((dept, deptIndex) => {
                const name = resolveLocaleText(dept.name, language);
                const pct = Math.round((dept.count / total) * 100);
                // Last dept in last row gets coral accent.
                const isAccent = rowIndex === treemapRows.length - 1 && deptIndex === row.length - 1 && departments.length > 3;
                const bgIndex = treemapRows.slice(0, rowIndex).reduce((s, r) => s + r.length, 0) + deptIndex;
                const bg = isAccent ? 'var(--color-coral, #e4714e)' : (BG_SHADES[bgIndex % BG_SHADES.length]);

                return (
                  <div
                    key={name}
                    className="flex min-w-0 flex-col justify-between overflow-hidden p-2.5 text-on-navy md:p-3"
                    style={{ flex: `${dept.count} 1 0`, background: bg }}
                  >
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="truncate text-[13px] font-semibold">{name}</span>
                      <span className="nums shrink-0 font-mono text-[11px] opacity-90">{pct}%</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="nums font-mono text-[clamp(20px,3vw,30px)] font-medium leading-[1]">
                        {dept.count}
                      </span>
                      <span className="text-[11px] opacity-90">{t('dashboard.orgTreemap.employee')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer link */}
      <div className="mt-3">
        <Link
          to={pathById('organization')}
          className="text-[12px] font-semibold text-navy transition-colors duration-150 hover:text-coral"
        >
          {t('dashboard.orgTreemap.viewAll')}
          <span aria-hidden="true" className="rtl:-scale-x-100"> →</span>
        </Link>
      </div>
    </div>
  );
}
