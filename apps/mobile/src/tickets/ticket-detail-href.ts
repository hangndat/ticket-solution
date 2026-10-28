/** Attendee ticket detail under the ví tab — not the list-only `/my-tickets`. */
export function ticketDetailHref(
  ticketId: string,
): `/(tabs)/my-tickets/${string}` {
  return `/(tabs)/my-tickets/${encodeURIComponent(ticketId.trim())}`;
}
