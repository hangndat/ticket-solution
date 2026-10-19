import type { MembershipRole } from '@ticket/contracts';
import { assertMutatingBrowser } from '../../../../../../../../src/bff/csrf';
import { isUuid } from '../../../../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../../../../src/bff/paths';
import {
  bffApiError,
  forwardStaffBearer,
} from '../../../../../../../../src/bff/upstream';
import { isSystemMembershipRole } from '../../../../../../../../src/ops/role-presets';

type Props = { params: Promise<{ tenantId: string; membershipId: string }> };

/**
 * PATCH built-in MembershipRole only (H-M3/H-M4).
 * Preset assignment for existing members is invite-path; changeRole OpenAPI is enum-only.
 */
export async function PATCH(request: Request, { params }: Props) {
  const csrf = await assertMutatingBrowser(request);
  if (csrf) return csrf;
  const { tenantId: rawT, membershipId: rawM } = await params;
  const tenantId = rawT?.trim() ?? '';
  const membershipId = rawM?.trim() ?? '';
  if (!isUuid(tenantId) || !isUuid(membershipId)) {
    return bffApiError(
      'INVALID_INPUT',
      'tenantId and membershipId must be UUIDs.',
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
  if (!isSystemMembershipRole(role) || !reason) {
    return bffApiError(
      'INVALID_INPUT',
      'role (Owner|Manager|CS|Supervisor|Scanner) and reason required.',
      422,
    );
  }
  return forwardStaffBearer(PORTAL_UPSTREAM.memberRole(tenantId, membershipId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: role as MembershipRole, reason }),
  });
}
