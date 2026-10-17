import {
  assetUploadInitUpstreamPath,
} from '../../../../../../src/admin/config-api';
import {
  parseAssetInitBody,
  requireConfigScope,
} from '../../../../../../src/admin/config-bff-body';
import { assertSameOrigin } from '../../../../../../src/bff/origin';
import { bffApiError, forwardWithBearer } from '../../../../../../src/bff/upstream';

/**
 * POST asset upload-init — server mints quarantine key + upload URL.
 * Body: AssetUploadInitBody + tenantId + eventId.
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
  const init = parseAssetInitBody(body);
  if (init instanceof Response) return init;
  return forwardWithBearer(assetUploadInitUpstreamPath(scope), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(init),
  });
}
