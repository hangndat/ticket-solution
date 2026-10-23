import { assertMutatingBrowser } from '../../../../../../../src/bff/csrf';
import { isUuid } from '../../../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../../../src/bff/paths';
import {
  bffApiError,
  forwardPlatformBearer,
} from '../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string }> };

type Body = {
  status?: 'ACTIVE' | 'SUSPENDED';
  reason?: string;
  expectedVersion?: number;
  idempotencyKey?: string;
};

export async function POST(request: Request, { params }: Props) {
  const csrf = await assertMutatingBrowser(request);
  if (csrf) return csrf;
  const { tenantId: raw } = await params;
  const tenantId = raw?.trim() ?? '';
  if (!isUuid(tenantId)) {
    return bffApiError('INVALID_INPUT', 'tenantId must be a UUID.', 422);
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
  if (body.status !== 'ACTIVE' && body.status !== 'SUSPENDED') {
    return bffApiError(
      'INVALID_INPUT',
      'status must be ACTIVE or SUSPENDED.',
      422,
    );
  }
  const reason = body.reason?.trim() ?? '';
  if (reason.length < 1 || reason.length > 500) {
    return bffApiError('INVALID_INPUT', 'reason must be 1..500 chars.', 422);
  }
  if (
    typeof body.expectedVersion !== 'number' ||
    !Number.isInteger(body.expectedVersion)
  ) {
    return bffApiError(
      'INVALID_INPUT',
      'expectedVersion must be an integer.',
      422,
    );
  }
  const res = await forwardPlatformBearer(
    PORTAL_UPSTREAM.platformTenantStatus(tenantId),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        status: body.status,
        reason,
        expectedVersion: body.expectedVersion,
      }),
    },
  );
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(res.body, { status: res.status, headers });
}
