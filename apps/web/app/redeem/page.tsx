import { Button } from '@ticket/ui';
import Link from 'next/link';
import { authNoticeFromParam } from '../../src/oidc/auth-notice';
import { isOidcConfigured, resolveWebAuthState } from '../../src/oidc/config';
import { readSubject } from '../../src/oidc/cookies';
import { loginHref } from '../../src/oidc/login-href';
import { SiteNav } from '../../src/site-chrome';
import {
  globalRedeemEntryEnabled,
  isTenantBoundRedeemQuery,
} from '../../src/redeem/global-entry';
import {
  redeemFooterLinks,
  redeemFormCard,
  redeemGateCard,
  redeemHeader,
  redeemLead,
  redeemNarrow,
  redeemPageMain,
} from '../../src/redeem/redeem-surface';
import { RedeemAuthGate } from './redeem-auth-gate';
import { RedeemForm } from './redeem-form';

/** OIDC + redeem are runtime — never SSG the fail-closed branch. */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Đổi mã lấy vé',
  description:
    'Nhập một mã đổi vé — không cần chọn sự kiện hay tổ chức. Đăng nhập trước khi đổi mã.',
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
  const subject = await readSubject();
  const authState = resolveWebAuthState({ configured, subject });
  const redeemLogin = loginHref('/redeem');
  const authNotice = authNoticeFromParam(params.notice?.trim(), {
    retryHref: redeemLogin,
  });
  const tenantBound = isTenantBoundRedeemQuery({
    tenantId: params.tenantId,
    eventId: params.eventId,
    tenantSlug: params.tenantSlug,
    eventSlug: params.eventSlug,
  });
  const globalEntry = globalRedeemEntryEnabled({
    tenantId: params.tenantId,
    eventId: params.eventId,
    tenantSlug: params.tenantSlug,
    eventSlug: params.eventSlug,
  });
  const signedIn = authState.authenticated;

  return (
    <main id="main" className={redeemPageMain}>
      <SiteNav />

      <div className={redeemNarrow}>
        <header className={redeemHeader}>
          <h1>Đổi mã lấy vé</h1>
          <p className={redeemLead}>
            Một mã duy nhất. Không cần chọn sự kiện hay tổ chức.
          </p>
        </header>

        {authNotice ? (
          <aside
            className="notice state-error"
            role="alert"
            data-testid="redeem-auth-notice"
          >
            <h2>{authNotice.title}</h2>
            <p>{authNotice.detail}</p>
            <p className="auth-buttons">
              <Button asChild variant="primary">
                <a href={authNotice.retryHref}>Thử lại</a>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/">Về trang chủ</Link>
              </Button>
            </p>
          </aside>
        ) : null}

        {!configured ? (
          <aside
            className={`notice auth-unconfigured state-error ${redeemGateCard}`}
            role="status"
          >
            <h2>Cần đăng nhập</h2>
            <p>
              Đăng nhập chưa sẵn sàng trên môi trường này — không thể đổi mã.
              {process.env.NODE_ENV !== 'production' ? (
                <>
                  {' '}
                  (dev: auth={authState.status}/
                  {String(authState.authenticated)}; xem{' '}
                  <code>apps/web/.env.example</code>)
                </>
              ) : null}
            </p>
            <p className="auth-buttons">
              <Button asChild variant="primary">
                <a href={redeemLogin}>Đăng nhập</a>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/">Về trang chủ</Link>
              </Button>
            </p>
          </aside>
        ) : !signedIn ? (
          <RedeemAuthGate loginHref={redeemLogin} />
        ) : (
          <div className={redeemFormCard}>
            <RedeemForm
              key={`${globalEntry ? 'global' : ''}:${params.tenantId ?? ''}:${params.eventId ?? ''}:${params.tenantSlug ?? ''}:${params.eventSlug ?? ''}`}
              productChrome
              globalEntry={globalEntry}
              tenantBound={tenantBound}
              initialTenantId={params.tenantId?.trim() ?? ''}
              initialEventId={params.eventId?.trim() ?? ''}
              initialTenantSlug={params.tenantSlug?.trim() ?? ''}
              initialEventSlug={params.eventSlug?.trim() ?? ''}
            />
          </div>
        )}

        <p className={redeemFooterLinks}>
          <Link href="/">← Trang chủ</Link>
        </p>
      </div>
    </main>
  );
}
