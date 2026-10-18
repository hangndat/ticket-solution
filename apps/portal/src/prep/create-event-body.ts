import type { CreateEventBodyV2, EventVisibility } from '@ticket/contracts';

const VISIBILITIES: readonly EventVisibility[] = ['PUBLIC', 'UNLISTED'];

export function isEventVisibility(value: unknown): value is EventVisibility {
  return (
    typeof value === 'string' &&
    (VISIBILITIES as readonly string[]).includes(value)
  );
}

/** Allowlisted create body fields (CreateEventBodyV2). */
export function buildCreateEventUpstreamBody(input: {
  slug: string;
  name: string;
  timezone?: string;
  visibility?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  venueName?: string;
  venueAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactUrl?: string;
  redemptionOpensAt?: string | null;
  redemptionClosesAt?: string | null;
  checkInOpensAt?: string | null;
  checkInClosesAt?: string | null;
  maxTicketsPerAttendee?: number | null;
}): CreateEventBodyV2 {
  const body: CreateEventBodyV2 = {
    slug: input.slug.trim(),
    name: input.name.trim(),
  };
  if (input.timezone?.trim()) body.timezone = input.timezone.trim();
  if (isEventVisibility(input.visibility)) body.visibility = input.visibility;
  if (input.startsAt !== undefined) body.startsAt = input.startsAt;
  if (input.endsAt !== undefined) body.endsAt = input.endsAt;
  if (input.venueName?.trim() && input.venueAddress?.trim()) {
    body.venue = {
      name: input.venueName.trim(),
      address: input.venueAddress.trim(),
    };
  }
  const contact: NonNullable<CreateEventBodyV2['contact']> = {};
  if (input.contactEmail?.trim()) contact.email = input.contactEmail.trim();
  if (input.contactPhone?.trim()) contact.phone = input.contactPhone.trim();
  if (input.contactUrl?.trim()) contact.url = input.contactUrl.trim();
  if (Object.keys(contact).length > 0) body.contact = contact;
  if (input.redemptionOpensAt !== undefined) {
    body.redemptionOpensAt = input.redemptionOpensAt;
  }
  if (input.redemptionClosesAt !== undefined) {
    body.redemptionClosesAt = input.redemptionClosesAt;
  }
  if (input.checkInOpensAt !== undefined) {
    body.checkInOpensAt = input.checkInOpensAt;
  }
  if (input.checkInClosesAt !== undefined) {
    body.checkInClosesAt = input.checkInClosesAt;
  }
  if (input.maxTicketsPerAttendee !== undefined) {
    body.maxTicketsPerAttendee = input.maxTicketsPerAttendee;
  }
  return body;
}
