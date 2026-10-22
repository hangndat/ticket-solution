import Link from 'next/link';
import { SurfaceState } from '../src/ui/surface-state';

export default function NotFound() {
  return (
    <main id="main" className="lp-container shell">
      <p className="eyebrow">404</p>
      <h1>
        Chưa có gì ở đây,
        <br />
        tạm thời.
      </h1>
      <p className="intro">
        Không tìm thấy tổ hợp tenant và sự kiện này — hoặc trang đã chuyển đi.
      </p>
      <SurfaceState
        kind="empty"
        title="Không tìm thấy trang"
        detail="Kiểm tra lại đường dẫn, hoặc quay về trang chủ để xem sự kiện đã xuất bản."
        testId="route-not-found"
        action={
          <Link className="button" href="/">
            Về trang chủ
          </Link>
        }
      />
    </main>
  );
}
