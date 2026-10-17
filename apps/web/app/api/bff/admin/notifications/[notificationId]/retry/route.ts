import { parseRetryBody } from '../../../../../../../src/admin/notification-bff-body';
import { notificationRetryUpstreamPath } from '../../../../../../../src/admin/notifications';
import { isUuid } from '../../../../../../../src/bff/ids';
import { assertSameOrigin } from '../../../../../../../src/bff/origin';
import {
  bffApiError,
  forwardWithBearer,
} from '../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ notificationId: string }> };

/**
 * POST audited retry with reason + Idempotency-Key.
 * Requeue starts PENDING — never claim delivered.
 */
export async function POST(request: Request, { params }: Props) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const { notificationId: rawId } = await params;
  const notificationId = rawId?.trim() ?? '';
  if (!isUuid(notificationId)) {
    return bffApiError(
      'NOTIFICATION_NOT_FOUND',
      'notificationId must be a UUID.',
      422,
    );
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const parsed = parseRetryBody(body);
  if (parsed instanceof Response) return parsed;
  return forwardWithBearer(
    notificationRetryUpstreamPath(parsed.scope, notificationId),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': parsed.idempotencyKey,
      },
      body: JSON.stringify(parsed.payload),
    },
  );
}

export async function GET() {
  return bffApiError('METHOD_NOT_ALLOWED', 'Use POST.', 405);
}
