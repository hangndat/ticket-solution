import { ensureCsrfCookie } from '../../../../../../../src/bff/csrf';
import { forwardPublic } from '../../../../../../../src/bff/upstream';

type Params = {
  params: Promise<{ tenantSlug: string }>;
};

/**
 * Public published event list (ADR-19).
 * GET /v1/public/tenants/{tenantSlug}/events?cursor=&limit=
 * Issues CSRF cookie so redeem mutate can double-submit after browsing.
 */
export async function GET(request: Request, { params }: Params) {
  await ensureCsrfCookie();
  const { tenantSlug } = await params;
  const t = tenantSlug?.trim() ?? '';
  if (!t) {
    return Response.json(
      {
        code: 'SCOPE_REQUIRED',
        message: 'tenantSlug is required.',
        requestId: crypto.randomUUID(),
        retryable: false,
      },
      { status: 422 },
    );
  }

  const incoming = new URL(request.url);
  const qs = new URLSearchParams();
  const cursor = incoming.searchParams.get('cursor');
  const limit = incoming.searchParams.get('limit');
  if (cursor) qs.set('cursor', cursor);
  if (limit) qs.set('limit', limit);
  const query = qs.toString();
  const path = `/v1/public/tenants/${encodeURIComponent(t)}/events${query ? `?${query}` : ''}`;

  const res = await forwardPublic(path, { method: 'GET' });
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(res.body, { status: res.status, headers });
}
