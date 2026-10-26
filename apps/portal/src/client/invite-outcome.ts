import type { PortalFetchResult } from './portal-fetch';

export function inviteQueued(result: PortalFetchResult): boolean {
  if (result.status !== 200 && result.status !== 201) return false;
  if (!result.json || typeof result.json !== 'object') return false;
  const body = result.json as Record<string, unknown>;
  return typeof body.inviteId === 'string' && body.inviteId.length > 0 &&
    body.state === 'PENDING' && body.deliveryState === 'PENDING';
}

export function inviteDeliveryFailed(result: PortalFetchResult): boolean {
  if (result.status !== 200 && result.status !== 201) return false;
  if (!result.json || typeof result.json !== 'object') return false;
  const body = result.json as Record<string, unknown>;
  return typeof body.inviteId === 'string' && body.state === 'PENDING' && body.deliveryState === 'FAILED';
}
