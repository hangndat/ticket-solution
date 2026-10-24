import { Skeleton } from '@ticket/ui';

/**
 * Marketing route loading (VI + EN share this layout tree) — hero-shaped
 * skeleton on the ink background, not the catalog copy/skeleton. Keeps the
 * same footprint as the hero section to avoid layout jump on hydrate.
 */
export default function Loading() {
  return (
    <main
      id="main"
      className="min-h-dvh bg-ink px-[clamp(1.25rem,4vw,2rem)] pt-[clamp(2.5rem,6vw,4rem)]"
    >
      <span className="sr-only" role="status">
        Đang tải trang giới thiệu
      </span>
      <div
        className="mx-auto grid max-w-[1120px] grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_1.12fr] lg:gap-12"
        aria-busy="true"
      >
        <div className="grid gap-3">
          <Skeleton className="h-10 w-[85%] bg-paper/10" />
          <Skeleton className="h-10 w-[60%] bg-paper/10" />
          <Skeleton className="mt-3 h-4 w-full bg-paper/10" />
          <Skeleton className="h-4 w-[70%] bg-paper/10" />
          <div className="mt-6 flex gap-3">
            <Skeleton className="h-11 w-[9rem] bg-paper/10" />
            <Skeleton className="h-11 w-[9rem] bg-paper/10" />
          </div>
        </div>
        <Skeleton className="aspect-[4/3] w-full bg-paper/10" />
      </div>
    </main>
  );
}
