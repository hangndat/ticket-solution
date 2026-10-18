'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { sanitizePostLoginPath } from '../../src/oidc/post-login';
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

/**
 * Identity session — same-origin cookies via /api/bff/me.
 * Auto-resolves on mount; no debug “Kiểm tra phiên” chrome.
 */
export function AuthSession() {
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [pending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const returnPath = sanitizePostLoginPath(searchParams.get('next'));
  const loginHref = returnPath
    ? `/api/auth/login?return=${encodeURIComponent(returnPath)}`
    : '/api/auth/login';

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
      <div className="auth-session">
        <SurfaceState
          kind="loading"
          title="Đang tải phiên…"
          detail="Đang xác nhận trạng thái đăng nhập."
          testId="auth-session-loading"
        />
      </div>
    );
  }

  if (summary?.kind === 'signed-in') {
    return (
      <div className="auth-session">
        <section className="auth-status" aria-live="polite">
          <h1>Đã đăng nhập</h1>
          <p className="intro">
            {summary.subjectHint
              ? `Bạn đang đăng nhập với ${summary.subjectHint}.`
              : 'Bạn đang có phiên đăng nhập trên thiết bị này.'}
          </p>
        </section>

        <section className="auth-actions">
          <h2>Tiếp theo</h2>
          <div className="auth-buttons">
            <Link className="button-link" href="/redeem">
              Đổi mã lấy vé
            </Link>
            <Link className="button-link" href="/account">
              Tài khoản
            </Link>
            <Link className="button-link" href="/">
              Về trang chủ
            </Link>
            <a className="button-link button-link-secondary" href="/api/auth/logout">
              Đăng xuất
            </a>
          </div>
          <SurfaceState
            kind="empty"
            title="Phiên đang hoạt động"
            detail={
              summary.subjectHint
                ? `Tóm tắt: ${summary.subjectHint}`
                : 'Phiên hợp lệ trên thiết bị này.'
            }
            testId="auth-session-signed-in"
          />
        </section>
      </div>
    );
  }

  if (summary?.kind === 'error') {
    return (
      <div className="auth-session">
        <h1>Đăng nhập</h1>
        <p className="intro">
          Đăng nhập để đổi mã lấy vé, nhận lời mời, hoặc mở khu vực tổ chức. Đây
          không phải cổng kiểm soát vé tại cửa.
        </p>
        <SurfaceState
          kind="error"
          title="Không tải được phiên"
          detail={summary.detail}
          testId="auth-session-error"
          action={
            <div className="auth-buttons">
              <a className="button-link" href={loginHref}>
                Đăng nhập
              </a>
              <Link className="button-link button-link-secondary" href="/">
                Về trang chủ
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="auth-session">
      <section className="auth-status" aria-live="polite">
        <h1>Đăng nhập</h1>
        <p className="intro">
          Đăng nhập để đổi mã lấy vé, nhận lời mời, hoặc mở khu vực tổ chức. Đây
          không phải cổng kiểm soát vé tại cửa.
        </p>
      </section>

      <section className="auth-actions">
        <h2>Thao tác</h2>
        <div className="auth-buttons">
          <a className="button-link" href={loginHref}>
            Đăng nhập
          </a>
          <Link className="button-link button-link-secondary" href="/redeem">
            Đổi mã lấy vé
          </Link>
        </div>
        <SurfaceState
          kind="empty"
          title="Chưa đăng nhập"
          detail="Không có phiên hợp lệ. Bấm «Đăng nhập» để tiếp tục."
          testId="auth-session-signed-out"
        />
      </section>
    </div>
  );
}
