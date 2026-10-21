import type { CreateEventBodyV2 } from '@ticket/contracts';
import { EventError, EVENT_ERROR_CODES } from './event-error';

export const EVENT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const MAX_EVENT_NAME = 200;
export const MAX_VENUE_NAME = 200;
export const MAX_VENUE_ADDRESS = 500;
export const MAX_CONTACT = 254;
export const MAX_CANCEL_REASON = 500;

export function assertValidSlug(slug: string): string {
  const trimmed = slug.trim().toLowerCase();
  if (!trimmed || trimmed.length > 64 || !SLUG_RE.test(trimmed)) {
    throw new EventError(EVENT_ERROR_CODES.INVALID_SLUG, 'Invalid event slug');
  }
  return trimmed;
}

export function assertValidTimezone(timezone: string): string {
  const trimmed = timezone.trim();
  if (!trimmed || trimmed.length > 64) {
    throw new EventError(
      EVENT_ERROR_CODES.INVALID_TIMEZONE,
      'Invalid IANA timezone',
    );
  }
  try {
    Intl.DateTimeFormat('en-US', { timeZone: trimmed });
  } catch {
    throw new EventError(
      EVENT_ERROR_CODES.INVALID_TIMEZONE,
      'Invalid IANA timezone',
    );
  }
  return trimmed;
}

export function parseUtcInstant(
  value: string | null | undefined,
  field: string,
): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) {
    throw new EventError(
      EVENT_ERROR_CODES.INVALID_WINDOW,
      `${field} must be UTC ISO-8601 with offset`,
    );
  }
  if (!/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed)) {
    throw new EventError(
      EVENT_ERROR_CODES.INVALID_WINDOW,
      `${field} must include timezone offset or Z`,
    );
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new EventError(
      EVENT_ERROR_CODES.INVALID_WINDOW,
      `${field} is not a valid instant`,
    );
  }
  return date;
}

export function assertWindowOrder(
  opensAt: Date | null | undefined,
  closesAt: Date | null | undefined,
  label: string,
): void {
  if (
    opensAt instanceof Date &&
    closesAt instanceof Date &&
    !(closesAt > opensAt)
  ) {
    throw new EventError(
      EVENT_ERROR_CODES.INVALID_WINDOW,
      `${label} closesAt must be after opensAt`,
    );
  }
}

export function assertVisibility(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value !== 'PUBLIC' && value !== 'UNLISTED') {
    throw new EventError(
      EVENT_ERROR_CODES.INVALID_VISIBILITY,
      'visibility must be PUBLIC or UNLISTED',
    );
  }
  return value;
}

export function normalizeVenue(
  venue: CreateEventBodyV2['venue'],
): { name: string; address: string } | null | undefined {
  if (venue === undefined) return undefined;
  if (venue === null) return null;
  const name = venue.name?.trim() ?? '';
  const address = venue.address?.trim() ?? '';
  if (
    !name ||
    !address ||
    name.length > MAX_VENUE_NAME ||
    address.length > MAX_VENUE_ADDRESS
  ) {
    throw new EventError(
      EVENT_ERROR_CODES.INVALID_METADATA,
      'venue requires bounded name and address',
    );
  }
  return { name, address };
}

export function normalizeContact(
  contact: CreateEventBodyV2['contact'],
): { email?: string; phone?: string; url?: string } | null | undefined {
  if (contact === undefined) return undefined;
  if (contact === null) return null;
  const email = contact.email?.trim();
  const phone = contact.phone?.trim();
  const url = contact.url?.trim();
  if (!email && !phone && !url) return null;
  if (
    (email && email.length > MAX_CONTACT) ||
    (phone && phone.length > MAX_CONTACT) ||
    (url && url.length > MAX_CONTACT)
  ) {
    throw new EventError(
      EVENT_ERROR_CODES.INVALID_METADATA,
      'contact fields exceed bound',
    );
  }
  return {
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(url ? { url } : {}),
  };
}

export function venueEquals(
  a: { name: string; address: string } | null,
  b: { name: string; address: string } | null,
): boolean {
  if (a === null && b === null) return true;
  if (!a || !b) return false;
  return a.name === b.name && a.address === b.address;
}
