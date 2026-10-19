import {
  ISSUE_ERROR_CODES,
  type RedemptionResolveResponse,
} from '@ticket/contracts';

export type GlobalResolveResult =
  | { status: 'ok'; body: RedemptionResolveResponse }
  | { status: 'error'; code: string; message: string; httpStatus: number }
  | { status: 'network' };

function isApiError(
  value: unknown,
): value is { code: string; message: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  return typeof body.code === 'string' && typeof body.message === 'string';
}

export async function resolveRedemptionCodeGlobal(input: {
  apiBase: string;
  bearer: string;
  code: string;
  fetchImpl?: typeof fetch;
}): Promise<GlobalResolveResult> {
  const trimmed = input.code.trim();
  if (!trimmed) {
    return {
      status: 'error',
      code: ISSUE_ERROR_CODES.CODE_INVALID,
      message: 'Mã đổi vé là bắt buộc.',
      httpStatus: 422,
    };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const base = input.apiBase.replace(/\/$/, '');
  try {
    const response = await fetchImpl(`${base}/v1/redemptions/resolve`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.bearer}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: trimmed }),
    });
    const text = await response.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        json = null;
      }
    }
    if (response.status >= 200 && response.status < 300 && json) {
      return { status: 'ok', body: json as RedemptionResolveResponse };
    }
    if (isApiError(json)) {
      return {
        status: 'error',
        code: json.code,
        message: json.message,
        httpStatus: response.status,
      };
    }
    return {
      status: 'error',
      code: 'UNKNOWN',
      message: `HTTP ${response.status}`,
      httpStatus: response.status,
    };
  } catch {
    return { status: 'network' };
  }
}
