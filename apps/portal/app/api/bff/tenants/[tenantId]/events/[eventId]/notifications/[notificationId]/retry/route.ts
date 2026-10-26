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
  params: Promise<{
    tenantId: string;
    eventId: string;
    notificationId: string;
  }>;
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
  const notificationId = resolved.notificationId?.trim() ?? '';
  if (!isUuid(notificationId)) {
    return bffApiError(
      'NOTIFICATION_ID_REQUIRED',
      'notificationId must be a UUID.',
      422,
    );
  }
  let body: { reason?: string; idempotencyKey?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const idempotencyKey = typeof body?.idempotencyKey === 'string'
    ? body.idempotencyKey.trim() : '';
  if (!isUuid(idempotencyKey)) {
    return bffApiError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'idempotencyKey must be a UUID.',
      422,
    );
  }
  const reason =
    typeof body.reason === 'string' && body.reason.trim()
      ? body.reason.trim()
      : 'portal retry';
  return forwardStaffBearer(
    PORTAL_UPSTREAM.notificationRetry(
      scope.tenantId,
      scope.eventId,
      notificationId,
    ),
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
