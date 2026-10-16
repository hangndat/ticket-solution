'use client';

import {
  SignIn,
  SignOutButton,
  Show,
  useAuth,
  useUser,
} from '@clerk/nextjs';
import { useState, useTransition } from 'react';

type MeCallResult = {
  status: number;
  body: string;
};

/**
 * D1 identity POC controls — only rendered when Clerk is configured.
 * Session lives in Clerk HttpOnly cookies; /api/bff/me uses the server session.
 */
export function AuthPoc() {
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth();
  const { user } = useUser();
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

  const sessionLabel = !isLoaded
    ? 'Loading session…'
    : isSignedIn
      ? 'Signed in (Clerk session cookie)'
      : 'Signed out';

  return (
    <div className="auth-poc">
      <section className="auth-status" aria-live="polite">
        <h2>Session status</h2>
        <dl>
          <div>
            <dt>State</dt>
            <dd>{sessionLabel}</dd>
          </div>
          <div>
            <dt>userId</dt>
            <dd>{isSignedIn ? userId : '—'}</dd>
          </div>
          <div>
            <dt>sessionId</dt>
            <dd>{isSignedIn ? sessionId : '—'}</dd>
          </div>
          <div>
            <dt>email</dt>
            <dd>
              {isSignedIn
                ? (user?.primaryEmailAddress?.emailAddress ?? '—')
                : '—'}
            </dd>
          </div>
        </dl>
      </section>

      <Show when="signed-out">
        <section>
          <h2>Sign in (POC)</h2>
          <p className="intro">
            Email OTP or magic link as configured in the Clerk dashboard. Tokens
            stay in HttpOnly session cookies — not localStorage.
          </p>
          <SignIn
            routing="hash"
            forceRedirectUrl="/auth"
            fallbackRedirectUrl="/auth"
          />
        </section>
      </Show>

      <Show when="signed-in">
        <section className="auth-actions">
          <h2>Authenticated actions</h2>
          <p className="intro">
            Call the Nest API through the same-origin BFF. The server reads the
            Clerk session and sends <code>Authorization: Bearer</code> upstream.
          </p>
          <div className="auth-buttons">
            <button type="button" onClick={callMe} disabled={pending}>
              {pending ? 'Calling GET /v1/me…' : 'GET /v1/me (via BFF)'}
            </button>
            <SignOutButton redirectUrl="/auth">
              <button type="button">Sign out</button>
            </SignOutButton>
          </div>
          {meResult ? (
            <pre className="me-result" tabIndex={0}>
              HTTP {meResult.status}
              {'\n'}
              {meResult.body}
            </pre>
          ) : null}
        </section>
      </Show>
    </div>
  );
}
