import { parseReminderPreviewBody } from '../../../../../../src/admin/notification-bff-body';
import { reminderPreviewUpstreamPath } from '../../../../../../src/admin/notifications';
import { assertSameOrigin } from '../../../../../../src/bff/origin';
import {
  bffApiError,
  forwardWithBearer,
} from '../../../../../../src/bff/upstream';

/**
 * POST reminder preview — recipientCount only (no PII list).
 * Stale expectedEventRevision → REVISION_CONFLICT upstream.
 */
export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const parsed = parseReminderPreviewBody(body);
  if (parsed instanceof Response) return parsed;
  const upstream = await forwardWithBearer(
    reminderPreviewUpstreamPath(parsed.scope),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.payload),
    },
  );
  const headers = new Headers(upstream.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}

export async function GET() {
  return bffApiError('METHOD_NOT_ALLOWED', 'Use POST.', 405);
}
