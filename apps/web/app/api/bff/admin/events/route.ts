import { createEventUpstreamPath } from '../../../../../src/admin/create-event';
import { isUuid } from '../../../../../src/bff/ids';
import {
  bffApiError,
  forwardWithBearer,
} from '../../../../../src/bff/upstream';

type Body = {
  tenantId?: string;
  slug?: string;
  name?: string;
  timezone?: string;
  redemptionOpensAt?: string;
  redemptionClosesAt?: string;
};

/**
 * POST /api/bff/admin/events → POST /v1/tenants/{tenantId}/events
 * Body fields beyond tenantId/slug/name are forwarded when present (schema TBD).
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const tenantId = body.tenantId?.trim() ?? '';
  if (!isUuid(tenantId)) {
    return bffApiError('TENANT_REQUIRED', 'tenantId must be a UUID.', 422);
  }
  const slug = body.slug?.trim() ?? '';
  const name = body.name?.trim() ?? '';
  if (!slug || !name) {
    return bffApiError(
      'EVENT_FIELDS_REQUIRED',
      'slug and name are required.',
      422,
    );
  }
  const payload: Record<string, unknown> = { slug, name };
  if (body.timezone?.trim()) payload.timezone = body.timezone.trim();
  if (body.redemptionOpensAt?.trim()) {
    payload.redemptionOpensAt = body.redemptionOpensAt.trim();
  }
  if (body.redemptionClosesAt?.trim()) {
    payload.redemptionClosesAt = body.redemptionClosesAt.trim();
  }
  return forwardWithBearer(createEventUpstreamPath(tenantId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function GET() {
  return bffApiError('METHOD_NOT_ALLOWED', 'Use POST.', 405);
}
