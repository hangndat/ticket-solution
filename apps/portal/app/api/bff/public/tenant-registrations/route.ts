import { assertMutatingBrowser } from '../../../../../src/bff/csrf';
import { isUuid } from '../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../src/bff/paths';
import { bffApiError, forwardStaffBearer } from '../../../../../src/bff/upstream';
import { normalizeRegistrationBody } from '../../../../../src/onboarding/registration';

/**
 * POST /api/bff/public/tenant-registrations
 * → Nest POST /v1/public/tenant-registrations (Bearer + Idempotency-Key).
 * Creates tenant PENDING — never auto-ACTIVE (P2-ONBOARD-PENDING).
 */
export async function POST(request: Request) {
  const csrf = await assertMutatingBrowser(request);
  if (csrf) return csrf;

  let body: {
    slug?: string;
    name?: string;
    defaultTimezone?: string;
    contact?: string | null;
    idempotencyKey?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }

  const idempotencyKey = body.idempotencyKey?.trim() ?? '';
  if (!isUuid(idempotencyKey)) {
    return bffApiError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'idempotencyKey must be a UUID.',
      422,
    );
  }

  const payload = normalizeRegistrationBody(body);
  if (!payload) {
    return bffApiError(
      'INVALID_INPUT',
      'slug (kebab) and name (1–200) are required.',
      422,
    );
  }

  return forwardStaffBearer(PORTAL_UPSTREAM.tenantRegistrations, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
}
