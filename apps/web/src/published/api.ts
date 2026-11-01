/**
 * Server-side loaders for published public events (ADR-19).
 * Calls Nest directly (SSR/ISR) — never falls back to client fixtures.
 */

import type {
  PublishedEventDetail,
  PublishedEventListResponse,
} from '@ticket/contracts';
import { apiBaseUrl } from '../bff/upstream';
import {
  isPublishedEventDetail,
  parsePublishedEventList,
} from './parse';

export type LoadPublishedDetailResult =
  | { status: 'ok'; event: PublishedEventDetail }
  | { status: 'not-found' }
  | { status: 'rate-limited' }
  | { status: 'unreachable' }
  | { status: 'invalid' };

export type LoadPublishedListResult =
  | { status: 'ok'; body: PublishedEventListResponse }
  | { status: 'rate-limited' }
  | { status: 'unreachable' }
  | { status: 'invalid' };

const DEFAULT_REVALIDATE_SECONDS = 60;

function nestFetchInit(revalidateSeconds: number): RequestInit & {
  next?: { revalidate: number };
} {
  if (revalidateSeconds <= 0) {
    return { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' };
  }
  return {
    method: 'GET',
    headers: { Accept: 'application/json' },
    next: { revalidate: revalidateSeconds },
  };
}

/**
 * GET /v1/public/tenants/{tenantSlug}/events/{eventSlug}
 */
export async function loadPublishedEventDetail(
  tenantSlug: string,
  eventSlug: string,
  opts: {
    fetchImpl?: typeof fetch;
    env?: NodeJS.ProcessEnv;
    revalidateSeconds?: number;
  } = {},
): Promise<LoadPublishedDetailResult> {
  const t = tenantSlug.trim();
  const e = eventSlug.trim();
  if (!t || !e) return { status: 'invalid' };

  const base = apiBaseUrl(opts.env);
  const url = `${base}/v1/public/tenants/${encodeURIComponent(t)}/events/${encodeURIComponent(e)}`;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const revalidate = opts.revalidateSeconds ?? DEFAULT_REVALIDATE_SECONDS;

  try {
    const response = await fetchImpl(url, nestFetchInit(revalidate));
    if (response.status === 404) return { status: 'not-found' };
    if (response.status === 429) return { status: 'rate-limited' };
    if (response.status >= 500) return { status: 'unreachable' };
    if (!response.ok) return { status: 'invalid' };
    const json: unknown = await response.json();
    return isPublishedEventDetail(json)
      ? { status: 'ok', event: json }
      : { status: 'invalid' };
  } catch {
    return { status: 'unreachable' };
  }
}

/**
 * GET /v1/public/tenants/{tenantSlug}/events?cursor=&limit=
 */
export async function loadPublishedEventList(
  tenantSlug: string,
  opts: {
    cursor?: string | null;
    limit?: number;
    fetchImpl?: typeof fetch;
    env?: NodeJS.ProcessEnv;
    revalidateSeconds?: number;
  } = {},
): Promise<LoadPublishedListResult> {
  const t = tenantSlug.trim();
  if (!t) return { status: 'invalid' };

  const base = apiBaseUrl(opts.env);
  const url = new URL(
    `${base}/v1/public/tenants/${encodeURIComponent(t)}/events`,
  );
  if (opts.cursor) url.searchParams.set('cursor', opts.cursor);
  if (opts.limit != null) url.searchParams.set('limit', String(opts.limit));

  const fetchImpl = opts.fetchImpl ?? fetch;
  const revalidate = opts.revalidateSeconds ?? DEFAULT_REVALIDATE_SECONDS;

  try {
    const response = await fetchImpl(url.toString(), nestFetchInit(revalidate));
    if (response.status === 429) return { status: 'rate-limited' };
    if (response.status >= 500) return { status: 'unreachable' };
    if (!response.ok) return { status: 'invalid' };
    const json: unknown = await response.json();
    const body = parsePublishedEventList(json);
    return body ? { status: 'ok', body } : { status: 'invalid' };
  } catch {
    return { status: 'unreachable' };
  }
}
