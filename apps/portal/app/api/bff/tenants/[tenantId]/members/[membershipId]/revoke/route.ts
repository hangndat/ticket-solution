import { assertMutatingBrowser } from '../../../../../../../../src/bff/csrf';
import { isUuid } from '../../../../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../../../../src/bff/paths';
import { bffApiError, forwardStaffBearer } from '../../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string; membershipId: string }> };

export async function POST(request: Request, { params }: Props) {
  const csrf = await assertMutatingBrowser(request);
  if (csrf) return csrf;
  const { tenantId: rawT, membershipId: rawM } = await params;
  const tenantId = rawT?.trim() ?? '';
  const membershipId = rawM?.trim() ?? '';
  if (!isUuid(tenantId) || !isUuid(membershipId)) {
    return bffApiError(
      'INVALID_INPUT',
      'tenantId and membershipId must be UUIDs.',
      422,
    );
  }
  let body: { reason?: string; idempotencyKey?: string };
  try {
    body = (await request.json()) as typeof body;
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
  if (!reason) {
    return bffApiError('REASON_REQUIRED', 'reason is required.', 422);
  }
  return forwardStaffBearer(
    PORTAL_UPSTREAM.revokeMember(tenantId, membershipId),
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
