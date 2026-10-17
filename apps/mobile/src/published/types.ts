/**
 * Coordinator-frozen published content DTO (M04 / TD public projection).
 * Mirror until packages/contracts lands — do not invent HTML/JS or draft fields.
 */

export const PUBLISHED_SECTION_KINDS = [
  'hero',
  'info',
  'redeem',
  'guide',
  'faq',
  'terms',
] as const;

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
