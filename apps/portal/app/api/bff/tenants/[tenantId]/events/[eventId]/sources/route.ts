import { assertMutatingBrowser } from '../../../../../../../../src/bff/csrf';
import { isUuid } from '../../../../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../../../../src/bff/paths';
import { bffApiError, forwardStaffBearer } from '../../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string; eventId: string }> };

export async function GET(request: Request, { params }: Props) {
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
  const url = new URL(request.url);
  const qs = new URLSearchParams();
  const cursor = url.searchParams.get('cursor')?.trim();
  const limit = url.searchParams.get('limit')?.trim();
  if (cursor) qs.set('cursor', cursor);
  if (limit) qs.set('limit', limit);
  const suffix = qs.toString() ? `?${qs}` : '';
  return forwardStaffBearer(
    `${PORTAL_UPSTREAM.sources(tenantId, eventId)}${suffix}`,
    { method: 'GET' },
  );
}

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
  let body: {
    name?: string;
    approvalMode?: string;
    ticketTypeId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const name = body.name?.trim() ?? '';
  const approvalMode = body.approvalMode?.trim() ?? '';
  const ticketTypeId = body.ticketTypeId?.trim() ?? '';
  if (!name || !isUuid(ticketTypeId)) {
    return bffApiError(
      'SOURCE_FIELDS_REQUIRED',
      'name and ticketTypeId (UUID) are required.',
      422,
    );
  }
  if (approvalMode !== 'AUTO' && approvalMode !== 'MANUAL') {
    return bffApiError(
      'INVALID_APPROVAL_MODE',
      'approvalMode must be AUTO or MANUAL.',
      422,
    );
  }
  return forwardStaffBearer(PORTAL_UPSTREAM.sources(tenantId, eventId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, approvalMode, ticketTypeId }),
  });
}
