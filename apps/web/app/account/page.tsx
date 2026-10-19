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

/** Phase 2 full visual — hierarchy + Live Pulse, not redeem utility chrome. */
export default function AccountPage() {
  return (
    <main id="main" className="container shell account-page">
      <SiteNav />
      <header className="account-header">
        <h1>Tài khoản</h1>
        <p className="intro">
          Xem phiên đăng nhập, đăng xuất, hoặc gửi yêu cầu xóa tài khoản. Chi
          tiết:{' '}
          <Link href="/privacy">Quyền riêng tư</Link>.
        </p>
      </header>
      <SessionPanel />
      <section
        className="account-deletion"
        aria-labelledby="account-deletion-title"
      >
        <h2 id="account-deletion-title" className="account-section-title">
          Yêu cầu xóa tài khoản
        </h2>
        <AccountPanel />
      </section>
      <p className="account-back">
        <Link href="/">← Trang chủ</Link>
      </p>
    </main>
  );
}
