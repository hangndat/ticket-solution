import {
  isEventParams,
  requireEventParams,
} from '../../../../../../../../../../src/bff/event-params';
import { isUuid } from '../../../../../../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../../../../../../src/bff/paths';
import {
  bffApiError,
  forwardStaffBearer,
} from '../../../../../../../../../../src/bff/upstream';

type Props = {
  params: Promise<{ tenantId: string; eventId: string; exportId: string }>;
};

/** Authenticated CSV download — never a presigned URL in the DTO. */
export async function GET(_request: Request, { params }: Props) {
  const resolved = await params;
  const scope = await requireEventParams(
    Promise.resolve({
      tenantId: resolved.tenantId,
      eventId: resolved.eventId,
    }),
  );
  if (!isEventParams(scope)) return scope;
  const exportId = resolved.exportId?.trim() ?? '';
  if (!isUuid(exportId)) {
    return bffApiError('EXPORT_ID_REQUIRED', 'exportId must be a UUID.', 422);
  }
  return forwardStaffBearer(
    PORTAL_UPSTREAM.exportDownload(scope.tenantId, scope.eventId, exportId),
    {
      method: 'GET',
      headers: { Accept: 'text/csv, application/octet-stream, text/plain' },
    },
  );
}
