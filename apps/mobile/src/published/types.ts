/**
 * Published-event DTOs (ADR-19).
 * Prefer `@ticket/contracts` types landed with #261 — do not fork shapes here.
 * Runtime `PUBLISHED_SECTION_KINDS` stays local so Node unit tests work without
 * a built `packages/contracts/dist` workspace link; keep in sync with contracts.
 */

export type {
  PublishedSectionKind,
  PublishedSection,
  PublishedFaqItem,
  PublishedTerms,
  PublishedBrand,
  PublishedEventDetail,
  PublishedEventSummary,
  PublishedEventListResponse,
} from '@ticket/contracts';

/** Must match `EVENT_CONTENT_SECTION_KINDS` / `PUBLISHED_SECTION_KINDS` in contracts. */
export const PUBLISHED_SECTION_KINDS = [
  'hero',
  'info',
  'redeem',
  'guide',
  'faq',
  'terms',
] as const;
