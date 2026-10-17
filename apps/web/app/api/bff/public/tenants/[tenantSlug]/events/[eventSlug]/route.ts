import { ensureCsrfCookie } from '../../../../../../../../src/bff/csrf';
import { forwardPublic } from '../../../../../../../../src/bff/upstream';

type Params = {
  params: Promise<{ tenantSlug: string; eventSlug: string }>;
};

/**
 * Public published event projection (form + terms).
 * GET /v1/public/tenants/{tenantSlug}/events/{eventSlug}
 * Issues CSRF cookie (Route Handler) so redeem mutate can double-submit.
 */
export async function GET(_request: Request, { params }: Params) {
  await ensureCsrfCookie();
  const { tenantSlug, eventSlug } = await params;
  const t = tenantSlug?.trim() ?? '';
  const e = eventSlug?.trim() ?? '';
  if (!t || !e) {
    return Response.json(
      {
        code: 'SCOPE_REQUIRED',
        message: 'tenantSlug and eventSlug are required.',
        requestId: crypto.randomUUID(),
        retryable: false,
      },
      { status: 422 },
    );
  }

  const path = `/v1/public/tenants/${encodeURIComponent(t)}/events/${encodeURIComponent(e)}`;
  const res = await forwardPublic(path, { method: 'GET' });
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(res.body, { status: res.status, headers });
}
