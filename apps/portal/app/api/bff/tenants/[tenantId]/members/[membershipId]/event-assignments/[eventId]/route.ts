import type { MembershipRole } from '@ticket/contracts';
import { assertMutatingBrowser } from '../../../../../../../../../src/bff/csrf';
import { isUuid } from '../../../../../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../../../../../src/bff/paths';
import {
  bffApiError,
  forwardStaffBearer,
} from '../../../../../../../../../src/bff/upstream';
import { eventAssignmentRoleAllowed } from '../../../../../../../../../src/ops/members-policy';
import { isSystemMembershipRole } from '../../../../../../../../../src/ops/role-presets';

type Props = {
  params: Promise<{ tenantId: string; membershipId: string; eventId: string }>;
};

export async function PUT(request: Request, { params }: Props) {
  const csrf = await assertMutatingBrowser(request);
  if (csrf) return csrf;
  const { tenantId: rawT, membershipId: rawM, eventId: rawE } = await params;
  const tenantId = rawT?.trim() ?? '';
  const membershipId = rawM?.trim() ?? '';
  const eventId = rawE?.trim() ?? '';
  if (!isUuid(tenantId) || !isUuid(membershipId) || !isUuid(eventId)) {
    return bffApiError(
      'INVALID_INPUT',
      'tenantId, membershipId and eventId must be UUIDs.',
      422,
    );
  }
  let body: { role?: unknown; reason?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  if (
    body &&
    typeof body === 'object' &&
    ('permissions' in body ||
      'tenantPermissions' in body ||
      'eventPermissions' in body)
  ) {
    return bffApiError(
      'INVALID_INPUT',
      'Client permission arrays are not allowed.',
      422,
    );
  }
  const role = typeof body.role === 'string' ? body.role.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (
    !isSystemMembershipRole(role) ||
    !eventAssignmentRoleAllowed(role) ||
    !reason
  ) {
    return bffApiError(
      'INVALID_ASSIGNMENT',
      'event assignment requires a non-Owner built-in role and reason.',
      422,
    );
  }
  return forwardStaffBearer(
    PORTAL_UPSTREAM.memberEventAssignment(tenantId, membershipId, eventId),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: role as MembershipRole, reason }),
    },
  );
}
