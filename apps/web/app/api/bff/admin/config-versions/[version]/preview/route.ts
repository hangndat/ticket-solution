import {
  configPreviewUpstreamPath,
} from '../../../../../../../src/admin/config-api';
import { parsePreviewVersionParam } from '../../../../../../../src/admin/config-bff-body';
import { bffApiError, forwardWithBearer, isUuid } from '../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ version: string }> };

/**
 * GET authenticated rendered-preview payload for a config version.
 * Forces Cache-Control: no-store on the BFF response.
 */
export async function GET(request: Request, { params }: Props) {
  const { version: rawVersion } = await params;
  const version = parsePreviewVersionParam(rawVersion?.trim() ?? '');
  if (version instanceof Response) return version;

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

  const upstream = await forwardWithBearer(
    configPreviewUpstreamPath({ tenantId, eventId }, version),
    { method: 'GET' },
  );

  const headers = new Headers(upstream.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('Pragma', 'no-cache');
  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
