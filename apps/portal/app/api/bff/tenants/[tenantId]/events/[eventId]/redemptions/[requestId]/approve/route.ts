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
  let body: { idempotencyKey?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
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
    PORTAL_UPSTREAM.redemptionApprove(
      scope.tenantId,
      scope.eventId,
      requestId,
    ),
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
    },
  );
}
