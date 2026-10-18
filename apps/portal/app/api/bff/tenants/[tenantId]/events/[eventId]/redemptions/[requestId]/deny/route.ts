import { assertMutatingBrowser } from '../../../../../../../../../../src/bff/csrf';
import {
  isEventParams,
  requireEventParams,
} from '../../../../../../../../../../src/bff/event-params';
import { isUuid } from '../../../../../../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../../../../../../src/bff/paths';
import {
  bffApiError,
  forwardStaffBearer,
} from '../../../../../../../../../../src/bff/upstream';

type Props = {
  params: Promise<{ tenantId: string; eventId: string; requestId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const csrf = await assertMutatingBrowser(request);
  if (csrf) return csrf;
  const resolved = await params;
  const scope = await requireEventParams(
    Promise.resolve({
      tenantId: resolved.tenantId,
      eventId: resolved.eventId,
    }),
  );
  if (!isEventParams(scope)) return scope;
  const requestId = resolved.requestId?.trim() ?? '';
  if (!isUuid(requestId)) {
    return bffApiError('REQUEST_ID_REQUIRED', 'requestId must be a UUID.', 422);
  }
  let body: { reason?: string; idempotencyKey?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const reason = body.reason?.trim() ?? '';
  if (!reason) {
    return bffApiError('REASON_REQUIRED', 'Denial reason is required.', 422);
  }
  if (reason.length > 500) {
    return bffApiError(
      'REASON_TOO_LONG',
      'Denial reason must be at most 500 characters.',
      422,
    );
  }
  const idempotencyKey = body.idempotencyKey?.trim() || crypto.randomUUID();
  if (!isUuid(idempotencyKey)) {
    return bffApiError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'idempotencyKey must be a UUID.',
      422,
    );
  }
  return forwardStaffBearer(
    PORTAL_UPSTREAM.redemptionDeny(scope.tenantId, scope.eventId, requestId),
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
