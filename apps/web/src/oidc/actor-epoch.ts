import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { decodeJwt } from 'jose';
import { WEB_AUTH_COOKIES } from './local-cookies';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './cookies';

export const WEB_SURFACE = 'web-attendee';
const EPOCH_MAX_AGE = 60 * 60 * 24 * 30;
const EPOCH_RE = /^[a-f0-9]{64}$/;

export type WebActorSnapshot = {
  actorId: string;
  authEpoch: string;
  surface: typeof WEB_SURFACE;
};

function epochOptions(httpOnly: boolean) {
  return {
    httpOnly,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: EPOCH_MAX_AGE,
  };
}

/** Only callback and explicit logout write this pair. */
export async function rotateWebActorEpoch(): Promise<string> {
  const epoch = randomBytes(32).toString('hex');
  const jar = await cookies();
  jar.set(WEB_AUTH_COOKIES.epoch, epoch, epochOptions(true));
  jar.set(WEB_AUTH_COOKIES.marker, epoch, epochOptions(false));
  return epoch;
}

/** Read the incoming request snapshot. A marker by itself grants nothing. */
export async function readWebActorSnapshot(): Promise<WebActorSnapshot | null> {
  const jar = await cookies();
  const epoch = jar.get(WEB_AUTH_COOKIES.epoch)?.value ?? '';
  const marker = jar.get(WEB_AUTH_COOKIES.marker)?.value ?? '';
  const subject = jar.get(WEB_AUTH_COOKIES.subject)?.value ?? '';
  const token = jar.get(ACCESS_COOKIE)?.value ?? '';
  const refresh = jar.get(REFRESH_COOKIE)?.value ?? '';
  if (!EPOCH_RE.test(epoch) || marker !== epoch || !subject || (!token && !refresh)) return null;
  if (token) {
    try {
      if (decodeJwt(token).sub !== subject) return null;
    } catch {
      return null;
    }
  }
  return { actorId: subject, authEpoch: epoch, surface: WEB_SURFACE };
}

export function bindWebActorResponse(response: Response, snapshot: WebActorSnapshot): Response {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Actor-Id', snapshot.actorId);
  headers.set('X-Auth-Epoch', snapshot.authEpoch);
  headers.set('X-Auth-Surface', snapshot.surface);
  return new Response(response.body, { status: response.status, headers });
}
