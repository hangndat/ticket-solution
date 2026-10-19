/**
 * Public published-event projection (ADR-19 / O15).
 * Mirrors iOS `apps/mobile/src/published/types.ts` — single contract; do not fork.
 */

import type { CursorPage } from './common';
import type { FormDefinition } from './redemption-forms';
import { EVENT_CONTENT_SECTION_KINDS } from './config';

export const PUBLISHED_SECTION_KINDS = EVENT_CONTENT_SECTION_KINDS;

export type PublishedSectionKind = (typeof PUBLISHED_SECTION_KINDS)[number];

export type PublishedSection = {
  id: string;
  kind: PublishedSectionKind;
  visible: boolean;
  order: number;
  title?: string;
  bodyMarkdown?: string;
};

export type PublishedFaqItem = { q: string; a: string };

export type PublishedTerms = {
  version: string;
  bodyMarkdown: string;
};

export type PublishedBrand = {
  primaryColor: string;
  organizationName: string;
  logoUrl?: string;
  bannerUrl?: string;
  contact?: string;
};

/** Full published event page — server projection only. */
export type PublishedEventDetail = {
  id: string;
  tenantSlug: string;
  slug: string;
  name: string;
  timezone: string;
  /** Null when legacy metadata missing — never invent a date. */
  startsAt: string | null;
  location: string | null;
  publishedConfigVersion: number;
  schemaVersion: number;
  sections: PublishedSection[];
  faq: PublishedFaqItem[];
  terms: PublishedTerms | null;
  /** C-F published form — absent/null means no client fields required. */
  form?: FormDefinition | null;
  brand: PublishedBrand;
};

/** List row — no sections/faq/terms. */
export type PublishedEventSummary = {
  id: string;
  tenantSlug: string;
  slug: string;
  name: string;
  timezone: string;
  startsAt: string | null;
  location: string | null;
  publishedConfigVersion: number;
  schemaVersion: number;
  brand: PublishedBrand;
};

export type PublishedEventListResponse = {
  items: PublishedEventSummary[];
  nextCursor: string | null;
};

/** Alias for cursor list pages (K-API-01 / per-tenant ADR-19 list). */
export type PublishedEventListPage = CursorPage<PublishedEventSummary>;

/**
 * Query for platform or per-tenant published list endpoints.
 * `limit` clamped server-side to {@link CURSOR_PAGE_LIMIT}; invalid cursor → 400.
 */
export interface PublishedEventListQuery {
  cursor?: string;
  /** 1–100, default 20. */
  limit?: number;
}

/**
 * Stable sort for platform catalog (O18 / ARCHITECTURE §4.1).
 * `nextCursor` is opaque to clients; encodes position after this ordering.
 */
export const PLATFORM_PUBLISHED_EVENT_LIST_ORDER =
  'starts_at ASC NULLS LAST, tenant_id ASC, id ASC' as const;

/** OpenAPI path — merge into `apps/api/openapi.json` on BE implement (MPR-T1). */
export const PLATFORM_PUBLISHED_EVENTS_OPENAPI_PATH = '/v1/public/events' as const;

/** Nest/Swagger operationId for K-API-01. */
export const PLATFORM_PUBLISHED_EVENTS_OPERATION_ID =
  'PlatformPublishedEventsController_list' as const;

export const PUBLISHED_EVENT_ENDPOINTS = {
  /** Platform-wide PUBLIC published catalog (O18). */
  platformList: 'GET /public/events',
  list: 'GET /public/tenants/:tenantSlug/events',
  detail: 'GET /public/tenants/:tenantSlug/events/:eventSlug',
} as const;
