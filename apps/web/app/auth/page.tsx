import Link from 'next/link';
import {
  isClerkConfigured,
  resolveWebAuthState,
} from '../../src/clerk/config';
import { AuthPoc } from './auth-poc';

export const metadata = {
  title: 'Identity POC (Clerk)',
  description:
    'D1 OIDC POC — Clerk session cookie BFF. Not production authentication.',
};

export default function AuthPocPage() {
  const configured = isClerkConfigured();
  const state = resolveWebAuthState({ configured, userId: null });

  return (
    <main id="main" className="container shell auth-page">
      <nav aria-label="Main navigation">
        <Link href="/" className="wordmark">
          ticket<span>↗</span>
        </Link>
        <Link href="/">Demo events</Link>
      </nav>

      <p className="eyebrow">D1 / IDENTITY POC · NOT PRODUCTION AUTH</p>
      <h1>Clerk web session</h1>
      <p className="intro">
        Proof-of-concept for managed OIDC on Next.js App Router: HttpOnly
        session cookies via Clerk + same-origin BFF for <code>GET /v1/me</code>.
        Do not treat this page as live ticketing access control.
      </p>

      {!configured ? (
        <aside className="notice auth-unconfigured" role="status">
          <h2>OIDC chưa cấu hình</h2>
          <p>
            Thiếu <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> hoặc{' '}
            <code>CLERK_SECRET_KEY</code>. POC fail closed — không coi là đã
            đăng nhập, không mock user.
          </p>
          <p>
            Auth state:{' '}
            <strong>
              {state.status} / authenticated={String(state.authenticated)}
            </strong>
          </p>
          <p>
            Copy placeholders from <code>apps/web/.env.example</code> into a
            local <code>.env.local</code> (never commit real keys).
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
