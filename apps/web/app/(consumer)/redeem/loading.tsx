import { ConsumerPageShell } from '../../../src/consumer-page-shell';
import { Skeleton } from '@ticket/ui';
import { redeemNarrow, redeemPageMain } from '../../../src/redeem/redeem-surface';

/** Redeem route loading — form-shaped skeleton (header + one code field + button). */
export default function Loading() {
  return (
    <ConsumerPageShell mainClassName={redeemPageMain} mainProps={{ 'aria-busy': true }}>
      <span className="sr-only" role="status">
        Đang tải trang đổi mã
      </span>
      <div className={redeemNarrow}>
        <Skeleton className="h-8 w-[14rem]" />
        <Skeleton className="mt-3 h-4 w-full" />
        <div
          className="mt-6 grid gap-3.5 rounded-lg border border-line bg-paper p-6"
          aria-busy="true"
          aria-label="Đang tải biểu mẫu"
        >
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-[8rem]" />
        </div>
      </div>
    </ConsumerPageShell>
  );
}
