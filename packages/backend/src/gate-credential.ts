import * as jose from 'jose';
import { createHmac, createPrivateKey, createPublicKey, randomBytes, randomUUID } from 'node:crypto';
import { openCredentialToken, sealCredentialToken } from './credential-crypto';
import { GateError, GATE_ERROR_CODES } from './gate-error';
import type { CodeHmacConfig } from './code-hmac';

export const GATE_CREDENTIAL_ISSUER = 'vemoki-gate';
export const GATE_CREDENTIAL_AUDIENCE = 'gate';
const SEAL_CONTEXT = 'vemoki:gate-credential-signing-key:v1:';
const MANUAL_SEAL_CONTEXT = 'vemoki:gate-manual-entry-code:v1:';
const MIN_MANUAL_PEPPER_BYTES = 32;
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export type GateCredentialClaims = {
  iss: string;
  aud: string;
  tid: string;
  eid: string;
  tkt: string;
  ver: number;
  jti: string;
  iat: number;
};

export type ManualProofClaims = {
  iss: string;
  aud: string;
  tid: string;
  eid: string;
  tkt: string;
  sid: string;
  ver: number;
  exp: number;
  iat: number;
};

export type GateVerifyKey = {
  kid: string;
  alg: 'ES256';
  key: jose.KeyLike;
};

export type GateCredentialConfig = {
  currentKeyId: string;
  signingPrivateKeyPem: string;
  verifyKeys: GateVerifyKey[];
  manualCodePepper: CodeHmacConfig;
};

export function readGateManualCodePepper(env: NodeJS.ProcessEnv): CodeHmacConfig {
  const pepper = env['GATE_MANUAL_CODE_PEPPER']?.trim();
  if (!pepper || Buffer.byteLength(pepper, 'utf8') < MIN_MANUAL_PEPPER_BYTES) {
    throw new GateError(GATE_ERROR_CODES.MANUAL_CODE_INVALID, 'GATE_MANUAL_CODE_PEPPER must be set (≥32 bytes)');
  }
  return { pepper, version: 1 };
}

function invalidConfig(message: string): GateError {
  return new GateError(GATE_ERROR_CODES.CREDENTIAL_SIGNATURE_INVALID, message);
}

/** Fail-closed parse of the public-only verification keyring. */
export async function readGateCredentialVerifyKeys(
  env: NodeJS.ProcessEnv,
): Promise<GateVerifyKey[]> {
  const raw = env['GATE_CREDENTIAL_VERIFY_KEYS_JSON']?.trim();
  if (!raw) throw invalidConfig('GATE_CREDENTIAL_VERIFY_KEYS_JSON is required');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw invalidConfig('GATE_CREDENTIAL_VERIFY_KEYS_JSON is invalid JSON');
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw invalidConfig('GATE_CREDENTIAL_VERIFY_KEYS_JSON must be a non-empty array');
  }
  const ids = new Set<string>();
  const out: GateVerifyKey[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw invalidConfig('GATE_CREDENTIAL_VERIFY_KEYS_JSON entry invalid');
    }
    const e = entry as Record<string, unknown>;
    const kid = typeof e.kid === 'string' ? e.kid.trim() : '';
    if (!kid || e.alg !== 'ES256' || ids.has(kid)) {
      throw invalidConfig('GATE_CREDENTIAL_VERIFY_KEYS_JSON entry has invalid kid/alg');
    }
    ids.add(kid);
    let key: jose.KeyLike;
    try {
      if (typeof e.publicKeyPem === 'string' && e.publicKeyPem.trim()) {
        // `createPublicKey` accepts private PEMs too, so reject private input
        // before deriving its public half for the verification keyring.
        let containsPrivateKey = false;
        try {
          createPrivateKey(e.publicKeyPem);
          containsPrivateKey = true;
        } catch {
          // Public PEMs are expected to fail private-key parsing.
        }
        if (containsPrivateKey) throw new Error('private PEM is not allowed');
        key = createPublicKey(e.publicKeyPem) as unknown as jose.KeyLike;
      } else if (e.publicKeyJwk && typeof e.publicKeyJwk === 'object' && !Array.isArray(e.publicKeyJwk)) {
        const jwk = e.publicKeyJwk as jose.JWK;
        if ('d' in jwk) throw new Error('private JWK is not allowed');
        const imported = await jose.importJWK(jwk, 'ES256');
        if (imported instanceof Uint8Array) throw new Error('symmetric key is not allowed');
        key = imported as jose.KeyLike;
      } else {
        throw new Error('public key is missing');
      }
      // Validate key type/curve at startup, before accepting credentials.
      const exported = await jose.exportJWK(key);
      if (exported.d || exported.kty !== 'EC' || exported.crv !== 'P-256') {
        throw new Error('key must be a public P-256 key');
      }
    } catch {
      throw invalidConfig(`Verification key ${kid} is invalid`);
    }
    out.push({ kid, alg: 'ES256', key });
  }
  return out;
}

export function deriveGateSigningSealKey(credentialKeyMaterial: string): string {
  return createHmac('sha256', credentialKeyMaterial)
    .update(SEAL_CONTEXT)
    .digest('base64url');
}

function deriveManualCodeSealKey(credentialKeyMaterial: string): string {
  return createHmac('sha256', credentialKeyMaterial)
    .update(MANUAL_SEAL_CONTEXT)
    .digest('base64url');
}

export function sealManualEntryCode(rawCode: string, credentialKeyMaterial: string): string {
  return sealCredentialToken(rawCode, deriveManualCodeSealKey(credentialKeyMaterial)).encryptedToken;
}

export function openManualEntryCode(sealedCode: string, credentialKeyMaterial: string): string {
  return openCredentialToken(sealedCode, deriveManualCodeSealKey(credentialKeyMaterial));
}

/** Ten unbiased Crockford characters carry exactly 50 bits of entropy. */
export function mintManualEntryCode(): string {
  const bytes = randomBytes(7);
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  value >>= 6n;
  let chars = '';
  for (let i = 0; i < 10; i++) {
    chars = CROCKFORD[Number(value & 31n)] + chars;
    value >>= 5n;
  }
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
}

/** Unseal the PKCS#8 signing key using a domain-separated sealing key. */
export function unsealSigningKey(
  sealedToken: string,
  credentialKeyMaterial: string,
): string {
  const pem = openCredentialToken(sealedToken, deriveGateSigningSealKey(credentialKeyMaterial));
  // Parse eagerly so a malformed/wrong-key value fails closed at boot.
  createPrivateKey(pem);
  return pem;
}

export async function readGateCredentialConfig(
  env: NodeJS.ProcessEnv,
  credentialKeyMaterial: string,
): Promise<GateCredentialConfig> {
  const currentKeyId = env['GATE_CREDENTIAL_CURRENT_KEY_ID']?.trim();
  const sealed = env['GATE_CREDENTIAL_SIGNING_KEY_SEALED']?.trim();
  if (!currentKeyId || !sealed) throw invalidConfig('Gate signing key configuration is required');
  const manualCodePepper = readGateManualCodePepper(env);
  const verifyKeys = await readGateCredentialVerifyKeys(env);
  const current = verifyKeys.find((key) => key.kid === currentKeyId);
  if (!current) throw invalidConfig('Current signing key id is absent from verification keyring');
  const signingPrivateKeyPem = unsealSigningKey(sealed, credentialKeyMaterial);
  const privateKey = createPrivateKey(signingPrivateKeyPem);
  const publicKey = createPublicKey(privateKey).export({ format: 'jwk' });
  const expected = await jose.exportJWK(current.key);
  if (publicKey.x !== expected.x || publicKey.y !== expected.y || publicKey.crv !== expected.crv) {
    throw invalidConfig('Current signing private key does not match public verification key');
  }
  return {
    currentKeyId,
    signingPrivateKeyPem,
    verifyKeys,
    manualCodePepper,
  };
}

function getKeyForKid(verifyKeys: GateVerifyKey[], kid: string | undefined): GateVerifyKey | null {
  if (!kid) return null;
  return verifyKeys.find((key) => key.kid === kid) ?? null;
}

function assertOnlyClaims(payload: jose.JWTPayload, allowed: readonly string[]): void {
  if (Object.keys(payload).some((name) => !allowed.includes(name))) {
    throw invalidConfig('Credential contains unsupported claims');
  }
}

function assertHeader(header: jose.ProtectedHeaderParameters): string {
  if (
    Object.keys(header).some((name) => !['alg', 'kid', 'typ'].includes(name)) ||
    header.alg !== 'ES256' ||
    header.typ !== 'JWT' ||
    typeof header.kid !== 'string' ||
    !header.kid
  ) {
    throw invalidConfig('Credential protected header is invalid');
  }
  return header.kid;
}

function assertStringClaims(payload: jose.JWTPayload, names: string[]): void {
  if (names.some((name) => typeof payload[name] !== 'string' || !payload[name])) {
    throw invalidConfig('Credential claims are malformed');
  }
}

function assertVersionAndIssuedAt(payload: jose.JWTPayload): void {
  if (!Number.isSafeInteger(payload.ver) || Number(payload.ver) < 1 || !Number.isSafeInteger(payload.iat)) {
    throw invalidConfig('Credential version/time claims are malformed');
  }
}

export async function signGateCredentialJws(params: {
  claims: { tid: string; eid: string; tkt: string; ver: number; jti?: string };
  privateKeyPem: string;
  kid: string;
}): Promise<string> {
  const privateKey = await jose.importPKCS8(params.privateKeyPem, 'ES256');
  return new jose.SignJWT({
    tid: params.claims.tid,
    eid: params.claims.eid,
    tkt: params.claims.tkt,
    ver: params.claims.ver,
    jti: params.claims.jti ?? randomUUID(),
  })
    .setProtectedHeader({ alg: 'ES256', kid: params.kid, typ: 'JWT' })
    .setIssuer(GATE_CREDENTIAL_ISSUER)
    .setAudience(GATE_CREDENTIAL_AUDIENCE)
    .setIssuedAt()
    .sign(privateKey);
}

export async function verifyGateCredentialJws(
  jws: string,
  verifyKeys: GateVerifyKey[],
): Promise<GateCredentialClaims> {
  let header: jose.ProtectedHeaderParameters;
  try {
    header = jose.decodeProtectedHeader(jws);
  } catch {
    throw invalidConfig('Credential protected header is malformed');
  }
  const kid = assertHeader(header);
  const key = getKeyForKid(verifyKeys, kid);
  if (!key) throw invalidConfig('Unknown signing key id');
  const { payload } = await jose.jwtVerify(jws, key.key, {
    issuer: GATE_CREDENTIAL_ISSUER,
    audience: GATE_CREDENTIAL_AUDIENCE,
    algorithms: ['ES256'],
  });
  assertOnlyClaims(payload, ['iss', 'aud', 'tid', 'eid', 'tkt', 'ver', 'jti', 'iat']);
  assertStringClaims(payload, ['tid', 'eid', 'tkt', 'jti']);
  assertVersionAndIssuedAt(payload);
  if (payload.iss !== GATE_CREDENTIAL_ISSUER || payload.aud !== GATE_CREDENTIAL_AUDIENCE) {
    throw invalidConfig('Credential issuer/audience is invalid');
  }
  return {
    iss: GATE_CREDENTIAL_ISSUER,
    aud: GATE_CREDENTIAL_AUDIENCE,
    tid: payload.tid as string,
    eid: payload.eid as string,
    tkt: payload.tkt as string,
    ver: payload.ver as number,
    jti: payload.jti as string,
    iat: payload.iat as number,
  };
}

export async function mintManualProofToken(params: {
  tid: string;
  eid: string;
  tkt: string;
  sid: string;
  ver: number;
  ttlSeconds: number;
  privateKeyPem: string;
  kid: string;
}): Promise<string> {
  const privateKey = await jose.importPKCS8(params.privateKeyPem, 'ES256');
  const now = Math.floor(Date.now() / 1000);
  return new jose.SignJWT({
    tid: params.tid,
    eid: params.eid,
    tkt: params.tkt,
    sid: params.sid,
    ver: params.ver,
  })
    .setProtectedHeader({ alg: 'ES256', kid: params.kid, typ: 'JWT' })
    .setIssuer(GATE_CREDENTIAL_ISSUER)
    .setAudience(GATE_CREDENTIAL_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + params.ttlSeconds)
    .sign(privateKey);
}

export async function verifyManualProofToken(
  token: string,
  verifyKeys: GateVerifyKey[],
  expectedStaffSessionId: string,
): Promise<ManualProofClaims> {
  let header: jose.ProtectedHeaderParameters;
  try {
    header = jose.decodeProtectedHeader(token);
  } catch {
    throw new GateError(GATE_ERROR_CODES.MANUAL_PROOF_INVALID, 'Manual proof is invalid');
  }
  const kid = assertHeader(header);
  const key = getKeyForKid(verifyKeys, kid);
  if (!key) throw new GateError(GATE_ERROR_CODES.MANUAL_PROOF_INVALID, 'Manual proof is invalid');
  const { payload } = await jose.jwtVerify(token, key.key, {
    issuer: GATE_CREDENTIAL_ISSUER,
    audience: GATE_CREDENTIAL_AUDIENCE,
    algorithms: ['ES256'],
  });
  assertOnlyClaims(payload, ['iss', 'aud', 'tid', 'eid', 'tkt', 'sid', 'ver', 'exp', 'iat']);
  assertStringClaims(payload, ['tid', 'eid', 'tkt', 'sid']);
  assertVersionAndIssuedAt(payload);
  if (
    payload.iss !== GATE_CREDENTIAL_ISSUER ||
    payload.aud !== GATE_CREDENTIAL_AUDIENCE ||
    typeof payload.exp !== 'number' ||
    !Number.isSafeInteger(payload.exp) ||
    payload.sid !== expectedStaffSessionId
  ) {
    throw new GateError(GATE_ERROR_CODES.MANUAL_PROOF_INVALID, 'Manual proof is invalid');
  }
  return {
    iss: GATE_CREDENTIAL_ISSUER,
    aud: GATE_CREDENTIAL_AUDIENCE,
    tid: payload.tid as string,
    eid: payload.eid as string,
    tkt: payload.tkt as string,
    sid: payload.sid as string,
    ver: payload.ver as number,
    exp: payload.exp,
    iat: payload.iat as number,
  };
}

export function hashManualCode(
  config: CodeHmacConfig,
  tenantId: string,
  eventId: string,
  rawCode: string,
): string {
  const normalized = rawCode.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  if (!/^[0-9A-HJKMNP-TV-Z]{10}$/.test(normalized)) {
    throw new GateError(GATE_ERROR_CODES.MANUAL_CODE_INVALID, 'Invalid manual code');
  }
  return createHmac('sha256', config.pepper)
    .update(`v${config.version}:${tenantId}:${eventId}:${normalized}`)
    .digest('hex');
}
