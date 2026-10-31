import { isOidcConfigured, resolveWebAuthState } from '../../../src/oidc/config';
import { readSubject } from '../../../src/oidc/cookies';
import { redeemLoginHref } from '../../../src/redeem/login-href';
import { ConsumerPageShell } from '../../../src/consumer-page-shell';
import {
  globalRedeemEntryEnabled,
  isTenantBoundRedeemQuery,
} from '../../../src/redeem/global-entry';
import {
  redeemAuthNotice,
  redeemGateCard,
  redeemNarrow,
  redeemPageMain,
} from '../../../src/redeem/redeem-surface';
import { ATTENDEE_COPY } from '../../../src/attendee-copy';
import { cn } from '../../../lib/utils';
import { RedeemAuthGate } from './redeem-auth-gate';
import { RedeemVerifiedBoundary } from './redeem-verified-boundary';
import {
  RedeemAuthNoticePanel,
  RedeemOidcDown,
  RedeemPageHeader,
} from './redeem-page-chrome';

/** OIDC + redeem are runtime — never SSG the fail-closed branch. */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: ATTENDEE_COPY.redeemTitle,
  description: ATTENDEE_COPY.redeemEyebrow,
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
  const redeemLogin = redeemLoginHref(params);
  const noticeKey = params.notice?.trim() ?? '';
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
        <RedeemPageHeader />

        {noticeKey ? (
          <RedeemAuthNoticePanel notice={noticeKey} retryHref={redeemLogin} />
        ) : null}

        {!configured ? (
          <aside
            className={cn(redeemGateCard, redeemAuthNotice, '[&_code]:text-[0.9em]')}
            role="status"
          >
            <RedeemOidcDown
              loginHref={redeemLogin}
              devStatus={
                process.env.NODE_ENV !== 'production'
                  ? ` (dev: auth=${authState.status}/${String(authState.authenticated)}; xem apps/web/.env.example)`
                  : null
              }
            />
          </aside>
        ) : !signedIn ? (
          <RedeemAuthGate loginHref={redeemLogin} />
        ) : (
          <RedeemVerifiedBoundary
            loginHref={redeemLogin}
            key={`${globalEntry ? 'global' : ''}:${params.tenantId ?? ''}:${params.eventId ?? ''}:${params.tenantSlug ?? ''}:${params.eventSlug ?? ''}`}
            productChrome
            globalEntry={globalEntry}
            tenantBound={tenantBound}
            initialTenantId={params.tenantId?.trim() ?? ''}
            initialEventId={params.eventId?.trim() ?? ''}
            initialTenantSlug={params.tenantSlug?.trim() ?? ''}
            initialEventSlug={params.eventSlug?.trim() ?? ''}
          />
        )}
      </div>
    </ConsumerPageShell>
  );
}
