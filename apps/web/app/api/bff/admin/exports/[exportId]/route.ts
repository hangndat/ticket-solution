import { exportStatusPath } from '../../../../../../src/admin/export-job';
import { isScope, scopeError } from '../../../../../../src/admin/scope';
import { isUuid } from '../../../../../../src/bff/ids';
import {
  bffApiError,
  forwardWithBearer,
} from '../../../../../../src/bff/upstream';

type Props = { params: Promise<{ exportId: string }> };

/** GET /api/bff/admin/exports/{exportId}?tenantId&eventId */
export async function GET(request: Request, { params }: Props) {
  const { exportId: rawId } = await params;
  const exportId = rawId?.trim() ?? '';
  if (!isUuid(exportId)) {
    return bffApiError('EXPORT_ID_REQUIRED', 'exportId must be a UUID.', 422);
  }
  const url = new URL(request.url);
  const scope = scopeError({
    tenantId: url.searchParams.get('tenantId') ?? undefined,
    eventId: url.searchParams.get('eventId') ?? undefined,
  });
  if (!isScope(scope)) return scope;
  return forwardWithBearer(exportStatusPath(scope, exportId), {
    method: 'GET',
  });
}

export async function POST() {
  return bffApiError('METHOD_NOT_ALLOWED', 'Use GET or /download.', 405);
}
