import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main" className="container shell">
      <p className="eyebrow">404</p>
      <h1>
        Chưa có gì ở đây,
        <br />
        tạm thời.
      </h1>
      <p className="intro">
        Không tìm thấy tổ hợp tenant và sự kiện này — hoặc trang đã chuyển đi.
      </p>
      <aside className="state-empty" role="status">
        Kiểm tra lại đường dẫn, hoặc quay về trang chủ để chọn sự kiện demo.
      </aside>
      <Link className="button" href="/">
        Về trang chủ
      </Link>
    </main>
  );
}
