'use client';

import { Button } from '@ticket/ui';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useAttendeeLocale } from '../../../src/i18n';
import { invitePageCopy } from '../../../src/invite/invite-copy';
import {
  interpretAcceptInvite,
  type ViewResult,
} from '../../../src/bff/me-shape';
import type { AcceptInviteResponse } from '../../../src/bff/platform-contracts';
import {
  platformGet,
  platformMutate,
} from '../../../src/bff/same-origin-fetch';
import {
  inviteNetworkMessage,
  messageForInviteView,
  type InviteUxMessage,
} from '../../../src/invite/platform-messages';
import {
  authButtonsRow,
  claimFormRoot,
  guestOutcomeWrap,
  inviteFieldHint,
  inviteFormPanel,
  inviteSuccessOutcomeClass,
  inviteSupportCopy,
} from '../../../src/guest/guest-flow-surface';
import { REQUEST_TIMEOUT_MS } from '../../../src/redeem/poll-operation';
import { liveRegionForStatus } from '../../../src/ui/live-region';
import { SurfaceState } from '../../../src/ui/surface-state';
import { portalMigrationLocation } from '../../../src/portal/dual-run';

const STORAGE_KEY = 'vemoki_invite_token';

/**
 * Pure snapshot: invite token from URL fragment (#token=…), then ?token= (legacy
 * email links), then sessionStorage. Never put raw token in query long-term —
 * side effects (persist / clear hash/query) run in an effect, not here.
 */
function getInviteTokenSnapshot(): string {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash) {
    const params = new URLSearchParams(hash);
    const fromHash =
      params.get('token')?.trim() ||
      (hash.includes('=') ? '' : hash.trim());
    if (fromHash) return fromHash;
  }
  try {
    const fromQuery =
      new URLSearchParams(window.location.search).get('token')?.trim() ?? '';
    if (fromQuery) return fromQuery;
  } catch {
    /* ignore */
  }
  try {
    return sessionStorage.getItem(STORAGE_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

function subscribeInviteToken(onStoreChange: () => void): () => void {
  window.addEventListener('hashchange', onStoreChange);
  return () => window.removeEventListener('hashchange', onStoreChange);
}

function persistInviteToken(token: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    /* ignore quota */
  }
  // Clear fragment/query from address bar without reload (avoid Referrer/logs).
  if (window.location.hash || window.location.search) {
    history.replaceState(null, '', window.location.pathname);
  }
}

function surfaceKind(
  ux: InviteUxMessage,
): 'empty' | 'loading' | 'error' | 'unknown' {
  if (ux.kind === 'unknown' || ux.kind === 'network') return 'unknown';
  return 'error';
}

export function InviteAcceptForm({
  portalOrigin,
}: {
  portalOrigin: string | null;
}) {
  const { locale } = useAttendeeLocale();
  const copy = invitePageCopy(locale);
  const locationToken = useSyncExternalStore(
    subscribeInviteToken,
    getInviteTokenSnapshot,
    () => '',
  );
  const [tokenOverride, setTokenOverride] = useState<string | null>(null);
  const token = tokenOverride !== null ? tokenOverride : locationToken;
  const [view, setView] = useState<ViewResult<AcceptInviteResponse> | null>(
    null,
  );
  const [ux, setUx] = useState<InviteUxMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [csrfReady, setCsrfReady] = useState(false);

  // CSRF cookie is issued by GET Route Handlers — not RSC (cookies().set illegal).
  useEffect(() => {
    void (async () => {
      try {
        await platformGet('/api/bff/me/tenants', REQUEST_TIMEOUT_MS);
      } catch {
        /* cookie may still be set before upstream failure */
      } finally {
        setCsrfReady(true);
      }
    })();
  }, []);

  // Park fragment/query into sessionStorage and strip URL — no setState here
  // (react-hooks/set-state-in-effect). Snapshot already reads ?token / #token /
  // sessionStorage; after strip, sessionStorage keeps the value for re-renders.
  useEffect(() => {
    if (!locationToken) return;
    persistInviteToken(locationToken);
  }, [locationToken]);

  async function accept() {
    setBusy(true);
    setView(null);
    setUx(null);
    const result = await platformMutate(
      '/api/bff/me/membership-invites/accept',
      { token: token.trim(), idempotencyKey: crypto.randomUUID() },
      REQUEST_TIMEOUT_MS,
    );
    if (result.networkError || result.timedOut) {
      setUx(inviteNetworkMessage(locale));
      setBusy(false);
      return;
    }
    const next = interpretAcceptInvite(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setView(next);
    setUx(messageForInviteView(next, locale));
    if (next.kind === 'ok') {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setTokenOverride('');
    }
    setBusy(false);
  }

  const loginHref = '/api/auth/login?return=/invite';
  const displayUx = view ? messageForInviteView(view, locale) : ux;
  const outcomeLive =
    displayUx && displayUx.kind !== 'success'
      ? liveRegionForStatus(
          displayUx.kind === 'network' || displayUx.kind === 'unknown'
            ? 'unknown'
            : displayUx.kind === 'auth' || displayUx.kind === 'denied'
              ? 'error'
              : displayUx.kind,
        )
      : displayUx?.kind === 'success'
        ? liveRegionForStatus('success')
        : null;

  return (
    <div className={claimFormRoot}>
      <p className={inviteSupportCopy}>{copy.support}</p>
      <div className={authButtonsRow}>
        <Button asChild variant="primary">
          <a href={loginHref}>{copy.login}</a>
        </Button>
      </div>
      <div className={inviteFormPanel}>
        <label>
          {copy.tokenLabel}
          <input
            value={token}
            onChange={(e) => setTokenOverride(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-label={copy.tokenLabel}
          />
        </label>
        <span className={inviteFieldHint}>{copy.tokenHint}</span>
        {!token.trim() ? (
          <SurfaceState
            kind="empty"
            title={copy.emptyTitle}
            detail={copy.emptyDetail}
            testId="invite-token-empty"
          />
        ) : null}
        <Button
          type="button"
          variant="primary"
          disabled={busy || !token.trim() || !csrfReady}
          loading={busy}
          loadingLabel={copy.accepting}
          onClick={() => void accept()}
          data-testid="invite-accept-submit"
        >
          {csrfReady ? copy.submit : copy.preparing}
        </Button>
      </div>
      {busy ? (
        <div className={guestOutcomeWrap}>
          <SurfaceState
            kind="loading"
            title={copy.loadingTitle}
            detail={copy.loadingDetail}
            testId="invite-accept-loading"
          />
        </div>
      ) : null}
      {displayUx && displayUx.kind === 'success' && view?.kind === 'ok' ? (
        <section
          className={inviteSuccessOutcomeClass()}
          role={outcomeLive?.role ?? 'status'}
          aria-live={outcomeLive?.ariaLive}
          aria-atomic={outcomeLive?.ariaAtomic}
          data-testid="invite-accept-result"
        >
          <h2>{displayUx.title}</h2>
          <p>{displayUx.detail}</p>
          <p className={authButtonsRow}>
            {portalOrigin ? (
              <Button asChild variant="primary">
                <a
                  href={portalMigrationLocation(
                    portalOrigin,
                    '/admin',
                    `?tenantId=${encodeURIComponent(view.value.tenantId)}`,
                  )}
                  data-testid="invite-accept-portal-cta"
                >
                  {copy.openPortal}
                </a>
              </Button>
            ) : null}
          </p>
        </section>
      ) : null}
      {displayUx && displayUx.kind !== 'success' ? (
        <div className={guestOutcomeWrap}>
          <SurfaceState
            kind={surfaceKind(displayUx)}
            title={displayUx.title}
            detail={displayUx.detail}
            testId="invite-accept-result"
          />
        </div>
      ) : null}
    </div>
  );
}
