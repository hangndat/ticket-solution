import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav } from '../../src/site-chrome';
import { GuestClaimForm } from './claim-form';

export const metadata: Metadata = {
  title: 'Nhận lời mời sự kiện',
  description:
    'Claim lời mời khách sau đăng nhập Keycloak (token qua fragment).',
  referrer: 'no-referrer',
};

export default function ClaimPage() {
  return (
    <main id="main" className="container shell redeem-page">
      <SiteNav variant="guest" />
      <h1>Nhận lời mời sự kiện</h1>
      <p className="intro">
        Khác invite thành viên. Token đi qua fragment / sessionStorage;
        Referrer-Policy no-referrer. Sau đăng nhập quay về /claim. Không tự tạo
        tài khoản — email đã xác minh phải khớp lời mời.
      </p>
      <GuestClaimForm />
      <p>
        <Link href="/">← Trang chủ</Link>
      </p>
    </main>
  );
}
