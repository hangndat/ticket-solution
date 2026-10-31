'use client';

import { csrfJsonMutation } from '../bff/csrf-client';
import type { FetchJsonResult } from './fetch-json';

/** Same-origin JSON mutation with CSRF double-submit header. */
export async function redeemMutate(
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<FetchJsonResult> {
  return csrfJsonMutation(path, body, timeoutMs);
}
