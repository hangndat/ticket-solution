import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

export type SealedCredential = {
  tokenHash: string;
  encryptedToken: string;
  kid: string;
};

export type CredentialKeyring = {
  currentKid: string;
  keys: Readonly<Record<string, string>>;
};

export type CredentialKeyInput = string | CredentialKeyring;

const KID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function readCredentialKeyringEnvironment(
  env: NodeJS.ProcessEnv,
): CredentialKeyring {
  const currentKey = env['TICKET_CREDENTIAL_KEY']?.trim();
  const currentKid =
    env['TICKET_CREDENTIAL_KID'] === undefined
      ? 'local-v1'
      : env['TICKET_CREDENTIAL_KID'].trim();
  if (!currentKey || currentKey.length < 16 || !KID.test(currentKid)) {
    throw new Error('ticket credential keyring is invalid');
  }
  let legacy: unknown = {};
  if (env['TICKET_CREDENTIAL_LEGACY_KEYS']?.trim()) {
    try {
      legacy = JSON.parse(env['TICKET_CREDENTIAL_LEGACY_KEYS']!);
    } catch {
      throw new Error('ticket credential keyring is invalid');
    }
  }
  if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) {
    throw new Error('ticket credential keyring is invalid');
  }
  const keys: Record<string, string> = Object.create(null);
  for (const [kid, material] of Object.entries(legacy)) {
    if (
      !KID.test(kid) ||
      kid === currentKid ||
      typeof material !== 'string' ||
      material.trim().length < 16
    ) {
      throw new Error('ticket credential keyring is invalid');
    }
    keys[kid] = material.trim();
  }
  keys[currentKid] = currentKey;
  return { currentKid, keys };
}

function resolveKey(input: CredentialKeyInput, kid: string): string {
  if (typeof input === 'string') {
    if (kid === 'local-v1' && input.length >= 16) return input;
  } else if (
    Object.hasOwn(input.keys, kid) &&
    typeof input.keys[kid] === 'string'
  ) {
    return input.keys[kid];
  }
  throw new Error('unsupported credential key id');
}

export function sealCredentialToken(
  token: string,
  keyMaterial: CredentialKeyInput,
): SealedCredential {
  const kid =
    typeof keyMaterial === 'string' ? 'local-v1' : keyMaterial.currentKid;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const key = createHash('sha256')
    .update(resolveKey(keyMaterial, kid))
    .digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const encryptedToken = Buffer.concat([iv, tag, ciphertext]).toString(
    'base64url',
  );
  return { tokenHash, encryptedToken, kid };
}

/** Open sealed ticket credential for QR MIME only — never log the token. */
export function openCredentialToken(
  encryptedToken: string,
  keyMaterial: CredentialKeyInput,
  kid = 'local-v1',
): string {
  const material = resolveKey(keyMaterial, kid);
  const raw = Buffer.from(encryptedToken, 'base64url');
  if (raw.length < 28) {
    throw new Error('encrypted credential is malformed');
  }
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const key = createHash('sha256').update(material).digest();
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}

export function hashCredentialToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
