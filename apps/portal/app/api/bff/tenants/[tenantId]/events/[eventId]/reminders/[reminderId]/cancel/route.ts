import { assertMutatingBrowser } from '../../../../../../../../../../src/bff/csrf';
import {
  isEventParams,
  requireEventParams,
} from '../../../../../../../../../../src/bff/event-params';
import { isUuid } from '../../../../../../../../../../src/bff/ids';
import { parseReminderCancelBody } from '../../../../../../../../../../src/bff/notification-bff-body';
import { PORTAL_UPSTREAM } from '../../../../../../../../../../src/bff/paths';
import {
  bffApiError,
  forwardStaffBearer,
} from '../../../../../../../../../../src/bff/upstream';

type Props = {
  params: Promise<{
    tenantId: string;
    eventId: string;
    reminderId: string;
  }>;
};

/** POST cancel reminder — audited upstream; Idempotency-Key required. */
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
  const reminderId = resolved.reminderId?.trim() ?? '';
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
  return forwardStaffBearer(
    PORTAL_UPSTREAM.reminderCancel(
      scope.tenantId,
      scope.eventId,
      reminderId,
    ),
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
