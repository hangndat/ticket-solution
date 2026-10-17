'use client';

import { CSRF_COOKIE, CSRF_HEADER } from '../bff/csrf-constants';
import { fetchJson, type FetchJsonResult } from '../redeem/fetch-json';

function readCsrfFromDocument(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]+)`),
  );
  return match?.[1]?.trim() ?? '';
}

/** Same-origin JSON mutation with CSRF double-submit header. */
export async function adminMutate(
  path: string,
  body: unknown,
  timeoutMs: number,
  method: 'POST' | 'PUT' | 'PATCH' = 'POST',
): Promise<FetchJsonResult> {
  const csrf = readCsrfFromDocument();
  return fetchJson(
    path,
    {
      method,
      headers: {
        'Content-Type': 'application/json',
        [CSRF_HEADER]: csrf,
      },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
}

export async function adminGet(
  path: string,
  timeoutMs: number,
): Promise<FetchJsonResult> {
  return fetchJson(path, { method: 'GET' }, timeoutMs);
}
