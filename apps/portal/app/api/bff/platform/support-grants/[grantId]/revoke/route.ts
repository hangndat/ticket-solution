import { assertMutatingBrowser } from '../../../../../../../src/bff/csrf';
import { isUuid } from '../../../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../../../src/bff/paths';
import {
  bffApiError,
  forwardPlatformBearer,
} from '../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ grantId: string }> };

/**
 * Support grant revoke — Operator MFA platform audience only.
 * Body: { reason } (required, ≤500). Fail-closed without CSRF/Origin.
 */
export async function POST(request: Request, { params }: Props) {
  const csrf = await assertMutatingBrowser(request);
  if (csrf) return csrf;

  const { grantId: raw } = await params;
  const grantId = raw?.trim() ?? '';
  if (!isUuid(grantId)) {
    return bffApiError('INVALID_INPUT', 'grantId must be a UUID.', 422);
  }

  let body: { reason?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }

  const reason = body.reason?.trim() ?? '';
  if (!reason) {
    return bffApiError('REASON_REQUIRED', 'reason is required.', 422);
  }
  if (reason.length > 500) {
    return bffApiError('INVALID_INPUT', 'reason max 500 characters.', 422);
  }

  const res = await forwardPlatformBearer(
    PORTAL_UPSTREAM.platformSupportGrantRevoke(grantId),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    },
  );
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(res.body, { status: res.status, headers });
}
