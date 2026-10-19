import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_TTL_SECONDS = 15 * 60;
const KID = 'resolve-v1';

export type ResolveTokenClaims = {
  actorUserId: string;
  routingGroupId: string;
  tenantId: string;
  eventId: string;
  routedCodeId: string;
  exp: number;
};

function b64url(data: Buffer | string): string {
  return Buffer.from(data)
    .toString('base64url');
}

function fromB64url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

export function signResolveToken(
  secret: string,
  claims: Omit<ResolveTokenClaims, 'exp'>,
  nowSeconds = Math.floor(Date.now() / 1000),
): { token: string; expiresAt: string } {
  const exp = nowSeconds + TOKEN_TTL_SECONDS;
  const payload: ResolveTokenClaims = { ...claims, exp };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(`${KID}.${body}`).digest();
  const token = `${KID}.${body}.${b64url(sig)}`;
  return { token, expiresAt: new Date(exp * 1000).toISOString() };
}

export function verifyResolveToken(
  secret: string,
  token: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): ResolveTokenClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== KID) return null;
  const body = parts[1]!;
  const sig = parts[2]!;
  const expected = createHmac('sha256', secret).update(`${KID}.${body}`).digest();
  const actual = fromB64url(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }
  let payload: ResolveTokenClaims;
  try {
    payload = JSON.parse(fromB64url(body).toString('utf8')) as ResolveTokenClaims;
  } catch {
    return null;
  }
  if (
    !payload.actorUserId ||
    !payload.routingGroupId ||
    !payload.tenantId ||
    !payload.eventId ||
    !payload.routedCodeId ||
    typeof payload.exp !== 'number'
  ) {
    return null;
  }
  if (payload.exp < nowSeconds) return null;
  return payload;
}
