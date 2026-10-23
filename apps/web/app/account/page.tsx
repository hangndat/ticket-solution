import type { Metadata } from 'next';
import Link from 'next/link';
import {
  accountBackLink,
  accountDeletionBlock,
  accountEmbeddedSessionWrap,
  accountRowChevron,
  accountRowLink,
  accountRowSub,
  accountSectionHeading,
  accountSectionTitle,
  accountSettingsGroup,
  accountSettingsNotice,
} from '../../src/account/account-flow-surface';
import { AccountPanel } from './account-panel';
import { AccountShell } from './account-shell';
import { SessionPanel } from './session-panel';

export const metadata: Metadata = {
  title: 'Tài khoản',
  description:
    'Phiên đăng nhập và yêu cầu xóa tài khoản Vemoki.',
};

/** Account settings — sidebar IA + compliance (mockup slice A). */
export default function AccountPage() {
  return (
    <AccountShell
      active="account"
      title="Tài khoản"
      lead="Xem phiên đăng nhập, thông báo và quyền riêng tư. Yêu cầu xóa tài khoản tuân thỏi chính sách dữ liệu."
    >
      <h2 className={accountSectionTitle}>Bạn</h2>
      <div className={accountEmbeddedSessionWrap}>
        <SessionPanel />
      </div>

      <h2 className={accountSectionTitle}>Thông báo</h2>
      <aside className={accountSettingsNotice} role="note">
        <p>
          Vé và cập nhật sự kiện được hiển thị trong tài khoản. Quyền thông báo
          của trình duyệt là thiết lập riêng; bản web này không tự xin quyền khi
          mở trang.
        </p>
      </aside>

      <h2 className={accountSectionTitle} id="privacy-data">
        Quyền riêng tư &amp; dữ liệu
      </h2>
      <div className={accountSettingsGroup}>
        <Link className={accountRowLink} href="/privacy">
          <span>
            Chính sách quyền riêng tư
            <span className={accountRowSub}>Đọc ngay trên website.</span>
          </span>
          <span className={accountRowChevron} aria-hidden="true">›</span>
        </Link>
        <Link
          className={accountRowLink}
          href="/account#account-deletion"
        >
          <span>
            Yêu cầu xóa tài khoản
            <span className={accountRowSub}>
              Gửi yêu cầu theo chính sách — chưa phải xóa ngay.
            </span>
          </span>
          <span className={accountRowChevron} aria-hidden="true">›</span>
        </Link>
      </div>

      <section
        id="account-deletion"
        className={accountDeletionBlock}
        aria-labelledby="account-deletion-title"
      >
        <h2 id="account-deletion-title" className={accountSectionHeading}>
          Yêu cầu xóa tài khoản
        </h2>
        <AccountPanel />
      </section>

      <p className={accountBackLink}>
        <Link href="/">← Trang chủ</Link>
      </p>
    </AccountShell>
  );
}
