import { ConsumerPageShell } from '../../../../../../src/consumer-page-shell';
import { Skeleton } from '@ticket/ui';
import { attendeeEventCols, attendeeEventPage } from '../../../../../../src/attendee-detail-surface';

/** Event detail route loading — hero banner + two-column body skeleton. */
export default function Loading() {
  return (
    <ConsumerPageShell mainClassName={attendeeEventPage} mainProps={{ 'aria-busy': true }}>
      <span className="sr-only" role="status">
        Đang tải thông tin sự kiện
      </span>
      <Skeleton className="h-4 w-[6rem]" />
      <Skeleton className="mt-4 h-[220px] w-full rounded-xl" aria-busy="true" />
      <div className={attendeeEventCols}>
        <div className="grid gap-3">
          <Skeleton className="h-8 w-[70%]" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[85%]" />
          <Skeleton className="h-4 w-[60%]" />
        </div>
        <div className="grid gap-3 rounded-lg border border-line bg-paper p-5">
          <Skeleton className="h-4 w-[70%]" />
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    </ConsumerPageShell>
  );
}
