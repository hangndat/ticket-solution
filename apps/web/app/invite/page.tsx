import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav } from '../../src/site-chrome';
import { InviteAcceptForm } from './invite-accept';

export const metadata: Metadata = {
  title: 'Nhận lời mời thành viên',
  description:
    'Chấp nhận membership invite sau đăng nhập Keycloak (token qua fragment).',
  referrer: 'no-referrer',
};

export default function InvitePage() {
  return (
    <main id="main" className="container shell redeem-page">
      <SiteNav />
      <h1>Nhận lời mời thành viên</h1>
      <p className="intro">
        Token chỉ qua fragment / bộ nhớ tạm; Referrer-Policy no-referrer. Không
        seed membership bằng SQL để claim self-service.
      </p>
      <InviteAcceptForm />
      <p>
        <Link href="/">← Trang chủ</Link>
      </p>
    </main>
  );
}
