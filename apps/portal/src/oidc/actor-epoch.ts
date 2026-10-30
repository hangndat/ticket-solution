import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { sessionCookieOptions } from '@ticket/web-session';
import { isPortalOidcConfigured, readPortalOidcConfig } from './config';
import { PLATFORM_AUTH_COOKIES, PORTAL_AUTH_COOKIES } from './local-cookies';
import { isPlatformOidcConfigured, readPlatformOidcConfig } from './platform-config';
import { getRemoteJwks, verifyAccessToken } from './verify-tokens';
import { readPlatformAccessToken, readStaffAccessToken } from './cookies';

export type PortalSurface = 'staff' | 'platform';
export type ActorBinding = { actorId: string; authEpoch: string; surface: PortalSurface };

const cookieNames = (surface: PortalSurface) =>
  surface === 'staff' ? PORTAL_AUTH_COOKIES : PLATFORM_AUTH_COOKIES;

/** Only callback and logout write the epoch pair. Refresh/BFF never do. */
export async function rotateActorEpoch(surface: PortalSurface, actorId?: string): Promise<void> {
  const jar = await cookies();
  const names = cookieNames(surface);
  const authEpoch = randomUUID();
  const options = sessionCookieOptions(60 * 60 * 24 * 30);
  jar.set(names.epoch, authEpoch, { ...options, httpOnly: false });
  if (actorId) {
    jar.set(names.epochSnapshot, JSON.stringify({ actorId, authEpoch, surface }), options);
  } else {
    jar.delete(names.epochSnapshot);
  }
}

/** Check both cookie faces, the subject anchor and a verified bearer token. */
export async function actorEpochPair(surface: PortalSurface): Promise<ActorBinding | null> {
  const jar = await cookies();
  const names = cookieNames(surface);
  const marker = jar.get(names.epoch)?.value;
  const raw = jar.get(names.epochSnapshot)?.value;
  const subject = jar.get(names.subject)?.value;
  if (!marker || !raw || !subject) return null;
  let snapshot: ActorBinding;
  try {
    snapshot = JSON.parse(raw) as ActorBinding;
  } catch {
    return null;
  }
  if (!snapshot || typeof snapshot !== 'object' ||
      snapshot.surface !== surface || snapshot.authEpoch !== marker || snapshot.actorId !== subject) {
    return null;
  }
  return snapshot;
}

export async function verifiedActorBinding(surface: PortalSurface, accessToken?: string): Promise<ActorBinding | null> {
  const snapshot = await actorEpochPair(surface);
  if (!snapshot) return null;
  const subject = snapshot.actorId;
  try {
    if (surface === 'staff') {
      if (!isPortalOidcConfigured()) return null;
      const config = readPortalOidcConfig()!;
      const token = accessToken ?? await readStaffAccessToken();
      if (!token) return null;
      const claims = await verifyAccessToken(token, {
        issuer: config.issuer,
        audience: config.audience,
        clientId: config.clientId,
        jwks: getRemoteJwks(config.jwksUrl),
      });
      return claims.subject === subject ? snapshot : null;
    }
    if (!isPlatformOidcConfigured()) return null;
    const config = readPlatformOidcConfig()!;
    const token = accessToken ?? await readPlatformAccessToken();
    if (!token) return null;
    const claims = await verifyAccessToken(token, {
      issuer: config.issuer,
      audience: config.audience,
      clientId: config.clientId,
      jwks: getRemoteJwks(config.jwksUrl),
      platform: {
        requiredAcr: config.requiredAcr,
        maxAuthAgeSeconds: config.maxAuthAgeSeconds,
      },
    });
    return claims.subject === subject ? snapshot : null;
  } catch {
    return null;
  }
}

export function bindActorResponse(response: Response, binding: ActorBinding): Response {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Portal-Actor-Id', binding.actorId);
  headers.set('X-Portal-Auth-Epoch', binding.authEpoch);
  headers.set('X-Portal-Surface', binding.surface);
  return new Response(response.body, { status: response.status, headers });
}
