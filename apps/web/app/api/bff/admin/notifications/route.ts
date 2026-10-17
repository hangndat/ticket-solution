import { notificationsListUpstreamPath } from '../../../../../src/admin/notifications';
import { assertSameOrigin } from '../../../../../src/bff/origin';
import {
  bffApiError,
  forwardWithBearer,
  isUuid,
} from '../../../../../src/bff/upstream';

/**
 * GET /api/bff/admin/notifications?tenantId&eventId&cursor
 * Lists notification attempt summaries — no raw PII/tokens.
 * Cache-Control: no-store. Requires event.config (upstream).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenantId')?.trim() ?? '';
  const eventId = url.searchParams.get('eventId')?.trim() ?? '';
  const cursor = url.searchParams.get('cursor')?.trim() ?? '';
  if (!isUuid(tenantId) || !isUuid(eventId)) {
    return bffApiError(
      'SCOPE_REQUIRED',
      'tenantId and eventId must be UUIDs.',
      422,
    );
  }
  if (cursor && !isUuid(cursor)) {
    return bffApiError('INVALID_INPUT', 'cursor must be a UUID when set.', 422);
  }
  const upstream = await forwardWithBearer(
    notificationsListUpstreamPath({ tenantId, eventId }, cursor || null),
    { method: 'GET' },
  );
  const headers = new Headers(upstream.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('Pragma', 'no-cache');
  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  return bffApiError('METHOD_NOT_ALLOWED', 'Use GET to list notifications.', 405);
}
