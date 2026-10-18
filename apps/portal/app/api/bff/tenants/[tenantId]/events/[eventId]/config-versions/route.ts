import type { EventConfigPayload } from '@ticket/contracts';
import { assertMutatingBrowser } from '../../../../../../../../src/bff/csrf';
import { isUuid } from '../../../../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../../../../src/bff/paths';
import { bffApiError, forwardStaffBearer } from '../../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string; eventId: string }> };

function parsePayload(raw: unknown): EventConfigPayload | Response {
  if (!raw || typeof raw !== 'object') {
    return bffApiError('PAYLOAD_REQUIRED', 'payload object required.', 422);
  }
  const p = raw as Partial<EventConfigPayload>;
  if (
    typeof p.schemaVersion !== 'number' ||
    !Number.isInteger(p.schemaVersion) ||
    p.schemaVersion < 1
  ) {
    return bffApiError(
      'SCHEMA_VERSION_REQUIRED',
      'payload.schemaVersion must be a positive integer.',
      422,
    );
  }
  if (!p.brand || typeof p.brand !== 'object') {
    return bffApiError('BRAND_REQUIRED', 'payload.brand required.', 422);
  }
  if (!Array.isArray(p.sections)) {
    return bffApiError('SECTIONS_REQUIRED', 'payload.sections required.', 422);
  }
  return p as EventConfigPayload;
}

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
  const cursor = url.searchParams.get('cursor')?.trim();
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return forwardStaffBearer(
    `${PORTAL_UPSTREAM.configVersions(tenantId, eventId)}${qs}`,
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
  let body: { payload?: unknown; schemaVersion?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const payload = parsePayload(body.payload);
  if (payload instanceof Response) return payload;
  const schemaVersion =
    Number.isInteger(body.schemaVersion) && (body.schemaVersion ?? 0) >= 1
      ? body.schemaVersion
      : payload.schemaVersion;
  return forwardStaffBearer(PORTAL_UPSTREAM.configVersions(tenantId, eventId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload, schemaVersion }),
  });
}
