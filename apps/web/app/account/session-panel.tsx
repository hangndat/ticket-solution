'use client';

import { Button } from '@ticket/ui';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { clearGuestClaimIntent } from '../../src/guest/claim-intent';
import { loginHref } from '../../src/oidc/login-href';
import {
  summarizeBffMeSession,
  type SessionSummary,
} from '../../src/oidc/session-summary';
import { SurfaceState } from '../../src/ui/surface-state';

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
          const next = summarizeBffMeSession(response.status, body);
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
          <Button
            asChild
            variant="secondary"
            className="hover:border-signal hover:bg-signal hover:text-paper"
          >
            <a href="/api/auth/logout" onClick={() => clearParkedClaimOnSessionEnd()}>
              Đăng xuất
            </a>
          </Button>
          <Button asChild variant="primary">
            <Link href="/redeem">Đổi mã lấy vé</Link>
          </Button>
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
            <Button asChild variant="primary">
              <a href={ACCOUNT_LOGIN}>Đăng nhập</a>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/">Về trang chủ</Link>
            </Button>
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
        <Button asChild variant="primary">
          <a href={ACCOUNT_LOGIN}>Đăng nhập</a>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">Về trang chủ</Link>
        </Button>
      </p>
    </section>
  );
}
