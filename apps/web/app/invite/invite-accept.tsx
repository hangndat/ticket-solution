'use client';

import { useEffect, useState } from 'react';
import {
  interpretAcceptInvite,
  viewLabel,
  type ViewResult,
} from '../../src/platform/shape';
import type { AcceptInviteResponse } from '../../src/platform/contracts';
import { platformMutate } from '../../src/platform/client-fetch';
import { REQUEST_TIMEOUT_MS } from '../../src/redeem/poll-operation';

const STORAGE_KEY = 'vemoki_invite_token';

/**
 * Invite token prefers URL fragment (#token=…) then sessionStorage.
 * Never put raw token in query (Referrer / server logs).
 */
function readTokenFromLocation(): string {
  if (typeof window === 'undefined') return '';
  const hash = window.location.hash.replace(/^#/, '');
  if (hash) {
    const params = new URLSearchParams(hash);
    const fromHash =
      params.get('token')?.trim() ||
      (hash.includes('=') ? '' : hash.trim());
    if (fromHash) {
      try {
        sessionStorage.setItem(STORAGE_KEY, fromHash);
      } catch {
        /* ignore quota */
      }
      // Clear fragment from address bar without reload.
      history.replaceState(null, '', window.location.pathname);
      return fromHash;
    }
  }
  try {
    return sessionStorage.getItem(STORAGE_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

export function InviteAcceptForm() {
  const [token, setToken] = useState('');
  const [view, setView] = useState<ViewResult<AcceptInviteResponse> | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(readTokenFromLocation());
  }, []);

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
      setToken('');
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
          onChange={(e) => setToken(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-label="Invite token"
        />
      </label>
      <button
        type="button"
        disabled={busy || !token.trim()}
        onClick={() => void accept()}
      >
        Nhận invite
      </button>
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
