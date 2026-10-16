/** Vendored uqr@0.1.2 (MIT) — QR matrix encode without lockfile deps. */
export type EncodeOptions = {
  ecc?: 'L' | 'M' | 'Q' | 'H';
  minVersion?: number;
  maxVersion?: number;
  maskPattern?: number;
  boostEcc?: boolean;
  border?: number;
};

export type QrEncodeResult = {
  version: number;
  maskPattern: number;
  size: number;
  data: boolean[][];
  types: number[][];
};

export declare function encode(
  text: string,
  options?: EncodeOptions,
): QrEncodeResult;
