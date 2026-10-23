import { assertMutatingBrowserAsync } from '../../../../../../src/bff/csrf';
import { bffApiError, isUuid } from '../../../../../../src/bff/upstream';
import { PLATFORM_PATHS } from '../../../../../../src/bff/platform-contracts';
import { forwardTenantBearer } from '../../../../../../src/bff/platform-forward';

type Body = { token?: string; idempotencyKey?: string };

/** POST accept invite — token from fragment/session, never logged. */
export async function POST(request: Request) {
  const csrf = await assertMutatingBrowserAsync(request);
  if (csrf) return csrf;
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const token = body.token?.trim() ?? '';
  const idempotencyKey = body.idempotencyKey?.trim() ?? '';
  if (!token) {
    return bffApiError('INVALID_INPUT', 'token is required.', 422);
  }
  if (!isUuid(idempotencyKey)) {
    return bffApiError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'idempotencyKey must be a UUID.',
      422,
    );
  }
  return forwardTenantBearer(PLATFORM_PATHS.acceptInvite, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ token }),
  });
}
