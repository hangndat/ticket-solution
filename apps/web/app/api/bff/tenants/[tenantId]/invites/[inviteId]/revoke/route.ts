import { assertMutatingBrowserAsync } from '../../../../../../../../src/bff/csrf';
import { bffApiError, isUuid } from '../../../../../../../../src/bff/upstream';
import { PLATFORM_PATHS } from '../../../../../../../../src/platform/contracts';
import { forwardTenantBearer } from '../../../../../../../../src/platform/forward';

type Props = { params: Promise<{ tenantId: string; inviteId: string }> };
type Body = { reason?: string; idempotencyKey?: string };

export async function POST(request: Request, { params }: Props) {
  const csrf = await assertMutatingBrowserAsync(request);
  if (csrf) return csrf;
  const { tenantId: rawT, inviteId: rawI } = await params;
  const tenantId = rawT?.trim() ?? '';
  const inviteId = rawI?.trim() ?? '';
  if (!isUuid(tenantId) || !isUuid(inviteId)) {
    return bffApiError(
      'INVALID_INPUT',
      'tenantId and inviteId must be UUIDs.',
      422,
    );
  }
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const idempotencyKey = body.idempotencyKey?.trim() ?? '';
  if (!isUuid(idempotencyKey)) {
    return bffApiError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'idempotencyKey must be a UUID.',
      422,
    );
  }
  const reason = body.reason?.trim() ?? '';
  if (reason.length < 1 || reason.length > 500) {
    return bffApiError('INVALID_INPUT', 'reason must be 1..500 chars.', 422);
  }
  return forwardTenantBearer(
    PLATFORM_PATHS.inviteRevoke(tenantId, inviteId),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ reason }),
    },
  );
}
