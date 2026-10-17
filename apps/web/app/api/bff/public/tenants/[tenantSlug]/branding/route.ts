import { ensureCsrfCookie } from '../../../../../../../src/bff/csrf';
import { forwardPublic } from '../../../../../../../src/bff/upstream';
import {
  isTenantSlug,
  parseTenantBranding,
  toBrandingDto,
  VEMOKI_BRANDING,
} from '../../../../../../../src/branding';

type Params = {
  params: Promise<{ tenantSlug: string }>;
};

/**
 * Public tenant branding for web theming (D8-S2).
 * Proxies GET /v1/public/tenants/{tenantSlug}/branding.
 * On upstream miss/error → 200 with Vemoki fallback (chrome never blank).
 */
export async function GET(_request: Request, { params }: Params) {
  await ensureCsrfCookie();
  const { tenantSlug } = await params;
  const slug = tenantSlug?.trim().toLowerCase() ?? '';
  if (!slug || !isTenantSlug(slug)) {
    return Response.json(
      {
        code: 'INVALID_INPUT',
        message: 'tenantSlug must be a lowercase slug.',
        requestId: crypto.randomUUID(),
        retryable: false,
      },
      { status: 422, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const path = `/v1/public/tenants/${encodeURIComponent(slug)}/branding`;
  const upstream = await forwardPublic(path, { method: 'GET' });

  if (upstream.status >= 200 && upstream.status < 300) {
    try {
      const json: unknown = await upstream.json();
      const parsed = parseTenantBranding(json);
      if (parsed) {
        const body = toBrandingDto({
          ...parsed,
          tenantSlug: parsed.tenantSlug ?? slug,
          source: 'tenant',
        });
        return Response.json(
          { ...body, source: 'tenant' },
          {
            status: 200,
            headers: { 'Cache-Control': 'private, no-store' },
          },
        );
      }
    } catch {
      // fall through to Vemoki
    }
  }

  const fallback = toBrandingDto({ ...VEMOKI_BRANDING, tenantSlug: slug });
  return Response.json(
    { ...fallback, source: 'vemoki-default', upstreamStatus: upstream.status },
    {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
}
