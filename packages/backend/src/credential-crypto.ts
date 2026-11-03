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

/** Walk top-level JSON members before JSON.parse can overwrite duplicate IDs. */
function assertUniqueLegacyKids(raw: string): void {
  let at = 0;
  const seen = new Set<string>();
  const whitespace = () => {
    while (/\s/.test(raw[at] ?? '')) at++;
  };
  whitespace();
  if (raw[at++] !== '{') throw new Error('invalid legacy key map');
  whitespace();
  if (raw[at] === '}') return;

  while (at < raw.length) {
    if (raw[at] !== '"') throw new Error('invalid legacy key map');
    const start = at++;
    while (at < raw.length && raw[at] !== '"') {
      at += raw[at] === '\\' ? 2 : 1;
    }
    if (at >= raw.length) throw new Error('invalid legacy key map');
    const kid: string = JSON.parse(raw.slice(start, ++at));
    if (seen.has(kid)) throw new Error('duplicate legacy key id');
    seen.add(kid);
    whitespace();
    if (raw[at++] !== ':') throw new Error('invalid legacy key map');
    whitespace();

    // Value may be any JSON type. Locate its top-level separator without
    // assuming that strings alternate between property names and values.
    let depth = 0;
    let quoted = false;
    const valueStart = at;
    while (at < raw.length) {
      const char = raw[at]!;
      if (quoted) {
        if (char === '\\') at += 2;
        else {
          if (char === '"') quoted = false;
          at++;
        }
      } else if (char === '"') {
        quoted = true;
        at++;
      } else if (char === '{' || char === '[') {
        depth++;
        at++;
      } else if (char === '}' || char === ']') {
        if (depth === 0) break;
        depth--;
        at++;
      } else if (char === ',' && depth === 0) {
        break;
      } else {
        at++;
      }
    }
    if (at === valueStart) throw new Error('invalid legacy key map');
    if (raw[at] === '}') return;
    if (raw[at++] !== ',') throw new Error('invalid legacy key map');
    whitespace();
  }
  throw new Error('invalid legacy key map');
}

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
      const raw = env['TICKET_CREDENTIAL_LEGACY_KEYS']!;
      assertUniqueLegacyKids(raw);
      legacy = JSON.parse(raw);
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
