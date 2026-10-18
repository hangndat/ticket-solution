import type { MembershipRole } from '@ticket/contracts';
import { assertMutatingBrowser } from '../../../../../../src/bff/csrf';
import { isUuid } from '../../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../../src/bff/paths';
import { bffApiError, forwardStaffBearer } from '../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string }> };

const ROLES = new Set<MembershipRole>([
  'Owner',
  'Manager',
  'CS',
  'Supervisor',
  'Scanner',
]);

export async function GET(request: Request, { params }: Props) {
  const { tenantId: raw } = await params;
  const tenantId = raw?.trim() ?? '';
  if (!isUuid(tenantId)) {
    return bffApiError('INVALID_INPUT', 'tenantId must be a UUID.', 422);
  }
  const url = new URL(request.url);
  const qs = new URLSearchParams();
  const cursor = url.searchParams.get('cursor')?.trim();
  const limit = url.searchParams.get('limit')?.trim();
  if (cursor) qs.set('cursor', cursor);
  if (limit) qs.set('limit', limit);
  const suffix = qs.toString() ? `?${qs}` : '';
  return forwardStaffBearer(`${PORTAL_UPSTREAM.invites(tenantId)}${suffix}`, {
    method: 'GET',
  });
}

export async function POST(request: Request, { params }: Props) {
  const csrf = await assertMutatingBrowser(request);
  if (csrf) return csrf;
  const { tenantId: raw } = await params;
  const tenantId = raw?.trim() ?? '';
  if (!isUuid(tenantId)) {
    return bffApiError('INVALID_INPUT', 'tenantId must be a UUID.', 422);
  }
  let body: {
    email?: string;
    role?: MembershipRole;
    eventAssignments?: Array<{ eventId: string; role: MembershipRole }>;
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
  const email = body.email?.trim() ?? '';
  const role = body.role;
  if (!email || !role || !ROLES.has(role)) {
    return bffApiError(
      'INVALID_INPUT',
      'email and role (Owner|Manager|CS|Supervisor|Scanner) required.',
      422,
    );
  }
  const assignments = body.eventAssignments ?? [];
  for (const a of assignments) {
    if (!isUuid(a.eventId) || !ROLES.has(a.role) || a.role === 'Owner') {
      return bffApiError(
        'INVALID_ASSIGNMENT',
        'eventAssignments require eventId UUID and non-Owner role.',
        422,
      );
    }
  }
  const payload: Record<string, unknown> = { email, role };
  if (assignments.length) payload.eventAssignments = assignments;
  return forwardStaffBearer(PORTAL_UPSTREAM.invites(tenantId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
}
