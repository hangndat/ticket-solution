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
      className={cn('catalog-skeleton-grid', className)}
      data-testid={testId}
      aria-busy="true"
      aria-label="Đang tải danh sách sự kiện"
    >
      {Array.from({ length: count }, (_, index) => (
        <div className="catalog-skeleton-card" key={index}>
          <Skeleton className="catalog-skeleton-card__art" />
          <Skeleton className="catalog-skeleton-card__line catalog-skeleton-card__line--short" />
          <Skeleton className="catalog-skeleton-card__line" />
          <Skeleton className="catalog-skeleton-card__line catalog-skeleton-card__line--meta" />
        </div>
      ))}
    </div>
  );
}
