'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
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

/** Minimal session chrome (AC-S1) — login / logout on `/account`. */
export function SessionPanel() {
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [pending, startTransition] = useTransition();

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
          setSummary(summarizeMe(response.status, body));
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
        className="notice account-session"
        role="status"
        data-testid="account-session-signed-in"
      >
        <h2>Phiên đăng nhập</h2>
        <p>
          {summary.subjectHint
            ? `Bạn đang đăng nhập với ${summary.subjectHint}.`
            : 'Bạn đang có phiên đăng nhập trên thiết bị này.'}
        </p>
        <p className="auth-buttons">
          <a className="button-link button-link-secondary" href="/api/auth/logout">
            Đăng xuất
          </a>
          <Link className="button-link" href="/redeem">
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
            <a className="button" href={ACCOUNT_LOGIN}>
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
      className="notice account-session"
      role="status"
      data-testid="account-session-signed-out"
    >
      <h2>Chưa đăng nhập</h2>
      <p>Đăng nhập để quản lý phiên hoặc gửi yêu cầu liên quan tài khoản.</p>
      <p className="auth-buttons">
        <a className="button" href={ACCOUNT_LOGIN}>
          Đăng nhập
        </a>
        <Link className="button-link button-link-secondary" href="/">
          Về trang chủ
        </Link>
      </p>
    </section>
  );
}
