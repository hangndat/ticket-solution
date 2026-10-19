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
import { liveRegionForStatus } from '../../src/ui/live-region';
import { SurfaceState } from '../../src/ui/surface-state';

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

  const loginHref = '/api/auth/login?return=/invite';
  const outcomeLive =
    ux && ux.kind !== 'success'
      ? liveRegionForStatus(
          ux.kind === 'network' || ux.kind === 'unknown'
            ? 'unknown'
            : ux.kind === 'auth' || ux.kind === 'denied'
              ? 'error'
              : ux.kind,
        )
      : ux?.kind === 'success'
        ? liveRegionForStatus('success')
        : null;

  return (
    <div className="redeem-form invite-form">
      <p className="invite-support">
        Đăng nhập bằng đúng email đã được mời. Máy chủ kiểm tra hết hạn, dùng
        một lần và khớp email — giao diện không tự cấp quyền Owner.
      </p>
      <div className="auth-buttons">
        <a className="button-link invite-login-cta" href={loginHref}>
          Đăng nhập
        </a>
      </div>
      <div className="invite-form-panel">
        <label>
          Mã lời mời
          <input
            value={token}
            onChange={(e) => setTokenOverride(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-label="Mã lời mời"
          />
        </label>
        <span className="invite-field-hint">
          Mở link mời (mã nằm sau # trên URL) — tránh dán mã dạng ?token= trên
          thanh địa chỉ.
        </span>
        {!token.trim() ? (
          <SurfaceState
            kind="empty"
            title="Chưa có mã lời mời"
            detail="Mở link mời hoặc dán mã vào ô trên sau khi đăng nhập đúng email."
            testId="invite-token-empty"
          />
        ) : null}
        <button
          type="button"
          className="invite-submit"
          disabled={busy || !token.trim() || !csrfReady}
          onClick={() => void accept()}
          data-testid="invite-accept-submit"
        >
          {busy ? 'Đang nhận…' : csrfReady ? 'Nhận lời mời' : 'Đang chuẩn bị…'}
        </button>
      </div>
      {busy ? (
        <div className="invite-outcome">
          <SurfaceState
            kind="loading"
            title="Đang nhận lời mời…"
            detail="Máy chủ đang kiểm tra hết hạn, dùng một lần và khớp email — chưa coi là thành công."
            testId="invite-accept-loading"
          />
        </div>
      ) : null}
      {ux && ux.kind === 'success' && view?.kind === 'ok' ? (
        <section
          className="redeem-status redeem-status--success invite-outcome"
          role={outcomeLive?.role ?? 'status'}
          aria-live={outcomeLive?.ariaLive}
          aria-atomic={outcomeLive?.ariaAtomic}
          data-testid="invite-accept-result"
        >
          <h2>{ux.title}</h2>
          <p>{ux.detail}</p>
          <p className="auth-buttons">
            <a
              className="button invite-admin-cta"
              href={`/admin?tenantId=${encodeURIComponent(view.value.tenantId)}`}
            >
              Mở Admin
            </a>
          </p>
        </section>
      ) : null}
      {ux && ux.kind !== 'success' ? (
        <div className="invite-outcome">
          <SurfaceState
            kind={surfaceKind(ux)}
            title={ux.title}
            detail={ux.detail}
            testId="invite-accept-result"
          />
        </div>
      ) : null}
    </div>
  );
}
