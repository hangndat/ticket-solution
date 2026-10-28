'use client';

import { CSRF_COOKIE, CSRF_HEADER } from './csrf-constants';
import { fetchJson, type FetchJsonResult } from '../redeem/fetch-json';

function readCookie(): string {
  if (typeof document === 'undefined') return '';
  return (
    document.cookie
      .match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]+)`))?.[1]
      ?.trim() ?? ''
  );
}

// Browser-module state only: deduplicate concurrent bootstrap requests.
let bootstrap: Promise<FetchJsonResult> | null = null;
async function ensureCookie(timeoutMs: number): Promise<FetchJsonResult> {
  bootstrap ??= fetchJson(
    '/api/bff/csrf',
    { method: 'GET' },
    timeoutMs,
  ).finally(() => {
    bootstrap = null;
  });
  return bootstrap;
}

/** Retry only the BFF's pre-mutation CSRF rejection, with the same command body. */
export async function csrfJsonMutation(
  path: string,
  body: unknown,
  timeoutMs: number,
  method: 'POST' | 'PUT' | 'PATCH' = 'POST',
): Promise<FetchJsonResult> {
  if (readCookie().length < 32) {
    const ready = await ensureCookie(timeoutMs);
    if (ready.status !== 200 || ready.networkError || ready.timedOut)
      return ready;
  }
  const serialized = JSON.stringify(body);
  const send = () =>
    fetchJson(
      path,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          [CSRF_HEADER]: readCookie(),
        },
        body: serialized,
      },
      timeoutMs,
    );
  const result = await send();
  if (
    result.status !== 403 ||
    !result.json ||
    typeof result.json !== 'object' ||
    (result.json as { code?: unknown }).code !== 'CSRF_TOKEN_INVALID'
  )
    return result;
  const ready = await ensureCookie(timeoutMs);
  if (ready.status !== 200 || ready.networkError || ready.timedOut)
    return result;
  return send();
}
