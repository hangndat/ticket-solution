import { eventCancelUpstreamPath } from '../../../../../../../src/admin/event-lifecycle';
import {
  parseCancelBody,
  requireScope,
} from '../../../../../../../src/admin/event-bff-body';
import { assertMutatingBrowserAsync } from '../../../../../../../src/bff/csrf';
import { bffApiError, forwardWithBearer } from '../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ eventId: string }> };

/**
 * POST /api/bff/admin/events/{eventId}/cancel
 * → POST /v1/tenants/{tenantId}/events/{eventId}/cancel
 */
export async function POST(request: Request, { params }: Props) {
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
  const parsed = parseCancelBody(body);
  if (parsed instanceof Response) return parsed;
  return forwardWithBearer(eventCancelUpstreamPath(scope), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': parsed.idempotencyKey,
    },
    body: JSON.stringify(parsed.cancel),
  });
}
