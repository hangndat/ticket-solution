import { Button } from '@ticket/ui';
import Link from 'next/link';
import { authNoticeFromParam } from '../../../src/oidc/auth-notice';
import { isOidcConfigured, resolveWebAuthState } from '../../../src/oidc/config';
import { readSubject } from '../../../src/oidc/cookies';
import { loginHref } from '../../../src/oidc/login-href';
import { ConsumerPageShell } from '../../../src/consumer-page-shell';
import {
  globalRedeemEntryEnabled,
  isTenantBoundRedeemQuery,
} from '../../../src/redeem/global-entry';
import {
  authButtonsRow,
  redeemAuthNotice,
  redeemFormCard,
  redeemGateCard,
  redeemHeader,
  redeemLead,
  redeemNarrow,
  redeemPageMain,
} from '../../../src/redeem/redeem-surface';
import { cn } from '../../../lib/utils';
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
    <ConsumerPageShell mainClassName={redeemPageMain}>
      <div className={redeemNarrow}>
        <header className={redeemHeader}>
          <h1>Đổi mã lấy vé</h1>
          <p className={redeemLead}>
            Một mã duy nhất. Không cần chọn sự kiện hay tổ chức.
          </p>
        </header>

        {authNotice ? (
          <aside
            className={redeemAuthNotice}
            role="alert"
            data-testid="redeem-auth-notice"
          >
            <h2>{authNotice.title}</h2>
            <p>{authNotice.detail}</p>
            <p className={authButtonsRow}>
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
            className={cn(redeemGateCard, redeemAuthNotice, '[&_code]:text-[0.9em]')}
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
            <p className={authButtonsRow}>
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
      </div>
    </ConsumerPageShell>
  );
}
