import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav } from '../../src/site-chrome';
import { AccountPanel } from './account-panel';
import { SessionPanel } from './session-panel';

export const metadata: Metadata = {
  title: 'Tài khoản',
  description:
    'Phiên đăng nhập và yêu cầu xóa tài khoản Vemoki.',
};

export default function AccountPage() {
  return (
    <main id="main" className="container shell redeem-page">
      <SiteNav />
      <h1>Tài khoản</h1>
      <p className="intro">
        Xem phiên đăng nhập hoặc đăng xuất. Bên dưới là yêu cầu xóa tài khoản
        (đã tiếp nhận — xử lý trong ≤ 30 ngày, không xóa ngay). Chi tiết:{' '}
        <Link href="/privacy">Quyền riêng tư</Link>.
      </p>
      <SessionPanel />
      <h2 className="account-section-title">Yêu cầu xóa tài khoản</h2>
      <AccountPanel />
      <p>
        <Link href="/">← Trang chủ</Link>
      </p>
    </main>
  );
}
