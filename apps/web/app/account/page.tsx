import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav } from '../../src/site-chrome';
import { AccountPanel } from './account-panel';

export const metadata: Metadata = {
  title: 'Tài khoản',
  description:
    'Yêu cầu xóa tài khoản (O06: anonymize ≤ 30 ngày — ACK không phải xóa ngay).',
};

export default function AccountPage() {
  return (
    <main id="main" className="container shell redeem-page">
      <SiteNav variant="admin" />
      <h1>Tài khoản</h1>
      <p className="intro">
        Gửi yêu cầu xóa tài khoản có trạng thái theo dõi. Theo O06, mục tiêu
        anonymize PII liên quan trong ≤ 30 ngày sau khi chấp nhận yêu cầu — ACK
        không phải xóa cứng ngay. Chi tiết:{' '}
        <Link href="/privacy">Quyền riêng tư</Link>.
      </p>
      <AccountPanel />
      <p>
        <Link href="/">← Trang chủ</Link>
      </p>
    </main>
  );
}
