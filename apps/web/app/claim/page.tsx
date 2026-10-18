import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav } from '../../src/site-chrome';
import { GuestClaimForm } from './claim-form';

/** Client claim form + fragment intent — never SSG a stale empty shell. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Nhận lời mời sự kiện',
  description:
    'Nhận lời mời sự kiện sau khi đăng nhập — email đã xác minh phải khớp lời mời.',
  referrer: 'no-referrer',
};

export default function ClaimPage() {
  return (
    <main id="main" className="container shell redeem-page">
      <SiteNav />
      <h1>Nhận lời mời sự kiện</h1>
      <p className="intro">
        Đây là lời mời khách nhận vé — khác mời thành viên tổ chức. Mở liên kết
        mời, đăng nhập nếu cần, rồi hoàn tất biểu mẫu. Email đã xác minh phải
        khớp lời mời; không tự tạo tài khoản mới.
      </p>
      <GuestClaimForm />
      <p>
        <Link href="/">← Trang chủ</Link>
      </p>
    </main>
  );
}
