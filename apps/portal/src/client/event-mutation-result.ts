import type { PortalFetchResult } from './portal-fetch';

export function eventFromMutation(result: PortalFetchResult): { eventId: string; revision: number; contentStatus: string; name: string } | null {
  if (result.status !== 200 && result.status !== 201) return null;
  if (!result.json || typeof result.json !== 'object') return null;
  const event = (result.json as { event?: unknown }).event;
  if (!event || typeof event !== 'object') return null;
  const fields = event as Record<string, unknown>;
  if (typeof fields.eventId !== 'string' || !fields.eventId ||
    typeof fields.revision !== 'number' || typeof fields.name !== 'string' ||
    typeof fields.contentStatus !== 'string') return null;
  return { eventId: fields.eventId, revision: fields.revision,
    name: fields.name, contentStatus: fields.contentStatus };
}
