import type { TicketSummary } from '@ticket/contracts';

const metadataFields = ['venueName', 'ticketTypeLabel', 'eventTimezone', 'bannerUrl'] as const;

/** Older owner responses and caches omit these additive fields. */
export function hasValidOwnerMetadata(row: Record<string, unknown>): boolean {
  return metadataFields.every((field) => row[field] == null || typeof row[field] === 'string');
}

export function ownerText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

/** Only public HTTPS images from the owner projection may render in the wallet. */
export function ownerBannerUrl(ticket: TicketSummary): string | null {
  const value = ownerText(ticket.bannerUrl);
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function ownerEventTimezone(ticket: TicketSummary): string | null {
  const value = ownerText(ticket.eventTimezone);
  if (!value) return null;
  try {
    new Intl.DateTimeFormat('vi-VN', { timeZone: value });
    return value;
  } catch {
    return null;
  }
}
