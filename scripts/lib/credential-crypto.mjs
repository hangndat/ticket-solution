/**
 * Aes-256-gcm seal/open matching packages/backend sealCredentialToken
 * (iv||tag||ciphertext base64url, kid local-v1). Root-owned copy for drills —
 * do not edit packages/backend from this path.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export function sealCredentialToken(token, keyMaterial) {
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

export function openCredentialToken(encryptedToken, keyMaterial) {
  const key = createHash('sha256').update(keyMaterial).digest();
  const buf = Buffer.from(encryptedToken, 'base64url');
  if (buf.length < 12 + 16 + 1) {
    throw new Error('encrypted_token too short');
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}

export function verifyCredentialRoundTrip(token, keyMaterial) {
  const sealed = sealCredentialToken(token, keyMaterial);
  const opened = openCredentialToken(sealed.encryptedToken, keyMaterial);
  if (opened !== token) {
    throw new Error('credential round-trip mismatch');
  }
  return sealed;
}
