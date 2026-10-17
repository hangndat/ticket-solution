import { parseReminderCancelBody } from '../../../../../../../src/admin/notification-bff-body';
import { reminderCancelUpstreamPath } from '../../../../../../../src/admin/notifications';
import { isUuid } from '../../../../../../../src/bff/ids';
import { assertSameOrigin } from '../../../../../../../src/bff/origin';
import {
  bffApiError,
  forwardWithBearer,
} from '../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ reminderId: string }> };

/** POST cancel reminder — audited via upstream; Idempotency-Key required. */
export async function POST(request: Request, { params }: Props) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const { reminderId: rawId } = await params;
  const reminderId = rawId?.trim() ?? '';
  if (!isUuid(reminderId)) {
    return bffApiError(
      'REMINDER_NOT_FOUND',
      'reminderId must be a UUID.',
      422,
    );
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const parsed = parseReminderCancelBody(body);
  if (parsed instanceof Response) return parsed;
  return forwardWithBearer(
    reminderCancelUpstreamPath(parsed.scope, reminderId),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': parsed.idempotencyKey,
      },
      body: JSON.stringify({}),
    },
  );
}

export async function GET() {
  return bffApiError('METHOD_NOT_ALLOWED', 'Use POST.', 405);
}
