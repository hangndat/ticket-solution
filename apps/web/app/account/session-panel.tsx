'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { clearGuestClaimIntent } from '../../src/guest/claim-intent';
import { loginHref } from '../../src/oidc/login-href';
import { SurfaceState } from '../../src/ui/surface-state';

type SessionSummary =
  | { kind: 'signed-in'; subjectHint: string | null }
  | { kind: 'signed-out' }
  | { kind: 'error'; detail: string };

function summarizeMe(status: number, body: string): SessionSummary {
  if (status === 401 || status === 403) {
    return { kind: 'signed-out' };
  }
  if (status >= 200 && status < 300) {
    let subjectHint: string | null = null;
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      const subject =
        typeof parsed.sub === 'string'
          ? parsed.sub
          : typeof parsed.email === 'string'
            ? parsed.email
            : typeof parsed.subject === 'string'
              ? parsed.subject
              : null;
      if (subject && subject.trim()) {
        const s = subject.trim();
        subjectHint = s.includes('@')
          ? s
          : s.length > 12
            ? `${s.slice(0, 8)}…`
            : s;
      }
    } catch {
      subjectHint = null;
    }
    return { kind: 'signed-in', subjectHint };
  }
  if (status === 0) {
    return {
      kind: 'error',
      detail: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
    };
  }
  return {
    kind: 'error',
    detail: 'Không tải được trạng thái phiên lúc này. Thử lại sau.',
  };
}

const ACCOUNT_LOGIN = loginHref('/account');

function clearParkedClaimOnSessionEnd() {
  clearGuestClaimIntent();
}

/** Account session chrome — Live Pulse full visual (AC-A1 / AC-A2 / AC-C3). */
export function SessionPanel() {
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [pending, startTransition] = useTransition();
  const wasSignedIn = useRef(false);

  useEffect(() => {
    let cancelled = false;
    startTransition(async () => {
      try {
        const response = await fetch('/api/bff/me', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const body = await response.text();
        if (!cancelled) {
          const next = summarizeMe(response.status, body);
          if (wasSignedIn.current && next.kind === 'signed-out') {
            clearParkedClaimOnSessionEnd();
          }
          if (next.kind === 'signed-in') {
            wasSignedIn.current = true;
          }
          setSummary(next);
        }
      } catch {
        if (!cancelled) {
          setSummary({
            kind: 'error',
            detail: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
          });
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (pending && summary === null) {
    return (
      <SurfaceState
        kind="loading"
        title="Đang xử lý…"
        detail="Đang xác nhận trạng thái đăng nhập."
        testId="account-session-loading"
      />
    );
  }

  if (summary?.kind === 'signed-in') {
    return (
      <section
        className="account-session account-session--ready"
        role="status"
        aria-live="polite"
        data-testid="account-session-signed-in"
      >
        <p className="eyebrow">Phiên</p>
        <h2>Bạn đang đăng nhập</h2>
        <p className="account-session__email">
          {summary.subjectHint
            ? summary.subjectHint
            : 'Phiên đã xác minh trên thiết bị này.'}
        </p>
        <p className="auth-buttons account-session__actions">
          <a
            className="button-link button-link-secondary account-cta-logout"
            href="/api/auth/logout"
            onClick={() => clearParkedClaimOnSessionEnd()}
          >
            Đăng xuất
          </a>
          <Link className="button account-cta-primary" href="/redeem">
            Đổi mã lấy vé
          </Link>
        </p>
      </section>
    );
  }

  if (summary?.kind === 'error') {
    return (
      <SurfaceState
        kind="error"
        title="Không tải được phiên"
        detail={summary.detail}
        testId="account-session-error"
        action={
          <div className="auth-buttons">
            <a className="button account-cta-primary" href={ACCOUNT_LOGIN}>
              Đăng nhập
            </a>
            <Link className="button-link button-link-secondary" href="/">
              Về trang chủ
            </Link>
          </div>
        }
      />
    );
  }

  return (
    <section
      className="account-session account-session--signed-out"
      role="status"
      aria-live="polite"
      data-testid="account-session-signed-out"
    >
      <p className="eyebrow">Phiên</p>
      <h2>Chưa đăng nhập</h2>
      <p>Đăng nhập để quản lý phiên hoặc gửi yêu cầu liên quan tài khoản.</p>
      <p className="auth-buttons account-session__actions">
        <a className="button account-cta-primary" href={ACCOUNT_LOGIN}>
          Đăng nhập
        </a>
        <Link className="button-link button-link-secondary" href="/">
          Về trang chủ
        </Link>
      </p>
    </section>
  );
}
