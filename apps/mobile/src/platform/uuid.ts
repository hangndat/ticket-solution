/**
 * Node / non-native: Web Crypto or Math fallback (unit tests).
 * Metro resolves uuid.native.ts on iOS/Android.
 */
export function createUuid(): string {
  const webCrypto = (
    globalThis as { crypto?: { randomUUID?: () => string } }
  ).crypto;
  if (typeof webCrypto?.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  const bytes = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256),
  );
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const h = bytes.map(hex).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
