'use client';
import Link from 'next/link';

export default function ErrorBoundary({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="container shell">
      <p className="eyebrow">Lỗi</p>
      <h1>Không tải được trang này.</h1>
      <p className="intro">
        Thử lại. Không có thao tác vé nào được thực hiện từ màn hình này.
      </p>
      <aside className="state-error" role="alert">
        <strong>Trạng thái:</strong> lỗi tải giao diện — chưa biết kết quả phía
        máy chủ.
      </aside>
      <p>
        <button type="button" className="button" onClick={reset}>
          Thử lại
        </button>
      </p>
      <p>
        <Link href="/">← Trang chủ</Link>
      </p>
    </main>
  );
}
