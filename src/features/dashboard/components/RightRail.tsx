import { cn } from '@/lib/cn';
import type { AttendanceSummary, UpcomingItem } from '../model';
import { AttendanceCard } from './AttendanceCard';
import { UpcomingCard } from './RightRailCards';

interface RightRailProps {
  attendance: AttendanceSummary;
  upcoming: UpcomingItem[];
  language: 'ar' | 'en';
  className?: string;
}

/** Fixed right ledger column — attendance, upcoming (separated by hairlines). */
export function RightRail({ attendance, upcoming, language, className }: RightRailProps) {  return (
    <aside className={cn('flex min-w-0 flex-col gap-px bg-page', className)}>
      <AttendanceCard attendance={attendance} language={language} />
      <UpcomingCard items={upcoming} language={language} />
    </aside>
  );
}