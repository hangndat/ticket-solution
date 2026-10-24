import { Skeleton } from '@ticket/ui';

/**
 * Root fallback loading — only hit by routes without their own loading.tsx
 * (claim/invite/account/privacy/support/dev). Generic content-shaped
 * skeleton, not a full-page "Đang tải…" status card and not the catalog
 * grid copy (that belongs to the consumer catalog route's own loading.tsx).
 */
export default function Loading() {
  return (
    <main id="main" className="mx-auto max-w-[40rem] px-5 py-[var(--spacing-3xl)]">
      <span className="sr-only" role="status">
        Đang tải nội dung
      </span>
      <div className="grid gap-3" aria-busy="true">
        <Skeleton className="h-8 w-[60%]" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[85%]" />
        <Skeleton className="mt-3 h-11 w-full" />
      </div>
    </main>
  );
}
