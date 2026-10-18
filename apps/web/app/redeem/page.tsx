import Link from 'next/link';
import { isOidcConfigured, resolveWebAuthState } from '../../src/oidc/config';
import { SiteNav } from '../../src/site-chrome';
import { RedeemForm } from './redeem-form';

/** OIDC + redeem are runtime — never SSG the fail-closed branch. */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Đổi mã lấy vé',
  description:
    'Đổi mã lấy vé — biểu mẫu và điều khoản của sự kiện; trạng thái chờ / đã cấp / chưa rõ tách rõ.',
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
      <SiteNav />

      <h1>Đổi mã lấy vé</h1>
      <p className="intro">
        Tải biểu mẫu và điều khoản của sự kiện đã xuất bản, nhập mã rồi đồng ý
        điều khoản. Trạng thái chờ duyệt / đã cấp / từ chối / hết hạn / chưa rõ
        được tách rõ — nếu chưa chắc kết quả, bấm «Kiểm tra lại» thay vì gửi mã
        lần nữa.
      </p>

      {!configured ? (
        <aside className="notice auth-unconfigured state-error" role="status">
          <h2>Cần đăng nhập</h2>
          <p>
            Đăng nhập chưa sẵn sàng trên môi trường này — không thể đổi mã.
            {process.env.NODE_ENV !== 'production' ? (
              <>
                {' '}
                (dev: auth={state.status}/
                {String(state.authenticated)}; xem{' '}
                <code>apps/web/.env.example</code>)
              </>
            ) : null}{' '}
            Thử lại sau hoặc vào <Link href="/auth">Đăng nhập</Link>.
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
