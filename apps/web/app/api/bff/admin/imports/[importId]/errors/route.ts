import { importErrorsPath } from '../../../../../../../src/admin/import-job';
import { isScope, scopeError } from '../../../../../../../src/admin/scope';
import { isUuid } from '../../../../../../../src/bff/ids';
import {
  bffApiError,
  forwardWithBearer,
} from '../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ importId: string }> };

/** GET private error report (authz + TTL enforced upstream). */
export async function GET(request: Request, { params }: Props) {
  const { importId: rawId } = await params;
  const importId = rawId?.trim() ?? '';
  if (!isUuid(importId)) {
    return bffApiError('IMPORT_ID_REQUIRED', 'importId must be a UUID.', 422);
  }
  const url = new URL(request.url);
  const scope = scopeError({
    tenantId: url.searchParams.get('tenantId') ?? undefined,
    eventId: url.searchParams.get('eventId') ?? undefined,
  });
  if (!isScope(scope)) return scope;
  return forwardWithBearer(importErrorsPath(scope, importId), {
    method: 'GET',
  });
}

export async function POST() {
  return bffApiError('METHOD_NOT_ALLOWED', 'Use GET.', 405);
}
