import Link from 'next/link';
import { authNoticeFromParam } from '../../src/oidc/auth-notice';
import { isOidcConfigured, resolveWebAuthState } from '../../src/oidc/config';
import { loginHref } from '../../src/oidc/login-href';
import { SiteNav } from '../../src/site-chrome';
import { globalRedeemEntryEnabled } from '../../src/redeem/global-entry';
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
    notice?: string;
  }>;
};

export default async function RedeemPage({ searchParams }: Props) {
  const params = await searchParams;
  const configured = isOidcConfigured();
  const state = resolveWebAuthState({ configured, subject: null });
  const redeemLogin = loginHref('/redeem');
  const authNotice = authNoticeFromParam(params.notice?.trim(), {
    retryHref: redeemLogin,
  });
  const globalEntry = globalRedeemEntryEnabled({
    tenantId: params.tenantId,
    eventId: params.eventId,
    tenantSlug: params.tenantSlug,
    eventSlug: params.eventSlug,
  });

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

      {authNotice ? (
        <aside
          className="notice state-error"
          role="alert"
          data-testid="redeem-auth-notice"
        >
          <h2>{authNotice.title}</h2>
          <p>{authNotice.detail}</p>
          <p className="auth-buttons">
            <a className="button" href={authNotice.retryHref}>
              Thử lại
            </a>
            <Link className="button-link button-link-secondary" href="/">
              Về trang chủ
            </Link>
          </p>
        </aside>
      ) : null}

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
            ) : null}
          </p>
          <p className="auth-buttons">
            <a className="button" href={redeemLogin}>
              Đăng nhập
            </a>
            <Link className="button-link button-link-secondary" href="/">
              Về trang chủ
            </Link>
          </p>
        </aside>
      ) : (
        <RedeemForm
          key={`${globalEntry ? 'global' : ''}:${params.tenantId ?? ''}:${params.eventId ?? ''}:${params.tenantSlug ?? ''}:${params.eventSlug ?? ''}`}
          globalEntry={globalEntry}
          initialTenantId={params.tenantId?.trim() ?? ''}
          initialEventId={params.eventId?.trim() ?? ''}
          initialTenantSlug={params.tenantSlug?.trim() ?? ''}
          initialEventSlug={params.eventSlug?.trim() ?? ''}
        />
      )}

      <p>
        <Link href="/">← Trang chủ</Link>
        {' · '}
        <a href={redeemLogin}>Đăng nhập</a>
      </p>
    </main>
  );
}
