import { createHash } from 'node:crypto';
import type { EventDetail } from '@ticket/contracts';
import type { Prisma } from './generated/prisma/client';

export type EventRow = {
  id: string;
  tenant_id: string;
  slug: string;
  name: string;
  content_status: string;
  business_status: string;
  visibility: string;
  timezone: string;
  starts_at: Date | null;
  ends_at: Date | null;
  venue_name: string | null;
  venue_address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_url: string | null;
  redemption_opens_at: Date | null;
  redemption_closes_at: Date | null;
  check_in_opens_at: Date | null;
  check_in_closes_at: Date | null;
  revision: number;
  max_tickets_per_attendee: number | null;
};

export function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function mapEventDetail(row: EventRow): EventDetail {
  const venue =
    row.venue_name && row.venue_address
      ? { name: row.venue_name, address: row.venue_address }
      : null;
  const contact =
    row.contact_email || row.contact_phone || row.contact_url
      ? {
          ...(row.contact_email ? { email: row.contact_email } : {}),
          ...(row.contact_phone ? { phone: row.contact_phone } : {}),
          ...(row.contact_url ? { url: row.contact_url } : {}),
        }
      : null;
  return {
    eventId: row.id,
    tenantId: row.tenant_id,
    slug: row.slug,
    name: row.name,
    contentStatus: row.content_status as EventDetail['contentStatus'],
    businessStatus: row.business_status as EventDetail['businessStatus'],
    visibility: row.visibility as EventDetail['visibility'],
    timezone: row.timezone,
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    venue,
    contact,
    redemptionWindow: {
      opensAt: iso(row.redemption_opens_at),
      closesAt: iso(row.redemption_closes_at),
    },
    checkInWindow: {
      opensAt: iso(row.check_in_opens_at),
      closesAt: iso(row.check_in_closes_at),
    },
    revision: row.revision,
    maxTicketsPerAttendee: row.max_tickets_per_attendee,
  };
}

/** Deterministic event id so create/clone can replay via operations unique key. */
export function deterministicEventId(parts: string[]): string {
  const digest = createHash('sha256').update(parts.join('|')).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function selectEvent(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
  forUpdate = false,
): Promise<EventRow | undefined> {
  if (forUpdate) {
    const rows = await tx.$queryRaw<EventRow[]>`
      SELECT id, tenant_id, slug, name, content_status, business_status, visibility,
             timezone, starts_at, ends_at, venue_name, venue_address,
             contact_email, contact_phone, contact_url,
             redemption_opens_at, redemption_closes_at,
             check_in_opens_at, check_in_closes_at,
             revision, max_tickets_per_attendee
      FROM events
      WHERE tenant_id = ${tenantId}::uuid AND id = ${eventId}::uuid
      FOR UPDATE
    `;
    return rows[0];
  }
  const rows = await tx.$queryRaw<EventRow[]>`
    SELECT id, tenant_id, slug, name, content_status, business_status, visibility,
           timezone, starts_at, ends_at, venue_name, venue_address,
           contact_email, contact_phone, contact_url,
           redemption_opens_at, redemption_closes_at,
           check_in_opens_at, check_in_closes_at,
           revision, max_tickets_per_attendee
    FROM events
    WHERE tenant_id = ${tenantId}::uuid AND id = ${eventId}::uuid
  `;
  return rows[0];
}
