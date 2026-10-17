import { forwardPublic } from '../../../../../../../../src/bff/upstream';

type Params = {
  params: Promise<{ tenantSlug: string; eventSlug: string }>;
};

/**
 * Public published event projection (form + terms).
 * GET /v1/public/tenants/{tenantSlug}/events/{eventSlug}
 */
export async function GET(_request: Request, { params }: Params) {
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
  return forwardPublic(path, { method: 'GET' });
}
