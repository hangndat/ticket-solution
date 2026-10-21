import Link from 'next/link';
import styles from './redeem-surface.module.css';

type Props = {
  loginHref: string;
  intentCopy?: boolean;
};

/** Guest-facing login gate — matches mockup narrow redeem/login intent. */
export function RedeemAuthGate({ loginHref, intentCopy = true }: Props) {
  return (
    <section
      className={styles.gateCard}
      aria-labelledby="redeem-auth-gate-title"
      data-testid="redeem-auth-gate"
    >
      <p className="eyebrow">Đăng nhập</p>
      <h2 id="redeem-auth-gate-title">Tiếp tục để đổi mã</h2>
      <p>
        {intentCopy
          ? 'Hoàn tất đăng nhập để tiếp tục đổi mã — sau khi đăng nhập bạn sẽ quay lại trang này.'
          : 'Đăng nhập để đổi mã lấy vé trên Vemoki.'}
      </p>
      <div className={`auth-buttons ${styles.gateActions}`}>
        <a className="button btn-primary" href={loginHref}>
          Tiếp tục đăng nhập
        </a>
        <Link className="button-link button-link-secondary" href="/">
          Về trang chủ
        </Link>
      </div>
    </section>
  );
}
