import { sourcesPath } from '../../../../../src/admin/event-setup';
import { isScope, scopeError } from '../../../../../src/admin/scope';
import { assertSameOrigin } from '../../../../../src/bff/origin';
import { isUuid } from '../../../../../src/bff/ids';
import {
  bffApiError,
  forwardWithBearer,
} from '../../../../../src/bff/upstream';

type Body = {
  tenantId?: string;
  eventId?: string;
  name?: string;
  approvalMode?: string;
  ticketTypeId?: string;
};

/** POST /api/bff/admin/sources → POST .../sources */
export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const scope = scopeError(body);
  if (!isScope(scope)) return scope;
  const name = body.name?.trim() ?? '';
  const approvalMode = body.approvalMode?.trim() ?? '';
  const ticketTypeId = body.ticketTypeId?.trim() ?? '';
  if (!name || (approvalMode !== 'AUTO' && approvalMode !== 'MANUAL')) {
    return bffApiError(
      'SOURCE_FIELDS_REQUIRED',
      'name and approvalMode (AUTO|MANUAL) are required.',
      422,
    );
  }
  if (!isUuid(ticketTypeId)) {
    return bffApiError(
      'TICKET_TYPE_REQUIRED',
      'ticketTypeId must be a UUID.',
      422,
    );
  }
  return forwardWithBearer(sourcesPath(scope), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, approvalMode, ticketTypeId }),
  });
}

export async function GET() {
  return bffApiError('METHOD_NOT_ALLOWED', 'Use POST.', 405);
}
