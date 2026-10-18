/**
 * ARCHIVED — former web marketing fixture SoT (pre ADR-19 / #256).
 *
 * Do NOT import from public guest paths (`app/page.tsx`, `/t/.../events/...`).
 * Published projection from Nest/BFF is the only SoT. Kept for historical
 * reference and optional local design sandboxes with an explicit Demo label.
 */

import type { PublicEvent } from '@ticket/contracts';

export type ArchivedDemoEvent = Readonly<
  PublicEvent & {
    category: string;
    description: string;
    highlights: readonly string[];
    theme: 'festival' | 'studio';
  }
>;

/** @deprecated Client fixture — not published SoT. */
export const ARCHIVED_DEMO_EVENTS: readonly ArchivedDemoEvent[] = [
  {
    id: 'fixture-fun-fest',
    tenantSlug: 'sunburst',
    slug: 'fun-fest-2026',
    name: 'FUN FEST 2026',
    startsAt: '2026-12-12T09:00:00+07:00',
    timezone: 'Asia/Ho_Chi_Minh',
    location: 'Riverside Park · Ho Chi Minh City (demo venue)',
    brand: { primaryColor: '#783013', organizationName: 'Sunburst Collective' },
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
