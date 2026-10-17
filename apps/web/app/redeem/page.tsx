import Link from 'next/link';
import { isOidcConfigured, resolveWebAuthState } from '../../src/oidc/config';
import { SiteNav } from '../../src/site-chrome';
import { RedeemForm } from './redeem-form';

/** OIDC + redeem are runtime — never SSG the fail-closed branch. */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Đổi mã lấy vé',
  description:
    'Đổi mã lấy vé — form/terms published, trạng thái phân biệt qua Nest BFF.',
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
      <SiteNav variant="guest" />

      <h1>Đổi mã lấy vé</h1>
      <p className="intro">
        Tải form và điều khoản từ event đã publish, gửi câu trả lời cùng đồng ý
        qua BFF (CSRF). Trạng thái chờ / đã cấp / từ chối / hết hạn / chưa biết
        được tách rõ — timeout giữ cùng idempotency-key.
      </p>

      {!configured ? (
        <aside className="notice auth-unconfigured state-error" role="status">
          <h2>OIDC chưa cấu hình</h2>
          <p>
            Đổi mã fail closed khi thiếu OIDC — không mock session. Auth state:{' '}
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
        <Link href="/">← Trang chủ</Link>
        {' · '}
        <Link href="/auth">Đăng nhập</Link>
      </p>
    </main>
  );
}
