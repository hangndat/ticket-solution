import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav } from '../../src/site-chrome';
import { InviteAcceptForm } from './invite-accept';

export const metadata: Metadata = {
  title: 'Nhận lời mời thành viên',
  description:
    'Nhận lời mời tham gia tổ chức — đăng nhập đúng email đã được mời.',
  referrer: 'no-referrer',
};

export default function InvitePage() {
  return (
    <main id="main" className="lp-container shell redeem-page invite-page">
      <SiteNav />
      <header className="invite-header">
        <h1>Nhận lời mời thành viên</h1>
        <p className="intro">
          Đây là lời mời tham gia tổ chức — khác lời mời nhận vé sự kiện. Mở
          liên kết mời, đăng nhập nếu cần, rồi xác nhận mã. Email đăng nhập phải
          khớp email được mời; giao diện không tự cấp quyền quản trị.
        </p>
      </header>
      <InviteAcceptForm />
      <p>
        <Link href="/">← Trang chủ</Link>
      </p>
    </main>
  );
}
