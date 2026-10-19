import type { RedemptionResolveRequestBody } from '@ticket/contracts';
import { assertMutatingBrowserAsync } from '../../../../../src/bff/csrf';
import { bffApiError, forwardWithBearer } from '../../../../../src/bff/upstream';

/**
 * POST /api/bff/redeem/resolve → Nest POST /v1/redemptions/resolve
 */
export async function POST(request: Request) {
  const csrf = await assertMutatingBrowserAsync(request);
  if (csrf) return csrf;

  let body: RedemptionResolveRequestBody;
  try {
    body = (await request.json()) as RedemptionResolveRequestBody;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }

  const code = body?.code?.trim() ?? '';
  if (!code) {
    return bffApiError('CODE_INVALID', 'Redemption code is required.', 422);
  }

  return forwardWithBearer('/v1/redemptions/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}
