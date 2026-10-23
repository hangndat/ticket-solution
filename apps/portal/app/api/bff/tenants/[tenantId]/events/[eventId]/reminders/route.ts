import { assertMutatingBrowser } from '../../../../../../../../src/bff/csrf';
import {
  isEventParams,
  requireEventParams,
} from '../../../../../../../../src/bff/event-params';
import { parseReminderCreateBody } from '../../../../../../../../src/bff/notification-bff-body';
import { PORTAL_UPSTREAM } from '../../../../../../../../src/bff/paths';
import {
  bffApiError,
  forwardStaffBearer,
} from '../../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string; eventId: string }> };

/** POST create transactional EventReminder for TICKET_OWNERS. */
export async function POST(request: Request, { params }: Props) {
  const csrf = await assertMutatingBrowser(request);
  if (csrf) return csrf;
  const scope = await requireEventParams(params);
  if (!isEventParams(scope)) return scope;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const parsed = parseReminderCreateBody(body);
  if (parsed instanceof Response) return parsed;
  return forwardStaffBearer(
    PORTAL_UPSTREAM.reminders(scope.tenantId, scope.eventId),
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
  return bffApiError(
    'METHOD_NOT_ALLOWED',
    'Use POST to create a reminder (preview via …/reminders/preview).',
    405,
  );
}
