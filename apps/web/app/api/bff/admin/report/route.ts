import { reportUpstreamPath } from '../../../../../src/admin/report';
import { isScope, scopeError } from '../../../../../src/admin/scope';
import {
  bffApiError,
  forwardWithBearer,
} from '../../../../../src/bff/upstream';

/** GET /api/bff/admin/report → OpenAPI event report with the bearer cookie. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = scopeError({
    tenantId: url.searchParams.get('tenantId') ?? undefined,
    eventId: url.searchParams.get('eventId') ?? undefined,
  });
  if (!isScope(scope)) return scope;
  return forwardWithBearer(reportUpstreamPath(scope), { method: 'GET' });
}

export async function POST() {
  return bffApiError('METHOD_NOT_ALLOWED', 'Use GET.', 405);
}
