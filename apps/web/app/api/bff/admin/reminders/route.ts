import { parseReminderCreateBody } from '../../../../../src/admin/notification-bff-body';
import { reminderCreateUpstreamPath } from '../../../../../src/admin/notifications';
import { assertSameOrigin } from '../../../../../src/bff/origin';
import {
  bffApiError,
  forwardWithBearer,
} from '../../../../../src/bff/upstream';

/**
 * POST create transactional EventReminder for TICKET_OWNERS.
 * Requires expectedEventRevision + UTC scheduledAt + Idempotency-Key.
 * Unknown outcomes must reuse the same key client-side to avoid duplicate schedules.
 */
export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const parsed = parseReminderCreateBody(body);
  if (parsed instanceof Response) return parsed;
  return forwardWithBearer(reminderCreateUpstreamPath(parsed.scope), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': parsed.idempotencyKey,
    },
    body: JSON.stringify(parsed.payload),
  });
}

export async function GET() {
  return bffApiError(
    'METHOD_NOT_ALLOWED',
    'Use POST to create a reminder (preview via /reminders/preview).',
    405,
  );
}
