/**
 * UUID v4 for React Native (Hermes has no global `crypto`) and node:test.
 */
export function randomId(): string {
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Crypto = require('expo-crypto') as typeof import('expo-crypto');
  return Crypto.randomUUID();
}
