import type { Metadata } from 'next';
import Link from 'next/link';
import { InviteAcceptForm } from './invite-accept';

export const metadata: Metadata = {
  title: 'Nhận invite — Vemoki',
  description: 'Accept membership invite after Keycloak login (token via fragment).',
  referrer: 'no-referrer',
};

export default function InvitePage() {
  return (
    <main className="shell">
      <nav className="top-nav" aria-label="Chính">
        <Link href="/">Vemoki</Link>
        <Link href="/admin">Admin</Link>
        <Link href="/invite">Nhận invite</Link>
        <Link href="/account">Tài khoản</Link>
      </nav>
      <p className="eyebrow">M02 · MEMBERSHIP INVITE</p>
      <h1>Nhận invite</h1>
      <p className="intro">
        Token chỉ qua fragment / bộ nhớ tạm, Referrer-Policy no-referrer. Không
        seed membership SQL để claim self-service.
      </p>
      <InviteAcceptForm />
    </main>
  );
}
