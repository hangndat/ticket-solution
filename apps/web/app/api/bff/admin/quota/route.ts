import { bffApiError, forwardWithBearer } from '../../../../../src/bff/upstream';
import { eventPath, isScope, scopeError } from '../../../../../src/admin/scope';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = scopeError({
    tenantId: url.searchParams.get('tenantId') ?? undefined,
    eventId: url.searchParams.get('eventId') ?? undefined,
  });
  if (!isScope(scope)) return scope;
  return forwardWithBearer(eventPath(scope, 'quota'), { method: 'GET' });
}

export async function POST() {
  return bffApiError('METHOD_NOT_ALLOWED', 'Use GET.', 405);
}
