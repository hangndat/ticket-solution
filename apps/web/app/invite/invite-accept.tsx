'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  interpretAcceptInvite,
  viewLabel,
  type ViewResult,
} from '../../src/platform/shape';
import type { AcceptInviteResponse } from '../../src/platform/contracts';
import { platformMutate } from '../../src/platform/client-fetch';
import { REQUEST_TIMEOUT_MS } from '../../src/redeem/poll-operation';
import { SurfaceState } from '../../src/ui/surface-state';

const STORAGE_KEY = 'vemoki_invite_token';

/**
 * Pure snapshot: invite token from URL fragment (#token=…) then sessionStorage.
 * Never put raw token in query (Referrer / server logs). Side effects (persist /
 * clear hash) run in an effect — not here.
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
  // Clear fragment from address bar without reload.
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname);
  }
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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!locationToken) return;
    persistInviteToken(locationToken);
  }, [locationToken]);

  async function accept() {
    setBusy(true);
    setView(null);
    const result = await platformMutate(
      '/api/bff/me/membership-invites/accept',
      { token: token.trim(), idempotencyKey: crypto.randomUUID() },
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretAcceptInvite(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setView(next);
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
        <a className="button-link" href="/api/auth/login">
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
        disabled={busy || !token.trim()}
        onClick={() => void accept()}
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
      {view ? (
        <section
          className={
            view.kind === 'rejected'
              ? 'redeem-status redeem-status--error'
              : 'notice'
          }
          role="status"
          data-testid="invite-accept-result"
        >
          {view.kind === 'ok' ? (
            <p>
              Đã nhận membership {view.value.membershipId} · tenant{' '}
              {view.value.tenantId} · status {view.value.status}. Mở{' '}
              <a href={`/admin?tenantId=${encodeURIComponent(view.value.tenantId)}`}>
                Admin
              </a>
              .
            </p>
          ) : (
            <p>{viewLabel(view)}</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
