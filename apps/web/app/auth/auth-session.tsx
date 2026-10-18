'use client';

import { useState, useTransition } from 'react';
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
    detail: 'Không kiểm tra được phiên lúc này. Thử lại sau.',
  };
}

/**
 * Identity session — same-origin cookies (HttpOnly).
 * Session lives in cookies; /api/bff/me uses the server cookie.
 */
export function AuthSession() {
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [pending, startTransition] = useTransition();

  function callMe() {
    startTransition(async () => {
      setSummary(null);
      try {
        const response = await fetch('/api/bff/me', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const body = await response.text();
        setSummary(summarizeMe(response.status, body));
      } catch {
        setSummary({
          kind: 'error',
          detail: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
        });
      }
    });
  }

  return (
    <div className="auth-session">
      <section className="auth-status" aria-live="polite">
        <h2>Trạng thái phiên</h2>
        <p className="intro">
          Phiên đăng nhập được lưu an toàn trên máy chủ (cookie HttpOnly). Trình
          duyệt không giữ token trong localStorage.
        </p>
      </section>

      <section className="auth-actions">
        <h2>Thao tác</h2>
        <div className="auth-buttons">
          <a className="button-link" href="/api/auth/login">
            Đăng nhập
          </a>
          <button type="button" onClick={callMe} disabled={pending}>
            {pending ? 'Đang kiểm tra phiên…' : 'Kiểm tra phiên'}
          </button>
          <a className="button-link" href="/api/auth/logout">
            Đăng xuất
          </a>
        </div>
        {pending ? (
          <SurfaceState
            kind="loading"
            title="Đang kiểm tra phiên…"
            detail="Chưa khẳng định đã đăng nhập cho đến khi có kết quả."
            testId="auth-session-loading"
          />
        ) : null}
        {summary?.kind === 'signed-in' ? (
          <SurfaceState
            kind="empty"
            title="Đã đăng nhập"
            detail={
              summary.subjectHint
                ? `Phiên đang hoạt động (${summary.subjectHint}).`
                : 'Phiên đang hoạt động trên thiết bị này.'
            }
            testId="auth-session-signed-in"
          />
        ) : null}
        {summary?.kind === 'signed-out' ? (
          <SurfaceState
            kind="empty"
            title="Chưa đăng nhập"
            detail="Không có phiên hợp lệ. Bấm «Đăng nhập» để tiếp tục."
            testId="auth-session-signed-out"
          />
        ) : null}
        {summary?.kind === 'error' ? (
          <SurfaceState
            kind="error"
            title="Không kiểm tra được phiên"
            detail={summary.detail}
            testId="auth-session-error"
          />
        ) : null}
      </section>
    </div>
  );
}
