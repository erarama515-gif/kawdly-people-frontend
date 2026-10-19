import { cn } from '@/lib/cn';
import { ClockWidget } from '@/components/ClockWidget';
import type { AttendanceSummary, UpcomingItem } from '../model';
import { AttendanceCard } from './AttendanceCard';
import { UpcomingCard } from './RightRailCards';

interface RightRailProps {
  attendance: AttendanceSummary;
  upcoming: UpcomingItem[];
  language: 'ar' | 'en';
  className?: string;
}

/** Fixed right ledger column — clock, attendance, and optionally upcoming. */
export function RightRail({ attendance, upcoming, language, className }: RightRailProps) {
  return (
    <aside className={cn('flex min-w-0 flex-col gap-px bg-page', className)}>
      <ClockWidget className="rounded-none border-x-0 border-t-0" />
      <AttendanceCard attendance={attendance} language={language} />
      {upcoming.length > 0 ? <UpcomingCard items={upcoming} language={language} /> : null}
    </aside>
  );
}
