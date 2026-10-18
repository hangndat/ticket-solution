import { assertMutatingBrowser } from '../../../../../../../../../../src/bff/csrf';
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
  params: Promise<{ tenantId: string; eventId: string; importId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const csrf = await assertMutatingBrowser(request);
  if (csrf) return csrf;
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
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const payload: Record<string, unknown> = {};
  if (
    typeof body.mappingRevision === 'number' &&
    Number.isInteger(body.mappingRevision)
  ) {
    payload.mappingRevision = body.mappingRevision;
  }
  if (body.columnMapping && typeof body.columnMapping === 'object') {
    payload.columnMapping = body.columnMapping;
  }
  return forwardStaffBearer(
    PORTAL_UPSTREAM.importPreview(scope.tenantId, scope.eventId, importId),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
}
