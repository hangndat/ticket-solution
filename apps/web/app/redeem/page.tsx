import Link from 'next/link';
import { isOidcConfigured, resolveWebAuthState } from '../../src/oidc/config';
import { RedeemForm } from './redeem-form';

/** OIDC + redeem are runtime — never SSG the fail-closed branch. */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Đổi mã lấy vé',
  description:
    'F-WEB redeem — published form/terms, pending/status discriminated UX qua Nest BFF.',
};

type Props = {
  searchParams: Promise<{
    tenantId?: string;
    eventId?: string;
    tenantSlug?: string;
    eventSlug?: string;
  }>;
};

export default async function RedeemPage({ searchParams }: Props) {
  const params = await searchParams;
  const configured = isOidcConfigured();
  const state = resolveWebAuthState({ configured, subject: null });
  // CSRF cookie is issued by GET BFF route handlers (e.g. public published
  // schema), not RSC render — cookies().set is illegal in Server Components.

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

      <p className="eyebrow">F-WEB / REDEEM · FORM PUBLISHED · C-F</p>
      <h1>Đổi mã lấy vé</h1>
      <p className="intro">
        Tải form/terms từ event published, gửi answers + consent qua BFF CSRF.
        Trạng thái pending / issued / rejected / expired / unknown tách biệt —
        timeout giữ cùng idempotency-key.
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
          key={`${params.tenantId ?? ''}:${params.eventId ?? ''}:${params.tenantSlug ?? ''}:${params.eventSlug ?? ''}`}
          initialTenantId={params.tenantId?.trim() ?? ''}
          initialEventId={params.eventId?.trim() ?? ''}
          initialTenantSlug={params.tenantSlug?.trim() ?? ''}
          initialEventSlug={params.eventSlug?.trim() ?? ''}
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
