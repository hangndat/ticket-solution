'use client';

import { useEffect, useState } from 'react';

const SUBJECT_REQUEST_TIMEOUT_MS = 8_000;

type SubjectState =
  | { status: 'loading' }
  | { status: 'ready'; userId: string }
  | { status: 'unauthenticated' }
  | { status: 'error' };

/**
 * Resolve staff OIDC subject for local prefs isolation (userId+tenantId).
 */
export function usePortalUserId(): SubjectState {
  const [state, setState] = useState<SubjectState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        SUBJECT_REQUEST_TIMEOUT_MS,
      );
      try {
        const res = await fetch('/api/bff/me/subject', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        if (cancelled) return;
        if (res.status === 401) {
          setState({ status: 'unauthenticated' });
          return;
        }
        if (!res.ok) {
          setState({ status: 'error' });
          return;
        }
        const json: unknown = await res.json();
        const userId =
          typeof json === 'object' &&
          json !== null &&
          typeof (json as { userId?: unknown }).userId === 'string'
            ? (json as { userId: string }).userId.trim()
            : '';
        if (!userId) {
          setState({ status: 'error' });
          return;
        }
        setState({ status: 'ready', userId });
      } catch {
        if (!cancelled) setState({ status: 'error' });
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
