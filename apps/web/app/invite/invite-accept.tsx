'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  interpretAcceptInvite,
  type ViewResult,
} from '../../src/platform/shape';
import type { AcceptInviteResponse } from '../../src/platform/contracts';
import {
  platformGet,
  platformMutate,
} from '../../src/platform/client-fetch';
import {
  inviteNetworkMessage,
  messageForInviteView,
  type InviteUxMessage,
} from '../../src/platform/invite-messages';
import { REQUEST_TIMEOUT_MS } from '../../src/redeem/poll-operation';
import { SurfaceState } from '../../src/ui/surface-state';

const STORAGE_KEY = 'vemoki_invite_token';

/**
 * Pure snapshot: invite token from URL fragment (#token=…) then sessionStorage.
 * Never put raw token in query (Referrer / server logs). Side effects (persist /
 * clear hash/query) run in an effect — not here.
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

/** Email links may still use ?token= — park into sessionStorage then strip query. */
function parkQueryTokenIfPresent(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('token')?.trim() ?? '';
    if (!fromQuery) return '';
    persistInviteToken(fromQuery);
    return fromQuery;
  } catch {
    return '';
  }
}

function surfaceKind(
  ux: InviteUxMessage,
): 'empty' | 'loading' | 'error' | 'unknown' {
  if (ux.kind === 'unknown' || ux.kind === 'network') return 'unknown';
  return 'error';
}

export function InviteAcceptForm() {
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

  useEffect(() => {
    const parked = parkQueryTokenIfPresent();
    if (parked) {
      setTokenOverride(parked);
      return;
    }
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
      setUx(inviteNetworkMessage());
      setBusy(false);
      return;
    }
    const next = interpretAcceptInvite(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setView(next);
    setUx(messageForInviteView(next));
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

  return (
    <div className="redeem-form">
      <p>
        Đăng nhập đúng email đã được mời (OIDC verified). Backend kiểm tra
        expiry / single-use / email match — UI không tự cấp quyền.
      </p>
      <div className="auth-buttons">
        <a
          className="button-link"
          href="/api/auth/login?return=/invite"
        >
          Đăng nhập Keycloak
        </a>
      </div>
      <label>
        Token invite (tự lấy từ #fragment — không dán vào query)
        <input
          value={token}
          onChange={(e) => setTokenOverride(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-label="Invite token"
        />
      </label>
      {!token.trim() ? (
        <SurfaceState
          kind="empty"
          title="Chưa có token invite"
          detail="Mở link mời (token trong #fragment) hoặc dán token vào ô trên sau khi đăng nhập đúng email."
          testId="invite-token-empty"
        />
      ) : null}
      <button
        type="button"
        disabled={busy || !token.trim() || !csrfReady}
        onClick={() => void accept()}
        data-testid="invite-accept-submit"
      >
        {busy ? 'Đang nhận…' : 'Nhận invite'}
      </button>
      {busy ? (
        <SurfaceState
          kind="loading"
          title="Đang nhận invite…"
          detail="Backend kiểm tra expiry / single-use / email — UI không tự cấp quyền."
          testId="invite-accept-loading"
        />
      ) : null}
      {ux && ux.kind === 'success' && view?.kind === 'ok' ? (
        <section className="notice" role="status" data-testid="invite-accept-result">
          <p>
            {ux.title}: {ux.detail} Mở{' '}
            <a
              href={`/admin?tenantId=${encodeURIComponent(view.value.tenantId)}`}
            >
              Admin
            </a>
            .
          </p>
        </section>
      ) : null}
      {ux && ux.kind !== 'success' ? (
        <SurfaceState
          kind={surfaceKind(ux)}
          title={ux.title}
          detail={ux.detail}
          testId="invite-accept-result"
        />
      ) : null}
    </div>
  );
}
