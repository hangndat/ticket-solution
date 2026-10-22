import { PUBLIC_EVENT_COPY } from '../published/copy';
import { eventArtTone } from '../ui/event-art-tone';

export type HomeCatalogTimeFilter = 'all' | 'upcoming' | 'past';

export type HomeCatalogItem = {
  id: string;
  tenantSlug: string;
  slug: string;
  name: string;
  timezone: string;
  startsAt: string | null;
  location: string | null;
  brand: {
    organizationName: string;
    bannerUrl?: string | null;
    logoUrl?: string | null;
  };
};

export function catalogArtTone(eventId: string): 'default' | 'green' | 'gold' {
  return eventArtTone(eventId);
}

export function formatEventWhen(event: HomeCatalogItem): string {
  if (!event.startsAt) return PUBLIC_EVENT_COPY.noStartsAt;
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: event.timezone,
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(event.startsAt));
  } catch {
    return event.startsAt;
  }
}

export function eventMatchesTimeFilter(
  event: HomeCatalogItem,
  filter: HomeCatalogTimeFilter,
): boolean {
  if (filter === 'all') return true;
  if (!event.startsAt) return filter === 'upcoming';
  const start = Date.parse(event.startsAt);
  if (Number.isNaN(start)) return filter === 'upcoming';
  const now = Date.now();
  if (filter === 'upcoming') return start >= now;
  return start < now;
}

export function catalogArtLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '·';
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]![0] ?? ''}${words[1]![0] ?? ''}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}
