/** Stable decorative tone for catalog cards and event detail hero art (server-safe). */
export function eventArtTone(eventId: string): 'default' | 'green' | 'gold' {
  const n = eventId.charCodeAt(0) + eventId.charCodeAt(eventId.length - 1);
  if (n % 3 === 1) return 'green';
  if (n % 3 === 2) return 'gold';
  return 'default';
}
