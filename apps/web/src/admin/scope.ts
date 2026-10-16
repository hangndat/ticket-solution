import { bffApiError, isUuid } from '../bff/upstream';

export type AdminScope = { tenantId: string; eventId: string };

export function scopeError(body: { tenantId?: string; eventId?: string }): Response | AdminScope {
  const tenantId = body.tenantId?.trim() ?? '';
  const eventId = body.eventId?.trim() ?? '';
  if (!isUuid(tenantId) || !isUuid(eventId)) {
    return bffApiError('SCOPE_REQUIRED', 'tenantId and eventId must be UUIDs.', 422);
  }
  return { tenantId, eventId };
}

export function isScope(value: Response | AdminScope): value is AdminScope {
  return !(value instanceof Response);
}

export function eventPath(scope: AdminScope, suffix: string): string {
  return `/v1/tenants/${encodeURIComponent(scope.tenantId)}/events/${encodeURIComponent(scope.eventId)}/${suffix}`;
}
