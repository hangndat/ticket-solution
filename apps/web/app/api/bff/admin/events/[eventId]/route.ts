import {
  eventDetailUpstreamPath,
} from '../../../../../../src/admin/event-lifecycle';
import {
  parsePatchBody,
  requireScope,
} from '../../../../../../src/admin/event-bff-body';
import { assertMutatingBrowserAsync } from '../../../../../../src/bff/csrf';
import { isUuid } from '../../../../../../src/bff/ids';
import {
  bffApiError,
  forwardWithBearer,
} from '../../../../../../src/bff/upstream';

type Props = { params: Promise<{ eventId: string }> };

/**
 * GET /api/bff/admin/events/{eventId}?tenantId=
 * → GET /v1/tenants/{tenantId}/events/{eventId}
 */
export async function GET(request: Request, { params }: Props) {
  const { eventId: rawEventId } = await params;
  const eventId = rawEventId?.trim() ?? '';
  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenantId')?.trim() ?? '';
  if (!isUuid(tenantId) || !isUuid(eventId)) {
    return bffApiError(
      'SCOPE_REQUIRED',
      'tenantId and eventId must be UUIDs.',
      422,
    );
  }
  return forwardWithBearer(eventDetailUpstreamPath({ tenantId, eventId }), {
    method: 'GET',
  });
}

/**
 * PATCH /api/bff/admin/events/{eventId}
 * → PATCH /v1/tenants/{tenantId}/events/{eventId}
 * Body: PatchEventBody + tenantId + idempotencyKey. CSRF required.
 */
export async function PATCH(request: Request, { params }: Props) {
  const csrf = await assertMutatingBrowserAsync(request);
  if (csrf) return csrf;
  const { eventId: rawEventId } = await params;
  const eventId = rawEventId?.trim() ?? '';
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const scope = requireScope({
    tenantId: typeof body.tenantId === 'string' ? body.tenantId : undefined,
    eventId,
  });
  if (scope instanceof Response) return scope;
  const parsed = parsePatchBody(body);
  if (parsed instanceof Response) return parsed;
  return forwardWithBearer(eventDetailUpstreamPath(scope), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': parsed.idempotencyKey,
    },
    body: JSON.stringify(parsed.patch),
  });
}
