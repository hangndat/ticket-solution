import { ConsumerPageShell } from '../../src/consumer-page-shell';
import { CatalogSkeletonGrid, Skeleton } from '@ticket/ui';
import { attendeeHomeMain } from '../../src/attendee-surface';

/**
 * Catalog (home) route loading — skeleton matches the card grid layout.
 * No full-page "Đang tải…" status card; nav/footer chrome render normally
 * through ConsumerPageShell and the consumer layout. aria-busy + sr-only label on the grid itself.
 */
export default function Loading() {
  return (
    <ConsumerPageShell mainClassName={attendeeHomeMain} mainProps={{ 'aria-busy': true }}>
      <span className="sr-only" role="status">
        Đang tải danh sách sự kiện
      </span>
      <div className="mb-[var(--spacing-2xl)] flex flex-col gap-5 border-b border-line pb-8 pt-9 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-[40rem]">
          <Skeleton className="h-9 w-[16rem]" />
          <Skeleton className="mt-3 h-4 w-[22rem] max-w-full" />
        </div>
        <Skeleton className="h-5 w-[10rem]" />
      </div>
      <CatalogSkeletonGrid count={6} />
    </ConsumerPageShell>
  );
}
