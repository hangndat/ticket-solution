import { cn } from '../cn.js';
import { Skeleton } from './skeleton.js';

export type CatalogSkeletonGridProps = {
  count?: number;
  className?: string;
  testId?: string;
};

/** Placeholder grid while catalog data loads — matches uplift card rhythm. */
export function CatalogSkeletonGrid({
  count = 6,
  className,
  testId = 'home-catalog-skeleton',
}: CatalogSkeletonGridProps) {
  return (
    <div
      className={cn(
        'my-[var(--spacing-2xl)] grid grid-cols-1 gap-[22px] sm:grid-cols-2 xl:grid-cols-3',
        className,
      )}
      data-testid={testId}
      aria-busy="true"
      aria-label="Đang tải danh sách sự kiện"
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          className="overflow-hidden rounded-2xl border border-line bg-paper pb-4"
          key={index}
        >
          <Skeleton className="h-[168px] w-full rounded-none" />
          <Skeleton className="mx-4 mt-3 h-3.5 w-[40%]" />
          <Skeleton className="mx-4 mt-3 h-3.5 w-full" />
          <Skeleton className="mx-4 mt-3 h-3.5 w-[65%]" />
        </div>
      ))}
    </div>
  );
}
