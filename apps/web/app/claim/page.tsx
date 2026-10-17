import type { Metadata } from 'next';
import Link from 'next/link';
import { GuestClaimForm } from './claim-form';

export const metadata: Metadata = {
  title: 'Claim lời mời — Vemoki',
  description:
    'Guest invitation claim after verified Keycloak login (token via fragment).',
  referrer: 'no-referrer',
};

export default function ClaimPage() {
  return (
    <main id="main" className="container shell redeem-page">
      <nav aria-label="Main navigation">
        <Link href="/" className="wordmark">
          ticket<span>↗</span>
        </Link>
        <span className="nav-links">
          <Link href="/redeem">Đổi mã</Link>
          <Link href="/claim">Claim</Link>
          <Link href="/invite">Membership invite</Link>
          <Link href="/admin">Admin</Link>
          <Link href="/auth">Đăng nhập</Link>
        </span>
      </nav>
      <p className="eyebrow">M06 · GUEST INVITATION CLAIM</p>
      <h1>Nhận lời mời sự kiện</h1>
      <p className="intro">
        Khác membership invite. Token qua fragment / sessionStorage, Referrer
        no-referrer. Login-return về /claim. Không auto tạo tài khoản; email
        verified phải khớp lời mời.
      </p>
      <GuestClaimForm />
      <p>
        <Link href="/">← Demo events</Link>
      </p>
    </main>
  );
}
