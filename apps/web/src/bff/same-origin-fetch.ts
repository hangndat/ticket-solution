'use client';

import { csrfJsonMutation } from './csrf-client';
import { fetchJson, type FetchJsonResult } from '../redeem/fetch-json';

/** Same-origin JSON mutation with CSRF header + no-store. */
export async function platformMutate(
  path: string,
  body: unknown,
  timeoutMs: number,
  method: 'POST' | 'PUT' | 'PATCH' = 'POST',
): Promise<FetchJsonResult> {
  return csrfJsonMutation(path, body, timeoutMs, method);
}

export async function platformGet(
  path: string,
  timeoutMs: number,
): Promise<FetchJsonResult> {
  return fetchJson(path, { method: 'GET' }, timeoutMs);
}
