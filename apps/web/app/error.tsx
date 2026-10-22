'use client';
import Link from 'next/link';
import { SurfaceState } from '../src/ui/surface-state';

export default function ErrorBoundary({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="lp-container shell">
      <p className="eyebrow">Lỗi</p>
      <h1>Không tải được trang này.</h1>
      <p className="intro">
        Thử lại. Không có thao tác vé nào được thực hiện từ màn hình này.
      </p>
      <SurfaceState
        kind="error"
        title="Lỗi tải giao diện"
        detail="Chưa biết kết quả phía máy chủ — không suy diễn thành công hay thất bại nghiệp vụ."
        testId="route-error"
        action={
          <button type="button" className="button" onClick={reset}>
            Thử lại
          </button>
        }
      />
      <p>
        <Link href="/">← Trang chủ</Link>
      </p>
    </main>
  );
}
