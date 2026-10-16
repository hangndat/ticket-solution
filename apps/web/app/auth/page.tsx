import Link from 'next/link';
import {
  isOidcConfigured,
  resolveWebAuthState,
} from '../../src/oidc/config';
import { BrandMark } from '../../src/brand-mark';
import { AuthPoc } from './auth-poc';

/** OIDC env is runtime-only — never SSG the fail-closed / configured branch. */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Identity POC (Keycloak)',
  description:
    'D1 OIDC POC — self-hosted Keycloak + BFF cookie. Not production authentication.',
};

export default function AuthPocPage() {
  const configured = isOidcConfigured();
  const state = resolveWebAuthState({ configured, subject: null });

  return (
    <main id="main" className="container shell auth-page">
      <nav aria-label="Main navigation">
        <Link href="/" className="wordmark">
          <BrandMark />
          vemoki<span>↗</span>
        </Link>
        <Link href="/">Demo events</Link>
      </nav>

      <p className="eyebrow">D1 / IDENTITY POC · NOT PRODUCTION AUTH</p>
      <h1>Keycloak web session</h1>
      <p className="intro">
        Proof-of-concept for self-hosted OIDC on Next.js App Router: HttpOnly
        session cookies via Authorization Code + PKCE and same-origin BFF for{' '}
        <code>GET /v1/me</code>. Do not treat this page as live ticketing access
        control. No SaaS IdP.
      </p>

      {!configured ? (
        <aside className="notice auth-unconfigured" role="status">
          <h2>OIDC chưa cấu hình</h2>
          <p>
            Thiếu <code>OIDC_ISSUER</code>, <code>OIDC_CLIENT_ID</code>,{' '}
            <code>OIDC_CLIENT_SECRET</code> hoặc <code>OIDC_REDIRECT_URI</code>.
            POC fail closed — không coi là đã đăng nhập, không mock user.
          </p>
          <p>
            Auth state:{' '}
            <strong>
              {state.status} / authenticated={String(state.authenticated)}
            </strong>
          </p>
          <p>
            Copy placeholders from <code>apps/web/.env.example</code> into a
            local <code>.env.local</code> (never commit real secrets). Start
            Keycloak via Compose: <code>docker compose up -d keycloak</code>.
          </p>
        </aside>
      ) : (
        <AuthPoc />
      )}

      <p>
        <Link href="/">← Return to demo events</Link>
      </p>
    </main>
  );
}
