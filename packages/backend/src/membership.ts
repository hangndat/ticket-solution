import { randomUUID } from 'node:crypto';
import type { Prisma } from './generated/prisma/client';
import { AuthzError, AUTHZ_ERROR_CODES } from './authz-error';

export type MembershipRecord = {
  membershipId: string;
  tenantId: string;
  userId: string;
  role: string;
  permissions: string[];
  activatedAt: Date | null;
  revokedAt: Date | null;
};

export type EventAssignmentRecord = {
  assignmentId: string;
  tenantId: string;
  eventId: string;
  membershipId: string;
  permissions: string[];
  activatedAt: Date | null;
  revokedAt: Date | null;
};

export type RequireTenantPermissionInput = {
  tenantId: string;
  userId: string;
  permission: string;
  /** When set, also require an active event assignment that grants the permission. */
  eventId?: string;
};

export type GrantMembershipInput = {
  tenantId: string;
  userId: string;
  role: string;
  permissions?: string[];
  activatedAt?: Date | null;
};

export type GrantEventAssignmentInput = {
  tenantId: string;
  eventId: string;
  membershipId: string;
  permissions: string[];
  activatedAt?: Date | null;
};

type LockedMembershipRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  role: string;
  permissions: string[];
  activated_at: Date | null;
  revoked_at: Date | null;
};

type LockedAssignmentRow = {
  id: string;
  tenant_id: string;
  event_id: string;
  membership_id: string;
  permissions: string[];
  activated_at: Date | null;
  revoked_at: Date | null;
};

export function isMembershipActive(
  row: { activatedAt: Date | null; revokedAt: Date | null },
  at: Date = new Date(),
): boolean {
  return row.activatedAt !== null && row.activatedAt <= at && row.revokedAt === null;
}

function mapMembership(row: LockedMembershipRow): MembershipRecord {
  return {
    membershipId: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    role: row.role,
    permissions: row.permissions ?? [],
    activatedAt: row.activated_at,
    revokedAt: row.revoked_at,
  };
}

function mapAssignment(row: LockedAssignmentRow): EventAssignmentRecord {
  return {
    assignmentId: row.id,
    tenantId: row.tenant_id,
    eventId: row.event_id,
    membershipId: row.membership_id,
    permissions: row.permissions ?? [],
    activatedAt: row.activated_at,
    revokedAt: row.revoked_at,
  };
}

/**
 * Lock an active membership for a privileged tenant operation (FOR SHARE).
 * Revoke takes FOR UPDATE so it conflicts with in-flight shared locks (TD §5.2).
 */
export async function lockActiveMembershipForShare(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
): Promise<MembershipRecord> {
  const rows = await tx.$queryRaw<LockedMembershipRow[]>`
    SELECT id, tenant_id, user_id, role, permissions, activated_at, revoked_at
    FROM memberships
    WHERE tenant_id = ${tenantId}::uuid
      AND user_id = ${userId}::uuid
    FOR SHARE
  `;
  const row = rows[0];
  if (!row) {
    throw new AuthzError(
      AUTHZ_ERROR_CODES.MEMBERSHIP_REQUIRED,
      'No tenant membership for actor',
    );
  }
  if (row.revoked_at !== null) {
    throw new AuthzError(
      AUTHZ_ERROR_CODES.MEMBERSHIP_REVOKED,
      'Tenant membership has been revoked',
    );
  }
  if (row.activated_at === null) {
    throw new AuthzError(
      AUTHZ_ERROR_CODES.MEMBERSHIP_REQUIRED,
      'Tenant membership is not active',
    );
  }
  return mapMembership(row);
}

async function lockActiveEventAssignmentForShare(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
  membershipId: string,
): Promise<EventAssignmentRecord> {
  const rows = await tx.$queryRaw<LockedAssignmentRow[]>`
    SELECT id, tenant_id, event_id, membership_id, permissions, activated_at, revoked_at
    FROM event_assignments
    WHERE tenant_id = ${tenantId}::uuid
      AND event_id = ${eventId}::uuid
      AND membership_id = ${membershipId}::uuid
    FOR SHARE
  `;
  const row = rows[0];
  if (!row) {
    throw new AuthzError(
      AUTHZ_ERROR_CODES.EVENT_ASSIGNMENT_REQUIRED,
      'No event assignment for actor',
    );
  }
  if (row.revoked_at !== null || row.activated_at === null) {
    throw new AuthzError(
      AUTHZ_ERROR_CODES.EVENT_ASSIGNMENT_REQUIRED,
      'Event assignment is not active',
    );
  }
  return mapAssignment(row);
}

/**
 * Deny-by-default tenant authorization. Must run inside withTenant after identity.
 * Takes shared locks so a concurrent revoke waits until this transaction ends.
 */
export async function requireTenantPermission(
  tx: Prisma.TransactionClient,
  input: RequireTenantPermissionInput,
): Promise<{ membership: MembershipRecord; assignment?: EventAssignmentRecord }> {
  const membership = await lockActiveMembershipForShare(
    tx,
    input.tenantId,
    input.userId,
  );

  if (input.eventId) {
    const assignment = await lockActiveEventAssignmentForShare(
      tx,
      input.tenantId,
      input.eventId,
      membership.membershipId,
    );
    if (!assignment.permissions.includes(input.permission)) {
      throw new AuthzError(
        AUTHZ_ERROR_CODES.PERMISSION_DENIED,
        `Missing event permission: ${input.permission}`,
      );
    }
    return { membership, assignment };
  }

  if (!membership.permissions.includes(input.permission)) {
    throw new AuthzError(
      AUTHZ_ERROR_CODES.PERMISSION_DENIED,
      `Missing tenant permission: ${input.permission}`,
    );
  }
  return { membership };
}

/** Test/admin helper: create a membership row (defaults to immediately active). */
export async function grantMembership(
  tx: Prisma.TransactionClient,
  input: GrantMembershipInput,
): Promise<MembershipRecord> {
  const id = randomUUID();
  const activatedAt =
    input.activatedAt === undefined ? new Date() : input.activatedAt;
  const row = await tx.membership.create({
    data: {
      id,
      tenantId: input.tenantId,
      userId: input.userId,
      role: input.role,
      permissions: input.permissions ?? [],
      activatedAt,
    },
  });
  return {
    membershipId: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    role: row.role,
    permissions: row.permissions,
    activatedAt: row.activatedAt,
    revokedAt: row.revokedAt,
  };
}

/** Test/admin helper: grant event-scoped permissions on a membership. */
export async function grantEventAssignment(
  tx: Prisma.TransactionClient,
  input: GrantEventAssignmentInput,
): Promise<EventAssignmentRecord> {
  const id = randomUUID();
  const activatedAt =
    input.activatedAt === undefined ? new Date() : input.activatedAt;
  const row = await tx.eventAssignment.create({
    data: {
      id,
      tenantId: input.tenantId,
      eventId: input.eventId,
      membershipId: input.membershipId,
      permissions: input.permissions,
      activatedAt,
    },
  });
  return {
    assignmentId: row.id,
    tenantId: row.tenantId,
    eventId: row.eventId,
    membershipId: row.membershipId,
    permissions: row.permissions,
    activatedAt: row.activatedAt,
    revokedAt: row.revokedAt,
  };
}

/**
 * Revoke membership after FOR UPDATE lock (conflicts with FOR SHARE on privileged ops).
 * Subsequent requireTenantPermission calls fail once this transaction commits.
 */
export async function revokeMembership(
  tx: Prisma.TransactionClient,
  tenantId: string,
  membershipId: string,
  revokedAt: Date = new Date(),
): Promise<MembershipRecord> {
  const rows = await tx.$queryRaw<LockedMembershipRow[]>`
    SELECT id, tenant_id, user_id, role, permissions, activated_at, revoked_at
    FROM memberships
    WHERE tenant_id = ${tenantId}::uuid
      AND id = ${membershipId}::uuid
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row) {
    throw new AuthzError(
      AUTHZ_ERROR_CODES.MEMBERSHIP_REQUIRED,
      'Membership not found for revoke',
    );
  }
  if (row.revoked_at !== null) {
    return mapMembership(row);
  }
  const updated = await tx.membership.update({
    where: { id: membershipId },
    data: { revokedAt },
  });
  return {
    membershipId: updated.id,
    tenantId: updated.tenantId,
    userId: updated.userId,
    role: updated.role,
    permissions: updated.permissions,
    activatedAt: updated.activatedAt,
    revokedAt: updated.revokedAt,
  };
}

export async function revokeEventAssignment(
  tx: Prisma.TransactionClient,
  tenantId: string,
  assignmentId: string,
  revokedAt: Date = new Date(),
): Promise<EventAssignmentRecord> {
  const rows = await tx.$queryRaw<LockedAssignmentRow[]>`
    SELECT id, tenant_id, event_id, membership_id, permissions, activated_at, revoked_at
    FROM event_assignments
    WHERE tenant_id = ${tenantId}::uuid
      AND id = ${assignmentId}::uuid
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row) {
    throw new AuthzError(
      AUTHZ_ERROR_CODES.EVENT_ASSIGNMENT_REQUIRED,
      'Event assignment not found for revoke',
    );
  }
  if (row.revoked_at !== null) {
    return mapAssignment(row);
  }
  const updated = await tx.eventAssignment.update({
    where: { id: assignmentId },
    data: { revokedAt },
  });
  return {
    assignmentId: updated.id,
    tenantId: updated.tenantId,
    eventId: updated.eventId,
    membershipId: updated.membershipId,
    permissions: updated.permissions,
    activatedAt: updated.activatedAt,
    revokedAt: updated.revokedAt,
  };
}
