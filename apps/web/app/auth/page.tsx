import Link from 'next/link';
import {
  isOidcConfigured,
  resolveWebAuthState,
} from '../../src/oidc/config';
import { SiteNav } from '../../src/site-chrome';
import { AuthSession } from './auth-session';

/** OIDC env is runtime-only — never SSG the fail-closed / configured branch. */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Đăng nhập',
  description:
    'Đăng nhập Vemoki để đổi mã lấy vé hoặc quản lý sự kiện. Không phải cổng kiểm soát vé.',
};

export default function AuthPage() {
  const configured = isOidcConfigured();
  const state = resolveWebAuthState({ configured, subject: null });

  return (
    <main id="main" className="container shell auth-page">
      <SiteNav variant="guest" />

      <h1>Đăng nhập</h1>
      <p className="intro">
        Đăng nhập để đổi mã lấy vé, nhận lời mời, hoặc mở khu vực tổ chức. Đây
        không phải cổng kiểm soát vé tại cửa.
      </p>

      {!configured ? (
        <aside className="notice auth-unconfigured state-error" role="status">
          <h2>Cần đăng nhập</h2>
          <p>
            Đăng nhập chưa sẵn sàng trên môi trường này — không coi là đã đăng
            nhập và không dùng phiên giả.
          </p>
          {process.env.NODE_ENV !== 'production' ? (
            <details className="redeem-meta">
              <summary>Chi tiết kỹ thuật (dev)</summary>
              <p>
                Thiếu <code>OIDC_ISSUER</code>, <code>OIDC_CLIENT_ID</code>,{' '}
                <code>OIDC_CLIENT_SECRET</code> hoặc{' '}
                <code>OIDC_REDIRECT_URI</code>.
              </p>
              <p>
                Auth state:{' '}
                <strong>
                  {state.status} / authenticated={String(state.authenticated)}
                </strong>
              </p>
              <p>
                Sao chép placeholder từ <code>apps/web/.env.example</code> sang{' '}
                <code>.env.local</code> (không commit secret). Khởi động IdP:{' '}
                <code>docker compose up -d keycloak</code>.
              </p>
            </details>
          ) : null}
        </aside>
      ) : (
        <AuthSession />
      )}

      <p>
        <Link href="/">← Trang chủ</Link>
      </p>
    </main>
  );
}
