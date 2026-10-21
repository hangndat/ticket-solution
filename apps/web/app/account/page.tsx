import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountPanel } from './account-panel';
import { AccountShell } from './account-shell';
import styles from './account-settings.module.css';
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
      lead="Xem phiên đăng nhập, thông báo và quyền riêng tư. Yêu cầu xóa tài khoản tuân thủ chính sách dữ liệu."
    >
      <h2 className={styles.sectionTitle}>Bạn</h2>
      <div className={`${styles.group} ${styles.embeddedSession}`}>
        <SessionPanel />
      </div>

      <h2 className={styles.sectionTitle}>Thông báo</h2>
      <aside className={styles.settingsNotice} role="note">
        <p>
          Vé và cập nhật sự kiện được hiển thị trong tài khoản. Quyền thông báo
          của trình duyệt là thiết lập riêng; bản web này không tự xin quyền khi
          mở trang.
        </p>
      </aside>

      <h2 className={styles.sectionTitle} id="privacy-data">
        Quyền riêng tư &amp; dữ liệu
      </h2>
      <div className={styles.group}>
        <Link className={styles.rowLink} href="/privacy">
          <span>
            Chính sách quyền riêng tư
            <span className={styles.rowSub}>Đọc ngay trên website.</span>
          </span>
          <span className={styles.rowChevron} aria-hidden="true">›</span>
        </Link>
        <Link
          className={styles.rowLink}
          href="/account#account-deletion"
        >
          <span>
            Yêu cầu xóa tài khoản
            <span className={styles.rowSub}>
              Gửi yêu cầu theo chính sách — chưa phải xóa ngay.
            </span>
          </span>
          <span className={styles.rowChevron} aria-hidden="true">›</span>
        </Link>
      </div>

      <section
        id="account-deletion"
        className={styles.deletionBlock}
        aria-labelledby="account-deletion-title"
      >
        <h2 id="account-deletion-title" className="account-section-title">
          Yêu cầu xóa tài khoản
        </h2>
        <AccountPanel />
      </section>

      <p className={styles.backHome}>
        <Link href="/">← Trang chủ</Link>
      </p>
    </AccountShell>
  );
}
