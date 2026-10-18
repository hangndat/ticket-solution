import { encode } from './vendor/uqr.mjs';

/** Encode text to a QR module matrix (vendored uqr — no lockfile dep). */
export function encodeQrModules(text: string): boolean[][] {
  const { data } = encode(text, { ecc: 'M' });
  return data;
}
