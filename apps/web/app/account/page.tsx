import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav } from '../../src/site-chrome';
import { AccountPanel } from './account-panel';

export const metadata: Metadata = {
  title: 'Tài khoản',
  description:
    'Yêu cầu xóa tài khoản: đã tiếp nhận — xử lý xóa hoặc ẩn danh trong ≤ 30 ngày, không xóa ngay.',
};

export default function AccountPage() {
  return (
    <main id="main" className="container shell redeem-page">
      <SiteNav variant="admin" />
      <h1>Tài khoản</h1>
      <p className="intro">
        Gửi yêu cầu xóa tài khoản có trạng thái theo dõi. Khi gửi, yêu cầu đã
        được tiếp nhận — chưa phải xóa ngay. Chúng tôi xử lý xóa hoặc ẩn danh
        dữ liệu cá nhân liên quan trong ≤ 30 ngày; nhật ký kiểm toán có thể giữ
        theo chính sách. Chi tiết:{' '}
        <Link href="/privacy">Quyền riêng tư</Link>.
      </p>
      <AccountPanel />
      <p>
        <Link href="/">← Trang chủ</Link>
      </p>
    </main>
  );
}
