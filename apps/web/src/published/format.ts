import type { PublishedEventSummary } from '@ticket/contracts';

export function publishedEventHref(
  event: Pick<PublishedEventSummary, 'tenantSlug' | 'slug'>,
): string {
  return `/t/${encodeURIComponent(event.tenantSlug)}/events/${encodeURIComponent(event.slug)}`;
}

/**
 * Format startsAt in the event timezone. Null/invalid → null (never invent).
 */
export function formatPublishedEventDate(
  startsAt: string | null,
  timezone: string,
): string | null {
  if (!startsAt) return null;
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: timezone || 'UTC',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(date);
  }
}

/** Explicit demo label when seed/org name carries the D9 marker. */
export function isExplicitDemoLabel(...parts: Array<string | null | undefined>): boolean {
  return parts.some((p) => typeof p === 'string' && p.includes('· Demo'));
}

/** Prefer hero section title/body for eyebrow / intro when present. */
export function heroCopyFromSections(
  sections: ReadonlyArray<{
    kind: string;
    visible: boolean;
    order: number;
    title?: string;
    bodyMarkdown?: string;
  }>,
): { eyebrow: string | null; intro: string | null } {
  const hero = [...sections]
    .filter((s) => s.visible && s.kind === 'hero')
    .sort((a, b) => a.order - b.order)[0];
  if (!hero) return { eyebrow: null, intro: null };
  return {
    eyebrow: hero.title?.trim() || null,
    intro: hero.bodyMarkdown?.trim() || null,
  };
}
