/**
 * @deprecated ADR-19 — public catalog SoT is Nest published projection
 * (`src/published/*`), not this module.
 *
 * Fixture data moved to `src/fixtures/archived-demo-events.ts`.
 * Do not import findDemoEvent on guest home / event detail paths.
 */

export {
  ARCHIVED_DEMO_EVENTS,
  type ArchivedDemoEvent,
} from './fixtures/archived-demo-events';

/** @deprecated Use `publishedEventHref` from `src/published`. */
export function demoEventHref(event: {
  tenantSlug: string;
  slug: string;
}): string {
  return `/t/${encodeURIComponent(event.tenantSlug)}/events/${encodeURIComponent(event.slug)}`;
}

/** @deprecated Use `formatPublishedEventDate` from `src/published`. */
export function formatEventDate(event: {
  startsAt: string;
  timezone: string;
}): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: event.timezone,
  }).format(new Date(event.startsAt));
}
