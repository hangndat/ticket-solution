import { assertMutatingBrowser, ensureCsrfCookie } from '../../../../../src/bff/csrf';
import { pickSearchParams } from '../../../../../src/bff/event-params';
import { isUuid } from '../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../src/bff/paths';
import { bffApiError, forwardPlatformBearer } from '../../../../../src/bff/upstream';

/** H-P1 — platform tenants list; platform cookie / audience only. */
export async function GET(request: Request) {
  await ensureCsrfCookie();
  const qs = pickSearchParams(new URL(request.url), ['cursor', 'limit']);
  const res = await forwardPlatformBearer(
    `${PORTAL_UPSTREAM.platformTenants}${qs}`,
    { method: 'GET' },
  );
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(res.body, { status: res.status, headers });
}

type PostBody = {
  slug?: string;
  name?: string;
  defaultTimezone?: string;
  contact?: string | null;
  ownerEmail?: string;
  limits?: {
    maxEvents?: number | null;
    maxStaff?: number | null;
    emailPerDay?: number | null;
    importRowsPerJob?: number | null;
  };
  flags?: { importsEnabled?: boolean; exportsEnabled?: boolean };
  idempotencyKey?: string;
};

/** POST — provision tenant + pending owner invite (Operator MFA). */
export async function POST(request: Request) {
  const csrf = await assertMutatingBrowser(request);
  if (csrf) return csrf;
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
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
  const slug = body.slug?.trim() ?? '';
  const name = body.name?.trim() ?? '';
  const defaultTimezone = body.defaultTimezone?.trim() ?? '';
  const ownerEmail = body.ownerEmail?.trim() ?? '';
  if (!slug || !name || !defaultTimezone || !ownerEmail) {
    return bffApiError(
      'INVALID_INPUT',
      'slug, name, defaultTimezone, ownerEmail are required.',
      422,
    );
  }
  if (!body.limits || !body.flags) {
    return bffApiError(
      'INVALID_INPUT',
      'limits and flags objects are required.',
      422,
    );
  }
  const payload = {
    slug,
    name,
    defaultTimezone,
    contact: body.contact ?? null,
    ownerEmail,
    limits: {
      maxEvents: body.limits.maxEvents ?? null,
      maxStaff: body.limits.maxStaff ?? null,
      emailPerDay: body.limits.emailPerDay ?? null,
      importRowsPerJob: body.limits.importRowsPerJob ?? null,
    },
    flags: {
      importsEnabled: Boolean(body.flags.importsEnabled),
      exportsEnabled: Boolean(body.flags.exportsEnabled),
    },
  };
  const res = await forwardPlatformBearer(PORTAL_UPSTREAM.platformTenants, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(res.body, { status: res.status, headers });
}
