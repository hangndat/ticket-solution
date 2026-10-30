'use client';

type Surface = 'staff' | 'platform';
export type ClientActor = { actorId: string; authEpoch: string; surface: Surface; generation: number };

const markerNames: Record<Surface, string> = {
  staff: 'portal_staff_epoch',
  platform: 'portal_platform_epoch',
};
const markers: Record<Surface, string | null> = { staff: null, platform: null };
const identities: Partial<Record<Surface, ClientActor>> = {};
const flights: Partial<Record<Surface, Promise<ClientActor | null>>> = {};
const listeners = new Set<() => void>();
const blocked = new Set<Surface>();
let generation = 0;
let logoutPending = false;

export function actorSurfaceForPath(path: string): Surface {
  return new URL(path, 'http://portal.local').pathname.startsWith('/api/bff/platform/')
    ? 'platform'
    : 'staff';
}

function marker(surface: Surface): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${markerNames[surface]}=([^;]+)`));
  return match?.[1] ?? null;
}

export function actorGeneration(): number {
  return generation;
}

export function subscribeActorGeneration(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function invalidate(): void {
  generation++;
  delete identities.staff;
  delete identities.platform;
  delete flights.staff;
  delete flights.platform;
  listeners.forEach((listener) => listener());
}

export function checkActorMarkers(): void {
  const staff = marker('staff');
  const platform = marker('platform');
  if (staff !== markers.staff || platform !== markers.platform) {
    if (staff !== markers.staff) blocked.delete('staff');
    if (platform !== markers.platform) blocked.delete('platform');
    markers.staff = staff;
    markers.platform = platform;
    invalidate();
  }
}

/** Clear the current document before the logout navigation begins. */
export function beginActorLogout(): void {
  logoutPending = true;
  invalidate();
}

export function failActorRequest(surface: Surface): void {
  if (!blocked.has(surface)) {
    blocked.add(surface);
    invalidate();
  }
}

export function installActorLifecycle(): () => void {
  checkActorMarkers();
  const check = () => checkActorMarkers();
  const visibility = () => {
    if (document.visibilityState === 'visible') check();
  };
  window.addEventListener('pageshow', check);
  window.addEventListener('focus', check);
  window.addEventListener('popstate', check);
  document.addEventListener('visibilitychange', visibility);
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('portal-actor-epoch');
  channel?.addEventListener('message', check);
  channel?.postMessage('check');
  return () => {
    window.removeEventListener('pageshow', check);
    window.removeEventListener('focus', check);
    window.removeEventListener('popstate', check);
    document.removeEventListener('visibilitychange', visibility);
    channel?.close();
  };
}

async function identity(surface: Surface): Promise<ClientActor | null> {
  if (logoutPending || blocked.has(surface)) return null;
  checkActorMarkers();
  const existing = identities[surface];
  if (existing && existing.authEpoch === marker(surface) && existing.generation === generation) return existing;
  if (flights[surface]) return flights[surface]!;
  const started = generation;
  const expectedMarker = marker(surface);
  if (!expectedMarker) return null;
  const flight = (async () => {
    try {
      const res = await fetch(`/api/auth/identity?surface=${surface}`, {
        credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return null;
      const json: unknown = await res.json();
      if (!json || typeof json !== 'object') return null;
      const candidate = json as Partial<ClientActor>;
      checkActorMarkers();
      if (started !== generation || candidate.surface !== surface ||
          candidate.authEpoch !== expectedMarker || typeof candidate.actorId !== 'string' ||
          !candidate.actorId) return null;
      const actor = { actorId: candidate.actorId, authEpoch: expectedMarker, surface, generation: started };
      identities[surface] = actor;
      return actor;
    } catch {
      return null;
    }
  })();
  flights[surface] = flight;
  try { return await flight; } finally { if (flights[surface] === flight) delete flights[surface]; }
}

export async function beginActorRequest(path: string): Promise<ClientActor | null> {
  return identity(actorSurfaceForPath(path));
}

export function actorResponseMatches(actor: ClientActor | null, response: Response): boolean {
  checkActorMarkers();
  if (logoutPending || !actor || actor.generation !== generation || actor.authEpoch !== marker(actor.surface)) return false;
  if (response.status === 401) return false;
  return response.headers.get('X-Portal-Actor-Id') === actor.actorId &&
    response.headers.get('X-Portal-Auth-Epoch') === actor.authEpoch &&
    response.headers.get('X-Portal-Surface') === actor.surface;
}

export function actorStillCurrent(actor: ClientActor | null): boolean {
  checkActorMarkers();
  return !logoutPending && !!actor && actor.generation === generation && actor.authEpoch === marker(actor.surface);
}

/** Test fixture reset; never used by the application. */
export function resetActorGateForTests(): void {
  generation = 0;
  logoutPending = false;
  markers.staff = null;
  markers.platform = null;
  delete identities.staff;
  delete identities.platform;
  delete flights.staff;
  delete flights.platform;
  blocked.clear();
  listeners.clear();
}
