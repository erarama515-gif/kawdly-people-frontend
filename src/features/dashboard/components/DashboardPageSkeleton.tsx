import { Skeleton } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';

export function DashboardPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-6 p-6 md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Skeleton className="h-3 w-60" />
          <Skeleton className="h-8 w-40 rounded-full" />
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <Skeleton className="h-16 w-16 rounded-[3px] md:h-28 md:w-28" />
          <Skeleton className="h-12 w-3/4 max-w-2xl md:h-16" />
        </div>
        <Skeleton className="h-6 w-80" />
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-10 w-32 rounded-full" />
          <Skeleton className="h-10 w-36 rounded-[3px]" />
          <Skeleton className="h-10 w-32 rounded-[3px]" />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="flex flex-col gap-3 p-4 md:p-6">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-3 w-20" />
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="flex flex-col gap-4 p-4 md:p-6">
          <Skeleton className="h-6 w-48" />
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 border-b border-divider pb-4 last:border-b-0 last:pb-0">
              <Skeleton className="h-6 w-6" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-[3px]" />
              </div>
            </div>
          ))}
        </Card>
        <Card className="flex flex-col gap-4 p-4 md:p-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </Card>
      </div>
    </div>
  );
}
