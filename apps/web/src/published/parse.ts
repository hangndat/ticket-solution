/**
 * Fail-closed parsers for ADR-19 published projections.
 * Mirror iOS `published-event-api` validators — never invent demo as published.
 */

import {
  PUBLISHED_SECTION_KINDS,
  type PublishedEventDetail,
  type PublishedEventListResponse,
  type PublishedEventSummary,
  type PublishedSectionKind,
} from '@ticket/contracts';

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

function isPublishedForm(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (typeof value.formVersion !== 'string' || !value.formVersion) return false;
  if (!Array.isArray(value.fields)) return false;
  const allowed = new Set(['text', 'email', 'phone', 'select', 'checkbox']);
  for (const field of value.fields) {
    if (!isRecord(field)) return false;
    if (typeof field.id !== 'string' || !field.id) return false;
    if (typeof field.label !== 'string') return false;
    if (typeof field.type !== 'string' || !allowed.has(field.type)) return false;
    if (typeof field.required !== 'boolean') return false;
    if (field.options !== undefined) {
      if (!Array.isArray(field.options)) return false;
      for (const opt of field.options) {
        if (
          !isRecord(opt) ||
          typeof opt.id !== 'string' ||
          typeof opt.label !== 'string'
        ) {
          return false;
        }
      }
    }
  }
  return true;
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
    if (
      !isRecord(item) ||
      typeof item.q !== 'string' ||
      typeof item.a !== 'string'
    ) {
      return false;
    }
  }
  if (value.terms !== null && value.terms !== undefined) {
    if (
      !isRecord(value.terms) ||
      typeof value.terms.version !== 'string' ||
      typeof value.terms.bodyMarkdown !== 'string'
    ) {
      return false;
    }
  }
  if (value.form !== undefined && value.form !== null) {
    if (!isPublishedForm(value.form)) return false;
  }
  return isBrand(value.brand);
}

export function parsePublishedEventList(
  value: unknown,
): PublishedEventListResponse | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  if (!value.items.every(isPublishedEventSummary)) return null;
  const nextCursor =
    value.nextCursor === null || typeof value.nextCursor === 'string'
      ? value.nextCursor
      : null;
  return {
    items: value.items as PublishedEventSummary[],
    nextCursor,
  };
}

export function visiblePublishedSections(
  event: PublishedEventDetail,
): PublishedEventDetail['sections'] {
  return [...event.sections]
    .filter((section) => section.visible)
    .sort((a, b) => a.order - b.order);
}

export function assertPublishedSectionKind(
  kind: string,
): kind is PublishedSectionKind {
  return KIND_SET.has(kind);
}
