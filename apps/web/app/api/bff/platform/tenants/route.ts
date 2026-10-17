import { assertMutatingBrowserAsync } from '../../../../../src/bff/csrf';
import { bffApiError, isUuid } from '../../../../../src/bff/upstream';
import { PLATFORM_PATHS } from '../../../../../src/platform/contracts';
import { forwardPlatformBearer } from '../../../../../src/platform/forward';

/** GET /api/bff/platform/tenants — list (operator). */
export async function GET() {
  return forwardPlatformBearer(PLATFORM_PATHS.platformTenants, {
    method: 'GET',
  });
}

type Body = {
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

/** POST create tenant + pending owner invite. */
export async function POST(request: Request) {
  const csrf = await assertMutatingBrowserAsync(request);
  if (csrf) return csrf;
  let body: Body;
  try {
    body = (await request.json()) as Body;
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
  return forwardPlatformBearer(PLATFORM_PATHS.platformTenants, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
}
