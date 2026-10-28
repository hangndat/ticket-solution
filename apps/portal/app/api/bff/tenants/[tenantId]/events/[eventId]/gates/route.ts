import { assertMutatingBrowser } from '../../../../../../../../src/bff/csrf';
import { isUuid } from '../../../../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../../../../src/bff/paths';
import { bffApiError, forwardStaffBearer } from '../../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string; eventId: string }> };

async function scope(params: Props['params']) {
  const { tenantId: rawT, eventId: rawE } = await params;
  const tenantId = rawT?.trim() ?? '';
  const eventId = rawE?.trim() ?? '';
  return isUuid(tenantId) && isUuid(eventId) ? { tenantId, eventId } : null;
}

const BAD_SCOPE = () =>
  bffApiError('SCOPE_REQUIRED', 'tenantId and eventId must be UUIDs.', 422);

export async function GET(_request: Request, { params }: Props) {
  const s = await scope(params);
  if (!s) return BAD_SCOPE();
  return forwardStaffBearer(PORTAL_UPSTREAM.gates(s.tenantId, s.eventId), {
    method: 'GET',
  });
}

export async function POST(request: Request, { params }: Props) {
  const csrf = await assertMutatingBrowser(request);
  if (csrf) return csrf;
  const s = await scope(params);
  if (!s) return BAD_SCOPE();
  let body: { name?: unknown; sortOrder?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 80) {
    return bffApiError('NAME_INVALID', 'name must be 1-80 characters.', 422);
  }
  const payload: Record<string, unknown> = { tenantId: s.tenantId, name };
  if (body.sortOrder !== undefined && body.sortOrder !== null) {
    if (!Number.isInteger(body.sortOrder)) {
      return bffApiError('SORT_INVALID', 'sortOrder must be an integer.', 422);
    }
    payload.sortOrder = body.sortOrder;
  }
  return forwardStaffBearer(
    PORTAL_UPSTREAM.gateCreate(s.eventId),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
}
