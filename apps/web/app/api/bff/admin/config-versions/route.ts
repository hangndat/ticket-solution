import { assertSameOrigin } from '../../../../../src/bff/origin';
import { bffApiError, forwardWithBearer, isUuid } from '../../../../../src/bff/upstream';
import {
  parseTypedConfigPayload,
  requireConfigScope,
} from '../../../../../src/admin/config-bff-body';
import {
  configVersionsUpstreamPath,
} from '../../../../../src/admin/config-api';
import { CONFIG_SCHEMA_VERSION } from '../../../../../src/admin/config-schema';

type Body = {
  tenantId?: string;
  eventId?: string;
  payload?: unknown;
  schemaVersion?: number;
};

/**
 * POST — save typed EventConfigPayload draft version.
 * GET ?tenantId=&eventId=&cursor= — paginated history (auth event.config).
 */
export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const scope = requireConfigScope(body);
  if (scope instanceof Response) return scope;
  const payload = parseTypedConfigPayload(body.payload);
  if (payload instanceof Response) return payload;
  const schemaVersion =
    Number.isInteger(body.schemaVersion) && (body.schemaVersion ?? 0) >= 1
      ? body.schemaVersion
      : CONFIG_SCHEMA_VERSION;
  return forwardWithBearer(configVersionsUpstreamPath(scope), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload, schemaVersion }),
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenantId')?.trim() ?? '';
  const eventId = url.searchParams.get('eventId')?.trim() ?? '';
  if (!isUuid(tenantId) || !isUuid(eventId)) {
    return bffApiError(
      'SCOPE_REQUIRED',
      'tenantId and eventId must be UUIDs.',
      422,
    );
  }
  const cursor = url.searchParams.get('cursor')?.trim();
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return forwardWithBearer(
    `${configVersionsUpstreamPath({ tenantId, eventId })}${qs}`,
    { method: 'GET' },
  );
}
