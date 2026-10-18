/**
 * Public published-event projection (ADR-19 / O15).
 * Mirrors iOS `apps/mobile/src/published/types.ts` — single contract; do not fork.
 */

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

export const PUBLISHED_EVENT_ENDPOINTS = {
  list: 'GET /public/tenants/:tenantSlug/events',
  detail: 'GET /public/tenants/:tenantSlug/events/:eventSlug',
} as const;
