import { assertMutatingBrowser } from '../../../../../../../src/bff/csrf';
import { isUuid } from '../../../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../../../src/bff/paths';
import {
  bffApiError,
  forwardPlatformBearer,
} from '../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string }> };

type Body = {
  limits?: {
    maxEvents?: number | null;
    maxStaff?: number | null;
    emailPerDay?: number | null;
    importRowsPerJob?: number | null;
  };
  flags?: { importsEnabled?: boolean; exportsEnabled?: boolean };
  reason?: string;
  expectedVersion?: number;
  idempotencyKey?: string;
};

export async function PUT(request: Request, { params }: Props) {
  const csrf = await assertMutatingBrowser(request);
  if (csrf) return csrf;
  const { tenantId: raw } = await params;
  const tenantId = raw?.trim() ?? '';
  if (!isUuid(tenantId)) {
    return bffApiError('INVALID_INPUT', 'tenantId must be a UUID.', 422);
  }
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
  const reason = body.reason?.trim() ?? '';
  if (reason.length < 1 || reason.length > 500) {
    return bffApiError('INVALID_INPUT', 'reason must be 1..500 chars.', 422);
  }
  if (
    typeof body.expectedVersion !== 'number' ||
    !Number.isInteger(body.expectedVersion) ||
    !body.limits ||
    !body.flags
  ) {
    return bffApiError(
      'INVALID_INPUT',
      'limits, flags, expectedVersion required.',
      422,
    );
  }
  const res = await forwardPlatformBearer(
    PORTAL_UPSTREAM.platformTenantLimits(tenantId),
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
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
        reason,
        expectedVersion: body.expectedVersion,
      }),
    },
  );
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(res.body, { status: res.status, headers });
}
