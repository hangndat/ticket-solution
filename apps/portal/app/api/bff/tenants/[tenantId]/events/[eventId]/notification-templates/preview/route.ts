import { assertMutatingBrowser } from '../../../../../../../../../src/bff/csrf';
import {
  isEventParams,
  requireEventParams,
} from '../../../../../../../../../src/bff/event-params';
import { parseTemplatePreviewBody } from '../../../../../../../../../src/bff/notification-bff-body';
import { PORTAL_UPSTREAM } from '../../../../../../../../../src/bff/paths';
import {
  bffApiError,
  forwardStaffBearer,
} from '../../../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string; eventId: string }> };

/** POST template preview — server-escaped variables, no-store. */
export async function POST(request: Request, { params }: Props) {
  const csrf = await assertMutatingBrowser(request);
  if (csrf) return csrf;
  const scope = await requireEventParams(params);
  if (!isEventParams(scope)) return scope;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const parsed = parseTemplatePreviewBody(body);
  if (parsed instanceof Response) return parsed;
  const upstream = await forwardStaffBearer(
    PORTAL_UPSTREAM.notificationTemplatePreview(
      scope.tenantId,
      scope.eventId,
    ),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.payload),
    },
  );
  const headers = new Headers(upstream.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('Pragma', 'no-cache');
  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}

export async function GET() {
  return bffApiError('METHOD_NOT_ALLOWED', 'Use POST.', 405);
}
