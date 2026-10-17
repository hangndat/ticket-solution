import Link from 'next/link';
import {
  isOidcConfigured,
  resolveWebAuthState,
} from '../../src/oidc/config';
import { SiteNav } from '../../src/site-chrome';
import { AuthPoc } from './auth-poc';

/** OIDC env is runtime-only — never SSG the fail-closed / configured branch. */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Đăng nhập',
  description:
    'Đăng nhập Keycloak + BFF cookie (OIDC). Không phải cổng kiểm soát vé production.',
};

export default function AuthPocPage() {
  const configured = isOidcConfigured();
  const state = resolveWebAuthState({ configured, subject: null });

  return (
    <main id="main" className="container shell auth-page">
      <SiteNav variant="guest" />

      <h1>Đăng nhập</h1>
      <p className="intro">
        Phiên web qua Keycloak tự host: cookie HttpOnly, Authorization Code +
        PKCE, BFF same-origin cho <code>GET /v1/me</code>. Không dùng trang này
        làm kiểm soát vé live. Không IdP SaaS.
      </p>

      {!configured ? (
        <aside className="notice auth-unconfigured state-error" role="status">
          <h2>OIDC chưa cấu hình</h2>
          <p>
            Thiếu <code>OIDC_ISSUER</code>, <code>OIDC_CLIENT_ID</code>,{' '}
            <code>OIDC_CLIENT_SECRET</code> hoặc <code>OIDC_REDIRECT_URI</code>.
            Fail closed — không coi là đã đăng nhập, không mock user.
          </p>
          <p>
            Auth state:{' '}
            <strong>
              {state.status} / authenticated={String(state.authenticated)}
            </strong>
          </p>
          <p>
            Sao chép placeholder từ <code>apps/web/.env.example</code> sang{' '}
            <code>.env.local</code> (không commit secret). Khởi động Keycloak:{' '}
            <code>docker compose up -d keycloak</code>.
          </p>
        </aside>
      ) : (
        <AuthPoc />
      )}

      <p>
        <Link href="/">← Trang chủ</Link>
      </p>
    </main>
  );
}
