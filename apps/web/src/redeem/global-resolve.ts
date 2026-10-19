import type { RedemptionResolveResponse } from '@ticket/contracts';
import { redeemMutate } from './client-fetch';
import { REQUEST_TIMEOUT_MS } from './poll-operation';
import { isApiError } from './poll-operation';

export type GlobalResolveResult =
  | { status: 'ok'; body: RedemptionResolveResponse }
  | { status: 'error'; code: string; message: string; httpStatus: number }
  | { status: 'network' };

export async function resolveRedemptionCodeGlobal(
  code: string,
): Promise<GlobalResolveResult> {
  const trimmed = code.trim();
  if (!trimmed) {
    return {
      status: 'error',
      code: 'CODE_INVALID',
      message: 'Mã đổi vé là bắt buộc.',
      httpStatus: 422,
    };
  }
  const result = await redeemMutate(
    '/api/bff/redeem/resolve',
    { code: trimmed },
    REQUEST_TIMEOUT_MS,
  );
  if (result.networkError || result.timedOut) {
    return { status: 'network' };
  }
  if (result.status >= 200 && result.status < 300) {
    return {
      status: 'ok',
      body: result.json as RedemptionResolveResponse,
    };
  }
  if (isApiError(result.json)) {
    return {
      status: 'error',
      code: result.json.code,
      message: result.json.message,
      httpStatus: result.status,
    };
  }
  return {
    status: 'error',
    code: 'UNKNOWN',
    message: `HTTP ${result.status}`,
    httpStatus: result.status,
  };
}
