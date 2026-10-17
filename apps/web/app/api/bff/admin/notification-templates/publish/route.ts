import { parseTemplatePublishBody } from '../../../../../../src/admin/notification-bff-body';
import { templatePublishUpstreamPath } from '../../../../../../src/admin/notifications';
import { assertSameOrigin } from '../../../../../../src/bff/origin';
import {
  bffApiError,
  forwardWithBearer,
} from '../../../../../../src/bff/upstream';

/**
 * POST publish notification template version (allowlisted vars only).
 * Requires Idempotency-Key. Upstream rejects invalid custom templates.
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
  const parsed = parseTemplatePublishBody(body);
  if (parsed instanceof Response) return parsed;
  return forwardWithBearer(templatePublishUpstreamPath(parsed.scope), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': parsed.idempotencyKey,
    },
    body: JSON.stringify(parsed.payload),
  });
}

export async function GET() {
  return bffApiError('METHOD_NOT_ALLOWED', 'Use POST.', 405);
}
