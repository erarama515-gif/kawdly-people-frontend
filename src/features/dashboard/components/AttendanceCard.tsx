import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { resolveLocaleText } from '../model';
import type { AttendanceSummary } from '../model';

const numberFormat = new Intl.NumberFormat('en-US');

/**
 * Attendance today — the navy data card. Big mono rate, "of {total}" caption,
 * today/earlier legend, the 7-day bar band (height = 6·value − 528) and a
 * three-cell head-count grid (Present / Absent / Late).
 */
export function AttendanceCard({
  attendance,
  language,
  className,
}: {
  attendance: AttendanceSummary;
  language: 'ar' | 'en';
  className?: string;
}) {
  const { t } = useTranslation();

  const statCells: { label: string; value: string; accent?: boolean }[] = [
    { label: t('dashboard.attendanceCard.present'), value: numberFormat.format(attendance.present) },
    { label: t('dashboard.attendanceCard.absent'), value: numberFormat.format(attendance.absent) },
    { label: t('dashboard.attendanceCard.late'), value: numberFormat.format(attendance.late), accent: true },
  ];

  return (
    <div
      className={cn('flex flex-col gap-3 bg-navy p-4 text-on-navy md:p-6', className)}
      style={{
        backgroundImage: 'radial-gradient(300px 220px at 100% 0%, rgba(31,123,184,.6), transparent 70%)',
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[20px] font-bold tracking-[-0.02em] text-on-navy">
          {t('dashboard.attendanceCard.title')}
        </span>
        <span className="nums font-mono text-[11px] font-medium text-on-navy-muted-75">
          {t('dashboard.attendanceCard.ofTotal', { count: attendance.totalEmployees })}
        </span>
      </div>

      <div>
        <p className="nums text-on-navy">
          <span className="font-mono text-[60px] font-bold leading-none tracking-[-0.06em]">
            {attendance.today.toFixed(1)}
          </span>
          <span className="font-mono text-[26px] font-bold tracking-[-0.04em]">%</span>
        </p>
        <div className="mt-3 flex gap-4 text-[12px] text-on-navy-muted-75">
          <span className="flex items-center gap-1.5 text-on-navy">
            <span className="h-2 w-2 rounded-full bg-on-navy" aria-hidden="true" />
            {t('dashboard.attendanceCard.today')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#5B89AD]" aria-hidden="true" />
            {t('dashboard.attendanceCard.earlierDays')}
          </span>
        </div>
      </div>

      <div className="flex h-20 items-end gap-1.5">
        {attendance.weekTrend.map((value, index) => {
          const isLast = index === attendance.weekTrend.length - 1;
          // Bar height is proportional to the value (baseline 88 → 100), so any
          // series length from the server renders sensibly.
          const height = Math.max(0, Math.round(6 * value - 528));
          return (
            <div key={index} className="relative flex-1" style={{ height: `${height}px` }}>
              <span
                className={cn('block h-full w-full', isLast ? 'bg-on-navy' : 'bg-on-navy-faint-28')}
                aria-hidden="true"
              />
              {isLast ? (
                <span className="absolute -top-[22px] end-0 rounded-full bg-coral px-2 py-px font-mono text-[10px] font-bold leading-4 text-on-navy">
                  {t('dashboard.attendanceCard.today')}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {attendance.weekTrend.length > 0 ? (
        <div className="-mt-1.5 flex gap-1.5">
          {attendance.weekTrend.map((value, index) => {
            const isLast = index === attendance.weekTrend.length - 1;
            return (
              <span
                key={index}
                className={cn(
                  'nums flex-1 text-center font-mono text-[10px] font-medium',
                  isLast ? 'text-on-navy' : 'text-on-navy-muted-75',
                )}
              >
                {value}
              </span>
            );
          })}
        </div>
      ) : null}

      {attendance.weekLabels.length > 0 ? (
        <div className="flex gap-1.5">
          {attendance.weekLabels.map((label) => (
            <span
              key={resolveLocaleText(label, language)}
              className="nums flex-1 text-center font-mono text-[10px] font-medium text-on-navy-muted-70"
            >
              {resolveLocaleText(label, language)}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-3 gap-px border border-[rgba(255,255,255,0.25)] bg-[rgba(255,255,255,0.25)]">
        {statCells.map((cell) => (
          <div key={cell.label} className="bg-navy px-3 py-2.5">
            <p className="text-[11px] text-on-navy-muted-75">{cell.label}</p>
            <p className={cn('nums mt-0.5 font-mono text-[18px] font-bold tracking-[-0.05em]', cell.accent ? 'text-coral' : 'text-on-navy')}>
              {cell.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}