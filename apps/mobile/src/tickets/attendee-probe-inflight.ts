import type { MeTicketsProbeResult } from './fetch-me-tickets.ts';
import type { MeTicketsFetchScope } from './wallet-fetch-scope.ts';

export type AttendeeProbeRunner = (
  bearer: string,
  fetchScope: MeTicketsFetchScope,
) => Promise<MeTicketsProbeResult>;

const inFlightProbes = new Map<string, Promise<MeTicketsProbeResult>>();

/** Session-scoped key so concurrent hooks share one in-flight probe per user. */
export function attendeeProbeInflightKey(
  userId: string,
  sessionScope: string,
): string {
  return `${userId}:${sessionScope}`;
}

/**
 * Coalesce concurrent probeMeTickets calls for the same user + session scope.
 * Clears the in-flight entry when the shared promise settles (ok or error).
 */
export function dedupedAttendeeProbeMeTickets(
  userId: string,
  sessionScope: string,
  bearer: string,
  fetchScope: MeTicketsFetchScope,
  runProbe: AttendeeProbeRunner,
): Promise<MeTicketsProbeResult> {
  const key = attendeeProbeInflightKey(userId, sessionScope);
  const existing = inFlightProbes.get(key);
  if (existing) return existing;

  const promise = runProbe(bearer, fetchScope).finally(() => {
    inFlightProbes.delete(key);
  });
  inFlightProbes.set(key, promise);
  return promise;
}

/** Test helper — reset module in-flight map between cases. */
export function resetAttendeeProbeInflightForTests(): void {
  inFlightProbes.clear();
}
