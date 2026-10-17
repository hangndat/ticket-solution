import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountPanel } from './account-panel';

export const metadata: Metadata = {
  title: 'Tài khoản — Vemoki',
  description: 'Account deletion request ACK (no auto-erase).',
};

export default function AccountPage() {
  return (
    <main className="shell">
      <nav className="top-nav" aria-label="Chính">
        <Link href="/">Vemoki</Link>
        <Link href="/admin">Admin</Link>
        <Link href="/invite">Nhận invite</Link>
        <Link href="/account">Tài khoản</Link>
      </nav>
      <p className="eyebrow">M02 · ACCOUNT</p>
      <h1>Tài khoản</h1>
      <p className="intro">
        Request xóa account có trạng thái; không erase khi chưa có policy O06.
      </p>
      <AccountPanel />
    </main>
  );
}
