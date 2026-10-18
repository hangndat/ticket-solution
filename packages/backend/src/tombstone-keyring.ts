import { createHmac, timingSafeEqual } from 'node:crypto';

export type TombstoneKey = {
  keyId: string;
  /** Raw secret bytes (≥32). */
  secret: Buffer;
};

export type TombstoneKeyring = {
  currentKeyId: string;
  keys: TombstoneKey[];
};

export class TombstoneKeyringError extends Error {
  readonly code: 'KEYRING_MISSING' | 'KEYRING_INVALID' | 'KEY_UNKNOWN';
  constructor(
    code: TombstoneKeyringError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'TombstoneKeyringError';
    this.code = code;
  }
}

/**
 * Env (coordinator-owned root .env.example):
 * - ACCOUNT_DELETION_TOMBSTONE_KEYRING_JSON: [{"keyId":"k1","secretBase64":"..."}]
 * - ACCOUNT_DELETION_TOMBSTONE_CURRENT_KEY_ID: k1
 */
export function readTombstoneKeyring(
  env: NodeJS.ProcessEnv,
): TombstoneKeyring {
  const raw = env['ACCOUNT_DELETION_TOMBSTONE_KEYRING_JSON']?.trim() ?? '';
  const currentKeyId =
    env['ACCOUNT_DELETION_TOMBSTONE_CURRENT_KEY_ID']?.trim() ?? '';
  if (!raw || !currentKeyId) {
    // Fail-closed + alert signal (sanitized).
    console.error(
      JSON.stringify({
        alert: 'account_deletion_tombstone_keyring_missing',
        severity: 'error',
      }),
    );
    throw new TombstoneKeyringError(
      'KEYRING_MISSING',
      'ACCOUNT_DELETION_TOMBSTONE_KEYRING_JSON and CURRENT_KEY_ID required',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new TombstoneKeyringError(
      'KEYRING_INVALID',
      'ACCOUNT_DELETION_TOMBSTONE_KEYRING_JSON must be JSON',
    );
  }
  if (!Array.isArray(parsed) || parsed.length < 1) {
    throw new TombstoneKeyringError(
      'KEYRING_INVALID',
      'tombstone keyring must be a non-empty array',
    );
  }

  const keys: TombstoneKey[] = [];
  for (const entry of parsed) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      typeof (entry as { keyId?: unknown }).keyId !== 'string' ||
      typeof (entry as { secretBase64?: unknown }).secretBase64 !== 'string'
    ) {
      throw new TombstoneKeyringError(
        'KEYRING_INVALID',
        'each keyring entry needs keyId + secretBase64',
      );
    }
    const keyId = (entry as { keyId: string }).keyId.trim();
    const secret = Buffer.from(
      (entry as { secretBase64: string }).secretBase64,
      'base64',
    );
    if (!keyId || secret.length < 32) {
      throw new TombstoneKeyringError(
        'KEYRING_INVALID',
        'tombstone secret must decode to ≥32 bytes',
      );
    }
    keys.push({ keyId, secret });
  }

  if (!keys.some((k) => k.keyId === currentKeyId)) {
    console.error(
      JSON.stringify({
        alert: 'account_deletion_tombstone_current_key_missing',
        severity: 'error',
      }),
    );
    throw new TombstoneKeyringError(
      'KEY_UNKNOWN',
      'CURRENT_KEY_ID not present in keyring',
    );
  }

  return { currentKeyId, keys };
}

/** Canonical HMAC-SHA256 over JSON.stringify([issuer, sub]) — R4. */
export function mintTombstoneDigest(
  keyring: TombstoneKeyring,
  issuer: string,
  subject: string,
): { keyId: string; digest: Buffer } {
  const key = keyring.keys.find((k) => k.keyId === keyring.currentKeyId);
  if (!key) {
    throw new TombstoneKeyringError(
      'KEY_UNKNOWN',
      'current tombstone key missing',
    );
  }
  const payload = Buffer.from(JSON.stringify([issuer, subject]), 'utf8');
  const digest = createHmac('sha256', key.secret).update(payload).digest();
  return { keyId: key.keyId, digest };
}

/** Digests under every key still in the ring (verify/deny dual-accept). */
export function digestsForIdentity(
  keyring: TombstoneKeyring,
  issuer: string,
  subject: string,
): Buffer[] {
  const payload = Buffer.from(JSON.stringify([issuer, subject]), 'utf8');
  return keyring.keys.map((key) =>
    createHmac('sha256', key.secret).update(payload).digest(),
  );
}

export function digestsEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
