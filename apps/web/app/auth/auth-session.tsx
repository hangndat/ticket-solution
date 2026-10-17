'use client';

import { useState, useTransition } from 'react';

type MeCallResult = {
  status: number;
  body: string;
};

/**
 * Identity session — OIDC via same-origin cookies.
 * Session lives in HttpOnly cookies; /api/bff/me uses the server cookie.
 */
export function AuthSession() {
  const [meResult, setMeResult] = useState<MeCallResult | null>(null);
  const [pending, startTransition] = useTransition();

  function callMe() {
    startTransition(async () => {
      setMeResult(null);
      const response = await fetch('/api/bff/me', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const body = await response.text();
      setMeResult({ status: response.status, body });
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
        {meResult ? (
          <details className="redeem-meta" open>
            <summary>Kết quả kiểm tra phiên</summary>
            <pre className="me-result" tabIndex={0}>
              HTTP {meResult.status}
              {'\n'}
              {meResult.body}
            </pre>
          </details>
        ) : null}
      </section>
    </div>
  );
}
