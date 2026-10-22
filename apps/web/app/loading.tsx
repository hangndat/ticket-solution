import { CatalogSkeletonGrid } from '@ticket/ui';
import { SurfaceState } from '../src/ui/surface-state';

/** Route-level loading — catalog skeleton grid on attendee uplift. */
export default function Loading() {
  return (
    <main id="main" className="lp-container shell route-loading-shell">
      <SurfaceState
        kind="loading"
        title="Đang tải…"
        detail="Đang lấy danh sách sự kiện — chưa có thao tác vé nào được gửi."
        testId="route-loading"
      />
      <CatalogSkeletonGrid count={6} />
    </main>
  );
}
