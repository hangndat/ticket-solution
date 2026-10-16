import Link from 'next/link';
import { isOidcConfigured, resolveWebAuthState } from '../../src/oidc/config';
import { RedeemForm } from './redeem-form';

/** OIDC + redeem are runtime — never SSG the fail-closed branch. */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Đổi mã lấy vé',
  description:
    'D2 web redeem — form đổi mã, verify, success/ticket qua Nest API thật (BFF Keycloak).',
};

type Props = {
  searchParams: Promise<{ tenantId?: string; eventId?: string }>;
};

export default async function RedeemPage({ searchParams }: Props) {
  const params = await searchParams;
  const configured = isOidcConfigured();
  const state = resolveWebAuthState({ configured, subject: null });

  return (
    <main id="main" className="container shell redeem-page">
      <nav aria-label="Main navigation">
        <Link href="/" className="wordmark">
          ticket<span>↗</span>
        </Link>
        <span className="nav-links">
          <Link href="/auth">Identity POC</Link>
          <Link href="/">Demo events</Link>
        </span>
      </nav>

      <p className="eyebrow">D2 / REDEEM · API THẬT · KHÔNG MOCK</p>
      <h1>Đổi mã lấy vé</h1>
      <p className="intro">
        Multi-tenant: nhập <code>tenantId</code> + <code>eventId</code> (UUID) và
        mã đổi vé. BFF đọc cookie Keycloak và gọi Nest{' '}
        <code>RedeemBodyDto</code> / <code>RedeemResponseDto</code>. Trạng thái
        exhausted / used / timeout hiện rõ từ mã lỗi API.
      </p>

      {!configured ? (
        <aside className="notice auth-unconfigured" role="status">
          <h2>OIDC chưa cấu hình</h2>
          <p>
            Redeem fail closed khi thiếu OIDC — không mock session. Auth state:{' '}
            <strong>
              {state.status} / authenticated={String(state.authenticated)}
            </strong>
            . Cấu hình theo <code>apps/web/.env.example</code>, đăng nhập tại{' '}
            <Link href="/auth">/auth</Link>.
          </p>
        </aside>
      ) : (
        <RedeemForm
          key={`${params.tenantId ?? ''}:${params.eventId ?? ''}`}
          initialTenantId={params.tenantId?.trim() ?? ''}
          initialEventId={params.eventId?.trim() ?? ''}
        />
      )}

      <p>
        <Link href="/">← Demo events</Link>
        {' · '}
        <Link href="/auth">Identity POC</Link>
      </p>
    </main>
  );
}
