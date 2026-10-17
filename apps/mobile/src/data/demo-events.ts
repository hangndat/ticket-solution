import type { PublicEvent } from '@ticket/contracts';

/**
 * Explicit W0 demo fixtures only.
 * Never a fallback for a failing/missing published API (M04).
 * Deep links under `/events/fixture/*` and `*://events/demo-*` stay here.
 */
const events: readonly PublicEvent[] = [
  {
    id: 'demo-fun-fest',
    tenantSlug: 'demo-fun',
    slug: 'fun-fest',
    name: 'FUN FEST · Demo',
    startsAt: '2027-03-20T10:00:00+07:00',
    timezone: 'Asia/Ho_Chi_Minh',
    location: 'Demo riverside venue, Ho Chi Minh City',
    brand: { primaryColor: '#245B47', organizationName: 'Demo FUN Collective' },
  },
  {
    id: 'demo-studio-night',
    tenantSlug: 'demo-studio',
    slug: 'studio-night',
    name: 'Studio Night · Demo',
    startsAt: '2027-04-10T18:00:00+07:00',
    timezone: 'Asia/Ho_Chi_Minh',
    location: 'Demo studio, Ho Chi Minh City',
    brand: {
      primaryColor: '#59428A',
      organizationName: 'Demo Studio Organization',
    },
  },
];
export const demoTenants = ['demo-fun', 'demo-studio'] as const;
export function listDemoEvents(tenantSlug: string) {
  return events.filter((event) => event.tenantSlug === tenantSlug);
}
export function findDemoEvent(tenantSlug: string, slug: string) {
  return events.find(
    (event) => event.tenantSlug === tenantSlug && event.slug === slug,
  );
}
export function findDemoEventById(eventId: string) {
  return events.find((event) => event.id === eventId);
}
export function eventDate(event: PublicEvent) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: event.timezone,
  }).format(new Date(event.startsAt));
}
