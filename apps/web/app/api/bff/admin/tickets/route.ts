import { ticketsListPath } from '../../../../../src/admin/cs';
import { isScope, scopeError } from '../../../../../src/admin/scope';
import {
  bffApiError,
  forwardWithBearer,
} from '../../../../../src/bff/upstream';

/** GET /api/bff/admin/tickets?tenantId&eventId&q&limit&cursor */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = scopeError({
    tenantId: url.searchParams.get('tenantId') ?? undefined,
    eventId: url.searchParams.get('eventId') ?? undefined,
  });
  if (!isScope(scope)) return scope;
  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw ? Number(limitRaw) : undefined;
  return forwardWithBearer(
    ticketsListPath(scope, {
      q: url.searchParams.get('q') ?? undefined,
      limit:
        typeof limit === 'number' && Number.isFinite(limit) ? limit : undefined,
      cursor: url.searchParams.get('cursor') ?? undefined,
    }),
    { method: 'GET' },
  );
}

export async function POST() {
  return bffApiError('METHOD_NOT_ALLOWED', 'Use GET.', 405);
}
