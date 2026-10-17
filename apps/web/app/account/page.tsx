import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav } from '../../src/site-chrome';
import { AccountPanel } from './account-panel';

export const metadata: Metadata = {
  title: 'Tài khoản',
  description: 'Yêu cầu xóa tài khoản (ACK — không tự xóa dữ liệu).',
};

export default function AccountPage() {
  return (
    <main id="main" className="container shell redeem-page">
      <SiteNav variant="admin" />
      <h1>Tài khoản</h1>
      <p className="intro">
        Gửi yêu cầu xóa tài khoản có trạng thái theo dõi. Hệ thống không xóa dữ
        liệu tự động khi chưa có chính sách O06.
      </p>
      <AccountPanel />
      <p>
        <Link href="/">← Trang chủ</Link>
      </p>
    </main>
  );
}
