import { ticketDetailPath } from '../../../../../../src/admin/cs';
import { isScope, scopeError } from '../../../../../../src/admin/scope';
import { isUuid } from '../../../../../../src/bff/ids';
import {
  bffApiError,
  forwardWithBearer,
} from '../../../../../../src/bff/upstream';

type Props = { params: Promise<{ ticketId: string }> };

/** GET /api/bff/admin/tickets/{ticketId}?tenantId&eventId */
export async function GET(request: Request, { params }: Props) {
  const { ticketId: rawId } = await params;
  const ticketId = rawId?.trim() ?? '';
  if (!isUuid(ticketId)) {
    return bffApiError('TICKET_ID_REQUIRED', 'ticketId must be a UUID.', 422);
  }
  const url = new URL(request.url);
  const scope = scopeError({
    tenantId: url.searchParams.get('tenantId') ?? undefined,
    eventId: url.searchParams.get('eventId') ?? undefined,
  });
  if (!isScope(scope)) return scope;
  return forwardWithBearer(ticketDetailPath(scope, ticketId), {
    method: 'GET',
  });
}

export async function POST() {
  return bffApiError('METHOD_NOT_ALLOWED', 'Use GET or /resend.', 405);
}
