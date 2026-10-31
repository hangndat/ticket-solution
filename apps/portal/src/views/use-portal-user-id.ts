'use client';

import { useEffect, useState } from 'react';
import { portalGet } from '../client/portal-fetch';

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
      try {
        const res = await portalGet('/api/bff/me/subject', SUBJECT_REQUEST_TIMEOUT_MS);
        if (cancelled) return;
        if (res.status === 401) {
          setState({ status: 'unauthenticated' });
          return;
        }
        if (res.status !== 200) {
          setState({ status: 'error' });
          return;
        }
        const json: unknown = res.json;
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
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
