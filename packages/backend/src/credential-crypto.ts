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

export function sealCredentialToken(
  token: string,
  keyMaterial: string,
): SealedCredential {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const key = createHash('sha256').update(keyMaterial).digest();
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
  return { tokenHash, encryptedToken, kid: 'local-v1' };
}

/** Open sealed ticket credential for QR MIME only — never log the token. */
export function openCredentialToken(
  encryptedToken: string,
  keyMaterial: string,
): string {
  const raw = Buffer.from(encryptedToken, 'base64url');
  if (raw.length < 28) {
    throw new Error('encrypted credential is malformed');
  }
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const key = createHash('sha256').update(keyMaterial).digest();
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
