'use client';

import { useState, useTransition } from 'react';

type MeCallResult = {
  status: number;
  body: string;
};

/**
 * Identity session — Keycloak OIDC via BFF cookies.
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
        <h2>Session status</h2>
        <p className="intro">
          Access token is stored in an HttpOnly cookie after Authorization Code
          + PKCE against self-hosted Keycloak. Browser never holds the token in
          localStorage.
        </p>
      </section>

      <section className="auth-actions">
        <h2>Actions</h2>
        <div className="auth-buttons">
          <a className="button-link" href="/api/auth/login">
            Sign in (Keycloak)
          </a>
          <button type="button" onClick={callMe} disabled={pending}>
            {pending ? 'Calling GET /v1/me…' : 'GET /v1/me (via BFF)'}
          </button>
          <a className="button-link" href="/api/auth/logout">
            Sign out
          </a>
        </div>
        {meResult ? (
          <pre className="me-result" tabIndex={0}>
            HTTP {meResult.status}
            {'\n'}
            {meResult.body}
          </pre>
        ) : null}
      </section>
    </div>
  );
}
