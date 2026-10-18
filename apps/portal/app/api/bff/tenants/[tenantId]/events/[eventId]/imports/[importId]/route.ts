import {
  isEventParams,
  requireEventParams,
} from '../../../../../../../../../src/bff/event-params';
import { isUuid } from '../../../../../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../../../../../src/bff/paths';
import {
  bffApiError,
  forwardStaffBearer,
} from '../../../../../../../../../src/bff/upstream';

type Props = {
  params: Promise<{ tenantId: string; eventId: string; importId: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  const resolved = await params;
  const scope = await requireEventParams(
    Promise.resolve({
      tenantId: resolved.tenantId,
      eventId: resolved.eventId,
    }),
  );
  if (!isEventParams(scope)) return scope;
  const importId = resolved.importId?.trim() ?? '';
  if (!isUuid(importId)) {
    return bffApiError('IMPORT_NOT_FOUND', 'importId must be a UUID.', 422);
  }
  return forwardStaffBearer(
    PORTAL_UPSTREAM.importJob(scope.tenantId, scope.eventId, importId),
    { method: 'GET' },
  );
}
