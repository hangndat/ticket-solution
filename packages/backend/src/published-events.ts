/**
 * ADR-19 — Public published-event projection (fail-closed).
 * Only visibility=PUBLIC + published_config_version; no admin fields.
 */
import {
  CURSOR_PAGE_LIMIT,
  EVENT_CONTENT_SECTION_KINDS,
  type EventBrandSnapshot,
  type EventConfigPayload,
  type EventContentSection,
  type FormDefinition,
  type PublishedBrand,
  type PublishedEventDetail,
  type PublishedEventListResponse,
  type PublishedEventSummary,
  type PublishedFaqItem,
  type PublishedSection,
  type PublishedSectionKind,
  type PublishedTerms,
} from '@ticket/contracts';
import type { Prisma, PrismaClient } from './generated/prisma/client';
import { withPlatformRole } from './platform-context';
import { withTenant } from './tenant-context';

const TENANT_SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/;
const EVENT_SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/;
const KIND_SET = new Set<string>(EVENT_CONTENT_SECTION_KINDS);

export function isValidPublicTenantSlug(slug: string): boolean {
  return TENANT_SLUG_RE.test(slug);
}

export function isValidPublicEventSlug(slug: string): boolean {
  return EVENT_SLUG_RE.test(slug);
}

type TenantRow = { id: string; slug: string };

type EventProjectionRow = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  starts_at: Date | null;
  venue_name: string | null;
  published_config_version: number;
  published_brand_snapshot: EventBrandSnapshot | null;
  schema_version: number;
  payload: EventConfigPayload | Prisma.JsonValue;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function mapBrand(
  snapshot: EventBrandSnapshot | null,
  payloadBrand: EventBrandSnapshot | undefined,
): PublishedBrand {
  const source = snapshot ?? payloadBrand;
  const primaryColor =
    typeof source?.primaryColor === 'string' && source.primaryColor.length > 0
      ? source.primaryColor
      : '#0B3D2E';
  const organizationName =
    typeof source?.organizationName === 'string' &&
    source.organizationName.length > 0
      ? source.organizationName
      : 'Organization';
  return { primaryColor, organizationName };
}

function mapSection(raw: EventContentSection): PublishedSection | null {
  if (!KIND_SET.has(raw.kind)) return null;
  const body = asRecord(raw.body) ?? {};
  const title = typeof body.title === 'string' ? body.title : undefined;
  const bodyMarkdown =
    typeof body.text === 'string'
      ? body.text
      : typeof body.bodyMarkdown === 'string'
        ? body.bodyMarkdown
        : undefined;
  const section: PublishedSection = {
    id: raw.id,
    kind: raw.kind as PublishedSectionKind,
    visible: raw.visible === true,
    order: typeof raw.order === 'number' ? raw.order : 0,
  };
  if (title !== undefined && title.length > 0) section.title = title;
  if (bodyMarkdown !== undefined && bodyMarkdown.length > 0) {
    section.bodyMarkdown = bodyMarkdown;
  }
  return section;
}

function mapFaq(sections: EventContentSection[]): PublishedFaqItem[] {
  const faqSection = sections.find((s) => s.kind === 'faq');
  if (!faqSection) return [];
  const body = asRecord(faqSection.body) ?? {};
  if (!Array.isArray(body.items)) return [];
  const items: PublishedFaqItem[] = [];
  for (const item of body.items) {
    const row = asRecord(item);
    if (!row) continue;
    const q =
      typeof row.q === 'string'
        ? row.q
        : typeof row.question === 'string'
          ? row.question
          : '';
    const a =
      typeof row.a === 'string'
        ? row.a
        : typeof row.answer === 'string'
          ? row.answer
          : '';
    if (q.length > 0 || a.length > 0) items.push({ q, a });
  }
  return items;
}

function mapTerms(
  sections: EventContentSection[],
  payloadTermsVersion: string | undefined,
): PublishedTerms | null {
  const termsSection = sections.find((s) => s.kind === 'terms');
  if (!termsSection) return null;
  const body = asRecord(termsSection.body) ?? {};
  const version =
    typeof body.termsVersion === 'string' && body.termsVersion.length > 0
      ? body.termsVersion
      : typeof payloadTermsVersion === 'string' && payloadTermsVersion.length > 0
        ? payloadTermsVersion
        : '';
  const bodyMarkdown =
    typeof body.text === 'string'
      ? body.text
      : typeof body.bodyMarkdown === 'string'
        ? body.bodyMarkdown
        : '';
  if (!version && !bodyMarkdown) return null;
  return { version: version || '1', bodyMarkdown };
}

function mapForm(payload: EventConfigPayload): FormDefinition | null {
  const form = payload.form;
  if (!form || typeof form !== 'object') return null;
  if (typeof form.formVersion !== 'string' || !Array.isArray(form.fields)) {
    return null;
  }
  return form;
}

function mapSummary(
  tenantSlug: string,
  row: EventProjectionRow,
): PublishedEventSummary {
  const payload = asRecord(row.payload) as unknown as EventConfigPayload | null;
  return {
    id: row.id,
    tenantSlug,
    slug: row.slug,
    name: row.name,
    timezone: row.timezone || 'UTC',
    startsAt: row.starts_at ? row.starts_at.toISOString() : null,
    location: row.venue_name,
    publishedConfigVersion: row.published_config_version,
    schemaVersion: row.schema_version,
    brand: mapBrand(row.published_brand_snapshot, payload?.brand),
  };
}

function mapDetail(
  tenantSlug: string,
  row: EventProjectionRow,
): PublishedEventDetail {
  const payload = (asRecord(row.payload) ??
    {}) as unknown as EventConfigPayload;
  const sectionsRaw = Array.isArray(payload.sections) ? payload.sections : [];
  const sections = sectionsRaw
    .map((s) => mapSection(s as EventContentSection))
    .filter((s): s is PublishedSection => s != null)
    .sort((a, b) => a.order - b.order);
  const summary = mapSummary(tenantSlug, row);
  return {
    ...summary,
    sections,
    faq: mapFaq(sectionsRaw as EventContentSection[]),
    terms: mapTerms(sectionsRaw as EventContentSection[], payload.termsVersion),
    form: mapForm(payload),
  };
}

async function resolveActiveTenantBySlug(
  db: PrismaClient,
  tenantSlug: string,
): Promise<TenantRow | null> {
  if (!isValidPublicTenantSlug(tenantSlug)) return null;
  return withPlatformRole(db, async (tx) => {
    const rows = await tx.$queryRaw<TenantRow[]>`
      SELECT id, slug
      FROM tenants
      WHERE slug = ${tenantSlug}
        AND status = 'ACTIVE'
      LIMIT 1
    `;
    return rows[0] ?? null;
  });
}

/**
 * GET public list — unknown tenant → null (404). Known tenant with none → empty items.
 */
export async function listPublishedEvents(
  db: PrismaClient,
  input: {
    tenantSlug: string;
    cursor?: string | null;
    limit?: number;
  },
): Promise<PublishedEventListResponse | null> {
  const tenant = await resolveActiveTenantBySlug(db, input.tenantSlug);
  if (!tenant) return null;

  const limit = Math.min(
    Math.max(input.limit ?? CURSOR_PAGE_LIMIT.default, CURSOR_PAGE_LIMIT.min),
    CURSOR_PAGE_LIMIT.max,
  );
  const cursor =
    typeof input.cursor === 'string' && input.cursor.trim().length > 0
      ? input.cursor.trim()
      : null;

  return withTenant(db, tenant.id, async (tx) => {
    const take = limit + 1;
    const rows = cursor
      ? await tx.$queryRaw<EventProjectionRow[]>`
          SELECT
            e.id, e.slug, e.name, e.timezone, e.starts_at, e.venue_name,
            e.published_config_version, e.published_brand_snapshot,
            v.schema_version, v.payload
          FROM events e
          INNER JOIN event_config_versions v
            ON v.tenant_id = e.tenant_id
           AND v.event_id = e.id
           AND v.version = e.published_config_version
           AND v.published_at IS NOT NULL
          WHERE e.tenant_id = ${tenant.id}::uuid
            AND e.visibility = 'PUBLIC'
            AND e.content_status = 'PUBLISHED'
            AND e.business_status = 'ACTIVE'
            AND e.published_config_version IS NOT NULL
            AND (
              e.starts_at > (
                SELECT starts_at FROM events
                WHERE tenant_id = ${tenant.id}::uuid AND id = ${cursor}::uuid
              )
              OR (
                e.starts_at IS NOT DISTINCT FROM (
                  SELECT starts_at FROM events
                  WHERE tenant_id = ${tenant.id}::uuid AND id = ${cursor}::uuid
                )
                AND e.id > ${cursor}::uuid
              )
            )
          ORDER BY e.starts_at ASC NULLS LAST, e.id ASC
          LIMIT ${take}
        `
      : await tx.$queryRaw<EventProjectionRow[]>`
          SELECT
            e.id, e.slug, e.name, e.timezone, e.starts_at, e.venue_name,
            e.published_config_version, e.published_brand_snapshot,
            v.schema_version, v.payload
          FROM events e
          INNER JOIN event_config_versions v
            ON v.tenant_id = e.tenant_id
           AND v.event_id = e.id
           AND v.version = e.published_config_version
           AND v.published_at IS NOT NULL
          WHERE e.tenant_id = ${tenant.id}::uuid
            AND e.visibility = 'PUBLIC'
            AND e.content_status = 'PUBLISHED'
            AND e.business_status = 'ACTIVE'
            AND e.published_config_version IS NOT NULL
          ORDER BY e.starts_at ASC NULLS LAST, e.id ASC
          LIMIT ${take}
        `;

    const page = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit ? page[page.length - 1]!.id : null;
    return {
      items: page.map((row) => mapSummary(tenant.slug, row)),
      nextCursor,
    };
  });
}

/**
 * GET public detail — draft / unpublished / wrong tenant / unknown → null (404).
 */
export async function getPublishedEventDetail(
  db: PrismaClient,
  input: { tenantSlug: string; eventSlug: string },
): Promise<PublishedEventDetail | null> {
  if (!isValidPublicEventSlug(input.eventSlug)) return null;
  const tenant = await resolveActiveTenantBySlug(db, input.tenantSlug);
  if (!tenant) return null;

  return withTenant(db, tenant.id, async (tx) => {
    const rows = await tx.$queryRaw<EventProjectionRow[]>`
      SELECT
        e.id, e.slug, e.name, e.timezone, e.starts_at, e.venue_name,
        e.published_config_version, e.published_brand_snapshot,
        v.schema_version, v.payload
      FROM events e
      INNER JOIN event_config_versions v
        ON v.tenant_id = e.tenant_id
       AND v.event_id = e.id
       AND v.version = e.published_config_version
       AND v.published_at IS NOT NULL
      WHERE e.tenant_id = ${tenant.id}::uuid
        AND e.slug = ${input.eventSlug}
        AND e.visibility = 'PUBLIC'
        AND e.content_status = 'PUBLISHED'
        AND e.business_status = 'ACTIVE'
        AND e.published_config_version IS NOT NULL
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return mapDetail(tenant.slug, row);
  });
}
