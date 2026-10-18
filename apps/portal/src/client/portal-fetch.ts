'use client';

import { CSRF_COOKIE, CSRF_HEADER } from '../bff/csrf-constants';

export type PortalFetchResult = {
  status: number;
  json: unknown;
  networkError: boolean;
  timedOut: boolean;
};

function readCsrfFromDocument(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]+)`),
  );
  return match?.[1]?.trim() ?? '';
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { _unparsed: true, text: text.slice(0, 200) };
  }
}

/** Same-origin GET — discovery / list reads. */
export async function portalGet(
  path: string,
  timeoutMs = 15_000,
): Promise<PortalFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    });
    return {
      status: res.status,
      json: await parseJsonSafe(res),
      networkError: false,
      timedOut: false,
    };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError';
    return { status: 0, json: null, networkError: true, timedOut };
  } finally {
    clearTimeout(timer);
  }
}

/** Same-origin JSON mutation with CSRF double-submit. */
export async function portalMutate(
  path: string,
  body: unknown,
  method: 'POST' | 'PUT' | 'PATCH' = 'POST',
  timeoutMs = 20_000,
): Promise<PortalFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        [CSRF_HEADER]: readCsrfFromDocument(),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return {
      status: res.status,
      json: await parseJsonSafe(res),
      networkError: false,
      timedOut: false,
    };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError';
    return { status: 0, json: null, networkError: true, timedOut };
  } finally {
    clearTimeout(timer);
  }
}

export function apiErrorCode(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null;
  const code = (json as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

export function apiErrorMessage(json: unknown, fallback: string): string {
  if (!json || typeof json !== 'object') return fallback;
  const message = (json as { message?: unknown }).message;
  return typeof message === 'string' && message.trim()
    ? message.trim()
    : fallback;
}

/**
 * Same-origin multipart mutation (CSV upload) with CSRF double-submit.
 * Do not set Content-Type manually — browser sets multipart boundary.
 */
export async function portalMultipart(
  path: string,
  form: FormData,
  timeoutMs = 60_000,
): Promise<PortalFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        [CSRF_HEADER]: readCsrfFromDocument(),
      },
      body: form,
      signal: controller.signal,
    });
    return {
      status: res.status,
      json: await parseJsonSafe(res),
      networkError: false,
      timedOut: false,
    };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError';
    return { status: 0, json: null, networkError: true, timedOut };
  } finally {
    clearTimeout(timer);
  }
}

/** Binary/stream GET (error CSV / export download). */
export async function portalDownload(
  path: string,
  timeoutMs = 60_000,
): Promise<{
  status: number;
  blob: Blob | null;
  contentType: string | null;
  contentDisposition: string | null;
  networkError: boolean;
  timedOut: boolean;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) {
      return {
        status: res.status,
        blob: null,
        contentType: res.headers.get('Content-Type'),
        contentDisposition: res.headers.get('Content-Disposition'),
        networkError: false,
        timedOut: false,
      };
    }
    return {
      status: res.status,
      blob: await res.blob(),
      contentType: res.headers.get('Content-Type'),
      contentDisposition: res.headers.get('Content-Disposition'),
      networkError: false,
      timedOut: false,
    };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError';
    return {
      status: 0,
      blob: null,
      contentType: null,
      contentDisposition: null,
      networkError: true,
      timedOut,
    };
  } finally {
    clearTimeout(timer);
  }
}
