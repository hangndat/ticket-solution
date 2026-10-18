import { isUuid } from '../../../../../../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../../../../../../src/bff/paths';
import { bffApiError, forwardStaffBearer } from '../../../../../../../../../../src/bff/upstream';

type Props = {
  params: Promise<{ tenantId: string; eventId: string; version: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  const { tenantId: rawT, eventId: rawE, version: rawV } = await params;
  const tenantId = rawT?.trim() ?? '';
  const eventId = rawE?.trim() ?? '';
  const version = Number(rawV);
  if (!isUuid(tenantId) || !isUuid(eventId) || !Number.isInteger(version) || version < 1) {
    return bffApiError(
      'SCOPE_REQUIRED',
      'tenantId, eventId UUIDs and positive version required.',
      422,
    );
  }
  return forwardStaffBearer(
    PORTAL_UPSTREAM.configPreview(tenantId, eventId, version),
    { method: 'GET' },
  );
}
