import { ConsumerPageShell } from '../../../src/consumer-page-shell';
import { Skeleton } from '@ticket/ui';
import { attendeeWalletPage } from '../../../src/attendee-detail-surface';

/** Wallet route loading — ticket list skeleton, stable footprint (header + 3 cards). */
export default function Loading() {
  return (
    <ConsumerPageShell mainClassName={attendeeWalletPage} mainProps={{ 'aria-busy': true }}>
      <span className="sr-only" role="status">
        Đang tải vé của bạn
      </span>
      <Skeleton className="h-8 w-[12rem]" />
      <Skeleton className="mt-3 h-4 w-[26rem] max-w-full" />
      <div className="mt-6 grid gap-4" aria-busy="true" aria-label="Đang tải vé">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-lg border border-line bg-paper p-5"
          >
            <Skeleton className="h-4 w-[40%]" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-[65%]" />
          </div>
        ))}
      </div>
    </ConsumerPageShell>
  );
}
