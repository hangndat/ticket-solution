/** Detail URL after a confirmed event.create (client route). */
export function createdEventDetailHref(tenantId: string, eventId: string): string {
  return `/t/${encodeURIComponent(tenantId)}/e/${encodeURIComponent(eventId)}`;
}

/**
 * Full navigation after create — remounts portal shell so MeEvents discovery matches
 * the new assignment (F-930-04). Call only after confirmed create + setDirty(false).
 */
export function navigateAfterEventCreate(tenantId: string, eventId: string): void {
  window.location.assign(createdEventDetailHref(tenantId, eventId));
}
