import { getApiBaseUrl } from '../identity/config.ts';
import {
  PUBLISHED_SECTION_KINDS,
  type PublishedEventDetail,
  type PublishedEventListResponse,
  type PublishedEventSummary,
  type PublishedSectionKind,
} from './types.ts';

const KIND_SET = new Set<string>(PUBLISHED_SECTION_KINDS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isBrand(value: unknown): value is PublishedEventDetail['brand'] {
  if (!isRecord(value)) return false;
  return (
    typeof value.primaryColor === 'string' &&
    value.primaryColor.length > 0 &&
    typeof value.organizationName === 'string' &&
    value.organizationName.length > 0
  );
}

function isSection(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.kind === 'string' &&
    KIND_SET.has(value.kind) &&
    typeof value.visible === 'boolean' &&
    typeof value.order === 'number'
  );
}

export function isPublishedEventDetail(
  value: unknown,
): value is PublishedEventDetail {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || !value.id) return false;
  if (typeof value.tenantSlug !== 'string' || !value.tenantSlug) return false;
  if (typeof value.slug !== 'string' || !value.slug) return false;
  if (typeof value.name !== 'string' || !value.name) return false;
  if (typeof value.timezone !== 'string' || !value.timezone) return false;
  if (!(value.startsAt === null || typeof value.startsAt === 'string')) {
    return false;
  }
  if (!(value.location === null || typeof value.location === 'string')) {
    return false;
  }
  if (typeof value.publishedConfigVersion !== 'number') return false;
  if (typeof value.schemaVersion !== 'number') return false;
  if (!Array.isArray(value.sections) || !value.sections.every(isSection)) {
    return false;
  }
  if (!Array.isArray(value.faq)) return false;
  for (const item of value.faq) {
    if (!isRecord(item) || typeof item.q !== 'string' || typeof item.a !== 'string') {
      return false;
    }
  }
  if (value.terms !== null) {
    if (
      !isRecord(value.terms) ||
      typeof value.terms.version !== 'string' ||
      typeof value.terms.bodyMarkdown !== 'string'
    ) {
      return false;
    }
  }
  return isBrand(value.brand);
}

export function isPublishedEventSummary(
  value: unknown,
): value is PublishedEventSummary {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    !!value.id &&
    typeof value.tenantSlug === 'string' &&
    !!value.tenantSlug &&
    typeof value.slug === 'string' &&
    !!value.slug &&
    typeof value.name === 'string' &&
    !!value.name &&
    typeof value.timezone === 'string' &&
    !!value.timezone &&
    (value.startsAt === null || typeof value.startsAt === 'string') &&
    (value.location === null || typeof value.location === 'string') &&
    typeof value.publishedConfigVersion === 'number' &&
    typeof value.schemaVersion === 'number' &&
    isBrand(value.brand)
  );
}

export type FetchPublishedDetailResult =
  | { status: 'ok'; event: PublishedEventDetail }
  | { status: 'not-found' }
  | { status: 'unreachable' }
  | { status: 'invalid' }
  | { status: 'misconfigured' };

export type FetchPublishedListResult =
  | { status: 'ok'; body: PublishedEventListResponse }
  | { status: 'unreachable' }
  | { status: 'invalid' }
  | { status: 'misconfigured' };

/**
 * GET /v1/public/tenants/{tenantSlug}/events/{eventSlug}
 * Published-only; 404 for draft/unknown (never invent demo as published).
 */
export async function fetchPublishedEventDetail(
  tenantSlug: string,
  eventSlug: string,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchPublishedDetailResult> {
  const base = getApiBaseUrl();
  if (!base) return { status: 'misconfigured' };
  if (!tenantSlug || !eventSlug) return { status: 'invalid' };
  try {
    const response = await fetchImpl(
      `${base}/v1/public/tenants/${encodeURIComponent(tenantSlug)}/events/${encodeURIComponent(eventSlug)}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal,
      },
    );
    if (response.status === 404) return { status: 'not-found' };
    if (response.status >= 500) return { status: 'unreachable' };
    if (!response.ok) return { status: 'invalid' };
    const json: unknown = await response.json();
    return isPublishedEventDetail(json)
      ? { status: 'ok', event: json }
      : { status: 'invalid' };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { status: 'unreachable' };
    }
    return { status: 'unreachable' };
  }
}

/**
 * GET /v1/public/tenants/{tenantSlug}/events?cursor=&limit=
 */
export async function fetchPublishedEventList(
  tenantSlug: string,
  opts: { cursor?: string | null; limit?: number } = {},
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchPublishedListResult> {
  const base = getApiBaseUrl();
  if (!base) return { status: 'misconfigured' };
  if (!tenantSlug) return { status: 'invalid' };
  try {
    const url = new URL(
      `${base}/v1/public/tenants/${encodeURIComponent(tenantSlug)}/events`,
    );
    if (opts.cursor) url.searchParams.set('cursor', opts.cursor);
    if (opts.limit != null) url.searchParams.set('limit', String(opts.limit));
    const response = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });
    if (response.status >= 500) return { status: 'unreachable' };
    if (!response.ok) return { status: 'invalid' };
    const json: unknown = await response.json();
    if (!isRecord(json) || !Array.isArray(json.items)) return { status: 'invalid' };
    if (!json.items.every(isPublishedEventSummary)) return { status: 'invalid' };
    const nextCursor =
      json.nextCursor === null || typeof json.nextCursor === 'string'
        ? json.nextCursor
        : null;
    return {
      status: 'ok',
      body: {
        items: json.items as PublishedEventSummary[],
        nextCursor,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { status: 'unreachable' };
    }
    return { status: 'unreachable' };
  }
}

export function visibleSectionsInOrder(
  event: PublishedEventDetail,
): PublishedEventDetail['sections'] {
  return [...event.sections]
    .filter((section) => section.visible)
    .sort((a, b) => a.order - b.order);
}

export function assertSectionKind(kind: string): kind is PublishedSectionKind {
  return KIND_SET.has(kind);
}
