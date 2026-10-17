import { ticketResendPath } from '../../../../../../../src/admin/cs';
import { isScope, scopeError } from '../../../../../../../src/admin/scope';
import { isUuid } from '../../../../../../../src/bff/ids';
import { assertSameOrigin } from '../../../../../../../src/bff/origin';
import {
  bffApiError,
  forwardWithBearer,
} from '../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ ticketId: string }> };

type Body = {
  tenantId?: string;
  eventId?: string;
  idempotencyKey?: string;
};

/** POST /api/bff/admin/tickets/{ticketId}/resend → CS resend with Idempotency-Key. */
export async function POST(request: Request, { params }: Props) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const { ticketId: rawId } = await params;
  const ticketId = rawId?.trim() ?? '';
  if (!isUuid(ticketId)) {
    return bffApiError('TICKET_ID_REQUIRED', 'ticketId must be a UUID.', 422);
  }
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const scope = scopeError(body);
  if (!isScope(scope)) return scope;
  const idempotencyKey = body.idempotencyKey?.trim() ?? '';
  if (!isUuid(idempotencyKey)) {
    return bffApiError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'idempotencyKey must be a UUID.',
      422,
    );
  }
  return forwardWithBearer(ticketResendPath(scope, ticketId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({}),
  });
}

export async function GET() {
  return bffApiError('METHOD_NOT_ALLOWED', 'Use POST.', 405);
}
