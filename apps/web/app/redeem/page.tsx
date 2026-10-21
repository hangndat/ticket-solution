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
import { RedeemAuthGate } from './redeem-auth-gate';
import { RedeemForm } from './redeem-form';
import styles from './redeem-surface.module.css';

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
    <main id="main" className="container shell redeem-page">
      <SiteNav />

      <div className={styles.narrow}>
        <header className={styles.header}>
          <h1>Đổi mã lấy vé</h1>
          <p className={styles.lead}>
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
              <a className="button btn-primary" href={authNotice.retryHref}>
                Thử lại
              </a>
              <Link className="button-link button-link-secondary" href="/">
                Về trang chủ
              </Link>
            </p>
          </aside>
        ) : null}

        {!configured ? (
          <aside
            className={`notice auth-unconfigured state-error ${styles.gateCard}`}
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
              <a className="button btn-primary" href={redeemLogin}>
                Đăng nhập
              </a>
              <Link className="button-link button-link-secondary" href="/">
                Về trang chủ
              </Link>
            </p>
          </aside>
        ) : !signedIn ? (
          <RedeemAuthGate loginHref={redeemLogin} />
        ) : (
          <div className={styles.formCard}>
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

        <p className={styles.footerLinks}>
          <Link href="/">← Trang chủ</Link>
        </p>
      </div>
    </main>
  );
}
