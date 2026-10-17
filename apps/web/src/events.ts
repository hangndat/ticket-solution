import type { PublicEvent } from '@ticket/contracts';

// Deliberately fictional public fixtures; never a source of private/admin data.
export type DemoEvent = Readonly<
  PublicEvent & {
    category: string;
    description: string;
    highlights: readonly string[];
    theme: 'festival' | 'studio';
  }
>;

const events: readonly DemoEvent[] = [
  {
    id: 'fixture-mfest',
    tenantSlug: 'mfest',
    slug: 'mfest-2026',
    name: 'MFest 2026',
    startsAt: '2026-12-12T09:00:00+07:00',
    timezone: 'Asia/Ho_Chi_Minh',
    location: 'Riverside Park · Ho Chi Minh City (demo venue)',
    brand: { primaryColor: '#783013', organizationName: 'MFest' },
    category: 'Music / Community / Discovery',
    theme: 'festival',
    description:
      'A little louder. A little brighter. A day of live music, creative encounters and moments worth sharing.',
    highlights: [
      'Live sounds, all afternoon',
      'Independent makers & creative spaces',
      'Room to meet, move and explore',
    ],
  },
  {
    id: 'fixture-form-forum',
    tenantSlug: 'northline',
    slug: 'form-forum-2026',
    name: 'Form & Forum',
    startsAt: '2026-12-18T10:00:00+08:00',
    timezone: 'Asia/Singapore',
    location: 'The Assembly Studio · Singapore (demo venue)',
    brand: { primaryColor: '#154c42', organizationName: 'Northline Studio' },
    category: 'Design / Ideas / Conversation',
    theme: 'studio',
    description:
      'Make space for a different perspective. An intimate gathering for people shaping what comes next.',
    highlights: [
      'Conversations with working designers',
      'Hands-on material explorations',
      'A shared table for fresh ideas',
    ],
  },
];

// Exact pair lookup: never fall back to another tenant or a default event.
export function findDemoEvent(
  tenantSlug: string,
  eventSlug: string,
): DemoEvent | undefined {
  return events.find(
    (event) => event.tenantSlug === tenantSlug && event.slug === eventSlug,
  );
}

export function demoEventRoutes() {
  return events.map(({ tenantSlug, slug }) => ({
    tenantSlug,
    eventSlug: slug,
  }));
}

export function demoEventHref(event: Pick<PublicEvent, 'tenantSlug' | 'slug'>) {
  return `/t/${encodeURIComponent(event.tenantSlug)}/events/${encodeURIComponent(event.slug)}`;
}

export function formatEventDate(event: PublicEvent) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: event.timezone,
  }).format(new Date(event.startsAt));
}
