import { SurfaceState } from '../src/ui/surface-state';

/** Route-level loading for demo surfaces (Next.js App Router). */
export default function Loading() {
  return (
    <main id="main" className="container shell">
      <SurfaceState
        kind="loading"
        title="Đang tải…"
        detail="Vui lòng chờ — chưa có thao tác vé nào được gửi từ màn hình này."
        testId="route-loading"
      />
    </main>
  );
}
