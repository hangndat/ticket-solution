import type { PublishedEventDetail } from './types.ts';

/** Collapse threshold for long prose (characters). */
export const EVENT_DETAIL_COLLAPSE_CHARS = 280;

export type EventDetailModel = {
  title: string;
  /** "20 tháng 3, 2027 lúc 10:00 GMT+7" — null when startsAt missing. */
  whenLine: string | null;
  venue: string | null;
  organizer: string | null;
  about: string | null;
  redeemHint: string | null;
  guide: string | null;
  faq: { q: string; a: string }[];
  terms: { version: string | null; body: string } | null;
  contact: string | null;
};

function clean(value: string | null | undefined): string | null {
  const t = value?.trim() ?? '';
  return t.length > 0 ? t : null;
}

export function formatEventWhen(
  startsAt: string | null,
  timezone: string,
): string | null {
  if (!startsAt) return null;
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return null;
  try {
    const opts = { timeZone: timezone } as const;
    const day = new Intl.DateTimeFormat('vi', {
      ...opts,
      dateStyle: 'long',
    }).format(date);
    const time = new Intl.DateTimeFormat('vi', {
      ...opts,
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(date);
    return `${day} · ${time}`;
  } catch {
    return null;
  }
}

function joinBodies(
  sections: PublishedEventDetail['sections'],
  kinds: readonly string[],
): string | null {
  const parts = sections
    .filter((s) => s.visible && kinds.includes(s.kind))
    .sort((a, b) => a.order - b.order)
    .map((s) => clean(s.bodyMarkdown))
    .filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join('\n\n') : null;
}

/** Pure projection of what the attendee needs; empty fields are omitted. */
export function buildEventDetailModel(
  event: PublishedEventDetail,
): EventDetailModel {
  const orgRaw = clean(event.brand.organizationName);
  const organizer =
    orgRaw && orgRaw.toLowerCase() !== event.name.trim().toLowerCase()
      ? orgRaw
      : null;
  const termsBody = clean(event.terms?.bodyMarkdown);
  return {
    title: event.name,
    whenLine: formatEventWhen(event.startsAt, event.timezone),
    venue: clean(event.location),
    organizer,
    about: joinBodies(event.sections, ['hero', 'info']),
    redeemHint: joinBodies(event.sections, ['redeem']),
    guide: joinBodies(event.sections, ['guide']),
    faq: event.faq.filter((f) => clean(f.q) && clean(f.a)),
    terms: termsBody
      ? { version: clean(event.terms?.version), body: termsBody }
      : null,
    contact: clean(event.brand.contact),
  };
}

export function isLongEventText(text: string): boolean {
  return text.length > EVENT_DETAIL_COLLAPSE_CHARS;
}
