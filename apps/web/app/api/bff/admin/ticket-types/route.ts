import { ticketTypesPath } from '../../../../../src/admin/event-setup';
import { isScope, scopeError } from '../../../../../src/admin/scope';
import { assertSameOrigin } from '../../../../../src/bff/origin';
import {
  bffApiError,
  forwardWithBearer,
} from '../../../../../src/bff/upstream';

type Body = {
  tenantId?: string;
  eventId?: string;
  label?: string;
  entitlementSnapshot?: Record<string, unknown>;
};

/** POST /api/bff/admin/ticket-types → POST .../ticket-types */
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
  const label = body.label?.trim() ?? '';
  if (!label) {
    return bffApiError('LABEL_REQUIRED', 'label is required.', 422);
  }
  const payload: Record<string, unknown> = { label };
  if (body.entitlementSnapshot && typeof body.entitlementSnapshot === 'object') {
    payload.entitlementSnapshot = body.entitlementSnapshot;
  }
  return forwardWithBearer(ticketTypesPath(scope), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function GET() {
  return bffApiError('METHOD_NOT_ALLOWED', 'Use POST.', 405);
}
