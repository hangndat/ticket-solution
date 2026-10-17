import {
  assetFinalizeUpstreamPath,
} from '../../../../../../src/admin/config-api';
import {
  parseAssetFinalizeBody,
  requireConfigScope,
} from '../../../../../../src/admin/config-bff-body';
import { assertSameOrigin } from '../../../../../../src/bff/origin';
import { bffApiError, forwardWithBearer } from '../../../../../../src/bff/upstream';

/**
 * POST asset finalize — server verifies magic bytes / dimensions / re-encode.
 * Body: { assetId } + tenantId + eventId.
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
  const scope = requireConfigScope({
    tenantId: typeof body.tenantId === 'string' ? body.tenantId : undefined,
    eventId: typeof body.eventId === 'string' ? body.eventId : undefined,
  });
  if (scope instanceof Response) return scope;
  const finalize = parseAssetFinalizeBody(body);
  if (finalize instanceof Response) return finalize;
  return forwardWithBearer(assetFinalizeUpstreamPath(scope), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(finalize),
  });
}
