import * as ExpoCrypto from 'expo-crypto';

/** Native: expo-crypto (Hermes may lack globalThis.crypto). */
export function createUuid(): string {
  return ExpoCrypto.randomUUID();
}
