import { assertMutatingBrowserAsync } from '../../../../../../src/bff/csrf';
import { bffApiError, isUuid } from '../../../../../../src/bff/upstream';
import { PLATFORM_PATHS } from '../../../../../../src/platform/contracts';
import type { MembershipRole } from '../../../../../../src/platform/contracts';
import { forwardTenantBearer } from '../../../../../../src/platform/forward';

type Props = { params: Promise<{ tenantId: string }> };

type Body = {
  email?: string;
  role?: MembershipRole;
  eventAssignments?: Array<{ eventId: string; role: MembershipRole }>;
  idempotencyKey?: string;
};

const ROLES = new Set(['Owner', 'Manager', 'CS', 'Supervisor', 'Scanner']);

export async function GET(request: Request, { params }: Props) {
  const { tenantId: raw } = await params;
  const tenantId = raw?.trim() ?? '';
  if (!isUuid(tenantId)) {
    return bffApiError('INVALID_INPUT', 'tenantId must be a UUID.', 422);
  }
  return forwardTenantBearer(PLATFORM_PATHS.invites(tenantId), {
    method: 'GET',
  });
}

export async function POST(request: Request, { params }: Props) {
  const csrf = await assertMutatingBrowserAsync(request);
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
  const email = body.email?.trim() ?? '';
  const role = body.role;
  if (!email || !role || !ROLES.has(role)) {
    return bffApiError(
      'INVALID_INPUT',
      'email and role (Owner|Manager|CS|Supervisor|Scanner) required.',
      422,
    );
  }
  const payload: Record<string, unknown> = { email, role };
  if (body.eventAssignments?.length) {
    payload.eventAssignments = body.eventAssignments;
  }
  return forwardTenantBearer(PLATFORM_PATHS.invites(tenantId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
}
