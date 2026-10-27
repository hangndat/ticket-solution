/** Attendee ticket detail under the ví tab — not the list-only `/my-tickets`. */
export function ticketDetailHref(ticketId: string): `/my-tickets/${string}` {
  return `/my-tickets/${encodeURIComponent(ticketId.trim())}`;
}
