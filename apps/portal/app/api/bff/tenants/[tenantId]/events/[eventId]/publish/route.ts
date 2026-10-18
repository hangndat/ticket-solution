import { assertMutatingBrowser } from '../../../../../../../../src/bff/csrf';
import { isUuid } from '../../../../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../../../../src/bff/paths';
import { bffApiError, forwardStaffBearer } from '../../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string; eventId: string }> };

export async function POST(request: Request, { params }: Props) {
  const csrf = await assertMutatingBrowser(request);
  if (csrf) return csrf;
  const { tenantId: rawT, eventId: rawE } = await params;
  const tenantId = rawT?.trim() ?? '';
  const eventId = rawE?.trim() ?? '';
  if (!isUuid(tenantId) || !isUuid(eventId)) {
    return bffApiError(
      'SCOPE_REQUIRED',
      'tenantId and eventId must be UUIDs.',
      422,
    );
  }
  let body: { expectedVersion?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  if (
    typeof body.expectedVersion !== 'number' ||
    !Number.isInteger(body.expectedVersion) ||
    body.expectedVersion < 1
  ) {
    return bffApiError(
      'CONFIG_VERSION_REQUIRED',
      'expectedVersion must be a positive integer.',
      422,
    );
  }
  return forwardStaffBearer(PORTAL_UPSTREAM.publish(tenantId, eventId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedVersion: body.expectedVersion }),
  });
}
