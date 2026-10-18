/**
 * O16 / ADR-20 portal staff admin — H-M1…H-M4.
 * Lists mask email; mutations use role-map allowlist (no client permission arrays).
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PrismaClient, Prisma } from './generated/prisma/client';
import type {
  MembershipRole,
  PortalInviteState,
  PortalInvitesPage,
  PortalInviteSummary,
  PortalMembersPage,
  PortalMemberSummary,
  PortalMembershipMutationResponse,
  PortalInviteRevokeResponse,
} from '@ticket/contracts';
import { PlatformError, PLATFORM_ERROR_CODES } from './platform-error';
import {
  eventPermissionsForRole,
  isMembershipRole,
  ROLE_SCHEMA_VERSION,
  tenantPermissionsForRole,
} from './role-map';
import type { PlatformSecurityConfig } from './platform-config';
import {
  assertTenantAllowsAdminMutation,
  lockTenantPolicyForUpdate,
} from './tenant-policy';
import { withTenant } from './tenant-context';
import { requireTenantPermission } from './membership';
import { maskEmail } from './notification-status';

const INVITE_RESEND_COOLDOWN_SECONDS = 60;
const INVITE_RESEND_LIMIT_PER_HOUR = 10;

function hashToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

function parseLimit(raw: number | undefined): number {
  return Math.min(Math.max(raw ?? 50, 1), 100);
}

function inviteState(row: {
  accepted_at: Date | null;
  revoked_at: Date | null;
  expires_at: Date;
  now: Date;
}): PortalInviteState {
  if (row.accepted_at) return 'USED';
  if (row.revoked_at) return 'REVOKED';
  if (row.expires_at.getTime() <= row.now.getTime()) return 'EXPIRED';
  return 'PENDING';
}

function deliveryStateFromOutbox(
  status: string | null,
): PortalInviteSummary['deliveryState'] {
  return status === 'DEAD' ? 'FAILED' : 'PENDING';
}

async function writeMembershipAudit(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    actorUserId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    reason?: string;
    sanitizedDiff?: unknown;
    eventId?: string | null;
  },
): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO audit_logs (
      tenant_id, event_id, id, actor_user_id, action, resource_type, resource_id,
      reason, sanitized_diff, operation_id
    ) VALUES (
      ${input.tenantId}::uuid,
      ${input.eventId ?? null}::uuid,
      ${randomUUID()}::uuid,
      ${input.actorUserId}::uuid,
      ${input.action},
      ${input.resourceType},
      ${input.resourceId}::uuid,
      ${input.reason ?? null},
      ${input.sanitizedDiff ? JSON.stringify(input.sanitizedDiff) : null}::jsonb,
      NULL
    )
  `;
}

type MemberRow = {
  id: string;
  user_id: string;
  email: string | null;
  role: string;
  activated_at: Date | null;
  revoked_at: Date | null;
};

type AssignmentRow = {
  membership_id: string;
  event_id: string;
  permissions: string[];
  activated_at: Date | null;
  revoked_at: Date | null;
};

export async function listPortalMembers(
  db: PrismaClient,
  input: {
    tenantId: string;
    actorUserId: string;
    limit?: number;
    cursor?: string | null;
    includeRevoked?: boolean;
  },
): Promise<PortalMembersPage> {
  return withTenant(db, input.tenantId, async (tx) => {
    await requireTenantPermission(tx, {
      tenantId: input.tenantId,
      userId: input.actorUserId,
      permission: 'members.manage',
    });
    const limit = parseLimit(input.limit);
    const cursor = input.cursor?.trim() || null;
    const includeRevoked = Boolean(input.includeRevoked);

    const rows = cursor
      ? includeRevoked
        ? await tx.$queryRaw<MemberRow[]>`
            SELECT m.id, m.user_id, u.email, m.role, m.activated_at, m.revoked_at
            FROM memberships m
            JOIN users u ON u.id = m.user_id
            WHERE m.tenant_id = ${input.tenantId}::uuid
              AND m.id > ${cursor}::uuid
            ORDER BY m.id ASC
            LIMIT ${limit + 1}
          `
        : await tx.$queryRaw<MemberRow[]>`
            SELECT m.id, m.user_id, u.email, m.role, m.activated_at, m.revoked_at
            FROM memberships m
            JOIN users u ON u.id = m.user_id
            WHERE m.tenant_id = ${input.tenantId}::uuid
              AND m.revoked_at IS NULL
              AND m.activated_at IS NOT NULL
              AND m.id > ${cursor}::uuid
            ORDER BY m.id ASC
            LIMIT ${limit + 1}
          `
      : includeRevoked
        ? await tx.$queryRaw<MemberRow[]>`
            SELECT m.id, m.user_id, u.email, m.role, m.activated_at, m.revoked_at
            FROM memberships m
            JOIN users u ON u.id = m.user_id
            WHERE m.tenant_id = ${input.tenantId}::uuid
            ORDER BY m.id ASC
            LIMIT ${limit + 1}
          `
        : await tx.$queryRaw<MemberRow[]>`
            SELECT m.id, m.user_id, u.email, m.role, m.activated_at, m.revoked_at
            FROM memberships m
            JOIN users u ON u.id = m.user_id
            WHERE m.tenant_id = ${input.tenantId}::uuid
              AND m.revoked_at IS NULL
              AND m.activated_at IS NOT NULL
            ORDER BY m.id ASC
            LIMIT ${limit + 1}
          `;

    const page = rows.slice(0, limit);
    const membershipIds = page.map((r) => r.id);
    const assignments =
      membershipIds.length === 0
        ? []
        : await tx.$queryRaw<AssignmentRow[]>`
            SELECT membership_id, event_id, permissions, activated_at, revoked_at
            FROM event_assignments
            WHERE tenant_id = ${input.tenantId}::uuid
              AND membership_id::text = ANY(${membershipIds}::text[])
              AND revoked_at IS NULL
            ORDER BY membership_id ASC, event_id ASC
          `;

    const byMembership = new Map<string, AssignmentRow[]>();
    for (const a of assignments) {
      const list = byMembership.get(a.membership_id) ?? [];
      list.push(a);
      byMembership.set(a.membership_id, list);
    }

    const items: PortalMemberSummary[] = page.map((r) => ({
      membershipId: r.id,
      userId: r.user_id,
      emailMasked: maskEmail(r.email),
      role: r.role as MembershipRole,
      activatedAt: r.activated_at ? r.activated_at.toISOString() : null,
      revokedAt: r.revoked_at ? r.revoked_at.toISOString() : null,
      eventAssignments: (byMembership.get(r.id) ?? []).map((a) => ({
        eventId: a.event_id,
        permissions: a.permissions ?? [],
        activatedAt: a.activated_at ? a.activated_at.toISOString() : null,
        revokedAt: a.revoked_at ? a.revoked_at.toISOString() : null,
      })),
    }));

    const nextCursor =
      rows.length > limit ? page[page.length - 1]!.id : null;
    return { items, nextCursor };
  });
}

type InviteRow = {
  id: string;
  email: string;
  role: string;
  expires_at: Date;
  accepted_at: Date | null;
  revoked_at: Date | null;
  outbox_status: string | null;
};

export async function listPortalInvites(
  db: PrismaClient,
  input: {
    tenantId: string;
    actorUserId: string;
    limit?: number;
    cursor?: string | null;
    state?: PortalInviteState;
  },
): Promise<PortalInvitesPage> {
  return withTenant(db, input.tenantId, async (tx) => {
    await requireTenantPermission(tx, {
      tenantId: input.tenantId,
      userId: input.actorUserId,
      permission: 'members.manage',
    });
    const limit = parseLimit(input.limit);
    const cursor = input.cursor?.trim() || null;
    const stateFilter = input.state;
    if (
      stateFilter &&
      stateFilter !== 'PENDING' &&
      stateFilter !== 'USED' &&
      stateFilter !== 'REVOKED' &&
      stateFilter !== 'EXPIRED'
    ) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.INVALID_INPUT,
        'Invalid invite state filter',
      );
    }

    type InviteListRow = InviteRow & { derived_state: PortalInviteState };
    const rows = cursor
      ? stateFilter
        ? await tx.$queryRaw<InviteListRow[]>`
            SELECT * FROM (
              SELECT i.id, i.email, i.role, i.expires_at, i.accepted_at, i.revoked_at,
                     CASE
                       WHEN i.accepted_at IS NOT NULL THEN 'USED'
                       WHEN i.revoked_at IS NOT NULL THEN 'REVOKED'
                       WHEN i.expires_at <= clock_timestamp() THEN 'EXPIRED'
                       ELSE 'PENDING'
                     END AS derived_state,
                     (
                       SELECT o.status FROM outbox o
                       WHERE o.tenant_id = i.tenant_id
                         AND o.type = 'MembershipInvite'
                         AND o.aggregate_id = i.id
                       ORDER BY o.created_at DESC
                       LIMIT 1
                     ) AS outbox_status
              FROM membership_invites i
              WHERE i.tenant_id = ${input.tenantId}::uuid
                AND i.id > ${cursor}::uuid
            ) s
            WHERE s.derived_state = ${stateFilter}
            ORDER BY s.id ASC
            LIMIT ${limit + 1}
          `
        : await tx.$queryRaw<InviteListRow[]>`
            SELECT i.id, i.email, i.role, i.expires_at, i.accepted_at, i.revoked_at,
                   CASE
                     WHEN i.accepted_at IS NOT NULL THEN 'USED'
                     WHEN i.revoked_at IS NOT NULL THEN 'REVOKED'
                     WHEN i.expires_at <= clock_timestamp() THEN 'EXPIRED'
                     ELSE 'PENDING'
                   END AS derived_state,
                   (
                     SELECT o.status FROM outbox o
                     WHERE o.tenant_id = i.tenant_id
                       AND o.type = 'MembershipInvite'
                       AND o.aggregate_id = i.id
                     ORDER BY o.created_at DESC
                     LIMIT 1
                   ) AS outbox_status
            FROM membership_invites i
            WHERE i.tenant_id = ${input.tenantId}::uuid
              AND i.id > ${cursor}::uuid
            ORDER BY i.id ASC
            LIMIT ${limit + 1}
          `
      : stateFilter
        ? await tx.$queryRaw<InviteListRow[]>`
            SELECT * FROM (
              SELECT i.id, i.email, i.role, i.expires_at, i.accepted_at, i.revoked_at,
                     CASE
                       WHEN i.accepted_at IS NOT NULL THEN 'USED'
                       WHEN i.revoked_at IS NOT NULL THEN 'REVOKED'
                       WHEN i.expires_at <= clock_timestamp() THEN 'EXPIRED'
                       ELSE 'PENDING'
                     END AS derived_state,
                     (
                       SELECT o.status FROM outbox o
                       WHERE o.tenant_id = i.tenant_id
                         AND o.type = 'MembershipInvite'
                         AND o.aggregate_id = i.id
                       ORDER BY o.created_at DESC
                       LIMIT 1
                     ) AS outbox_status
              FROM membership_invites i
              WHERE i.tenant_id = ${input.tenantId}::uuid
            ) s
            WHERE s.derived_state = ${stateFilter}
            ORDER BY s.id ASC
            LIMIT ${limit + 1}
          `
        : await tx.$queryRaw<InviteListRow[]>`
            SELECT i.id, i.email, i.role, i.expires_at, i.accepted_at, i.revoked_at,
                   CASE
                     WHEN i.accepted_at IS NOT NULL THEN 'USED'
                     WHEN i.revoked_at IS NOT NULL THEN 'REVOKED'
                     WHEN i.expires_at <= clock_timestamp() THEN 'EXPIRED'
                     ELSE 'PENDING'
                   END AS derived_state,
                   (
                     SELECT o.status FROM outbox o
                     WHERE o.tenant_id = i.tenant_id
                       AND o.type = 'MembershipInvite'
                       AND o.aggregate_id = i.id
                     ORDER BY o.created_at DESC
                     LIMIT 1
                   ) AS outbox_status
            FROM membership_invites i
            WHERE i.tenant_id = ${input.tenantId}::uuid
            ORDER BY i.id ASC
            LIMIT ${limit + 1}
          `;

    const page = rows.slice(0, limit);
    const items: PortalInviteSummary[] = page.map((r) => ({
      inviteId: r.id,
      emailMasked: maskEmail(r.email) ?? '***',
      role: r.role as MembershipRole,
      state: r.derived_state,
      expiresAt: r.expires_at.toISOString(),
      deliveryState: deliveryStateFromOutbox(r.outbox_status),
    }));
    const nextCursor =
      rows.length > limit ? page[page.length - 1]!.id : null;
    return { items, nextCursor };
  });
}

export async function changePortalMemberRole(
  db: PrismaClient,
  input: {
    tenantId: string;
    actorUserId: string;
    membershipId: string;
    role: MembershipRole;
    reason: string;
  },
): Promise<PortalMembershipMutationResponse> {
  if (!isMembershipRole(input.role)) {
    throw new PlatformError(PLATFORM_ERROR_CODES.INVALID_INPUT, 'Invalid role');
  }
  const reason = input.reason.trim();
  if (reason.length < 1 || reason.length > 500) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.INVALID_INPUT,
      'reason must be 1..500 chars',
    );
  }

  return withTenant(db, input.tenantId, async (tx) => {
    await requireTenantPermission(tx, {
      tenantId: input.tenantId,
      userId: input.actorUserId,
      permission: 'members.manage',
    });
    const policy = await lockTenantPolicyForUpdate(tx, input.tenantId);
    assertTenantAllowsAdminMutation(policy.status);

    const members = await tx.$queryRaw<
      {
        id: string;
        user_id: string;
        role: string;
        revoked_at: Date | null;
        activated_at: Date | null;
      }[]
    >`
      SELECT id, user_id, role, revoked_at, activated_at FROM memberships
      WHERE tenant_id = ${input.tenantId}::uuid
      ORDER BY id
      FOR UPDATE
    `;

    const target = members.find((m) => m.id === input.membershipId);
    if (!target || target.revoked_at || !target.activated_at) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.RESOURCE_NOT_FOUND,
        'Membership not found',
      );
    }

    if (target.role === 'Owner' && input.role !== 'Owner') {
      const otherOwners = members.filter(
        (m) =>
          m.role === 'Owner' &&
          m.revoked_at === null &&
          m.activated_at !== null &&
          m.id !== target.id,
      );
      if (otherOwners.length === 0) {
        throw new PlatformError(
          PLATFORM_ERROR_CODES.LAST_OWNER_REQUIRED,
          'Cannot demote the last Owner',
        );
      }
    }

    const permissions = tenantPermissionsForRole(input.role);
    await tx.$executeRaw`
      UPDATE memberships
      SET role = ${input.role},
          permissions = ${permissions}::text[],
          updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${input.membershipId}::uuid
    `;

    await writeMembershipAudit(tx, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      action: 'membership.role_change',
      resourceType: 'membership',
      resourceId: input.membershipId,
      reason,
      sanitizedDiff: {
        fromRole: target.role,
        toRole: input.role,
        roleSchemaVersion: ROLE_SCHEMA_VERSION,
      },
    });

    return { membershipId: input.membershipId };
  });
}

export async function putPortalEventAssignment(
  db: PrismaClient,
  input: {
    tenantId: string;
    actorUserId: string;
    membershipId: string;
    eventId: string;
    role: MembershipRole;
    reason: string;
  },
): Promise<PortalMembershipMutationResponse> {
  if (!isMembershipRole(input.role)) {
    throw new PlatformError(PLATFORM_ERROR_CODES.INVALID_INPUT, 'Invalid role');
  }
  const reason = input.reason.trim();
  if (reason.length < 1 || reason.length > 500) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.INVALID_INPUT,
      'reason must be 1..500 chars',
    );
  }

  return withTenant(db, input.tenantId, async (tx) => {
    await requireTenantPermission(tx, {
      tenantId: input.tenantId,
      userId: input.actorUserId,
      permission: 'members.manage',
    });
    const policy = await lockTenantPolicyForUpdate(tx, input.tenantId);
    assertTenantAllowsAdminMutation(policy.status);

    const memberships = await tx.$queryRaw<
      { id: string; revoked_at: Date | null; activated_at: Date | null }[]
    >`
      SELECT id, revoked_at, activated_at FROM memberships
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${input.membershipId}::uuid
      FOR UPDATE
    `;
    const membership = memberships[0];
    if (!membership || membership.revoked_at || !membership.activated_at) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.RESOURCE_NOT_FOUND,
        'Membership not found',
      );
    }

    const events = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM events
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${input.eventId}::uuid
    `;
    if (!events[0]) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.RESOURCE_NOT_FOUND,
        'Event not found',
      );
    }

    const permissions = eventPermissionsForRole(input.role);
    const existing = await tx.$queryRaw<
      { id: string; revoked_at: Date | null }[]
    >`
      SELECT id, revoked_at FROM event_assignments
      WHERE tenant_id = ${input.tenantId}::uuid
        AND membership_id = ${input.membershipId}::uuid
        AND event_id = ${input.eventId}::uuid
      FOR UPDATE
    `;

    if (existing[0]) {
      await tx.$executeRaw`
        UPDATE event_assignments
        SET permissions = ${permissions}::text[],
            activated_at = COALESCE(activated_at, now()),
            revoked_at = NULL,
            updated_at = now()
        WHERE tenant_id = ${input.tenantId}::uuid
          AND id = ${existing[0].id}::uuid
      `;
    } else {
      await tx.$executeRaw`
        INSERT INTO event_assignments (
          id, tenant_id, event_id, membership_id, permissions, activated_at
        ) VALUES (
          ${randomUUID()}::uuid, ${input.tenantId}::uuid, ${input.eventId}::uuid,
          ${input.membershipId}::uuid, ${permissions}::text[], now()
        )
      `;
    }

    await writeMembershipAudit(tx, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      action: 'membership.assignment_put',
      resourceType: 'membership',
      resourceId: input.membershipId,
      reason,
      eventId: input.eventId,
      sanitizedDiff: {
        eventId: input.eventId,
        role: input.role,
        roleSchemaVersion: ROLE_SCHEMA_VERSION,
      },
    });

    return { membershipId: input.membershipId };
  });
}

export async function deletePortalEventAssignment(
  db: PrismaClient,
  input: {
    tenantId: string;
    actorUserId: string;
    membershipId: string;
    eventId: string;
    reason: string;
  },
): Promise<PortalMembershipMutationResponse> {
  const reason = input.reason.trim();
  if (reason.length < 1 || reason.length > 500) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.INVALID_INPUT,
      'reason must be 1..500 chars',
    );
  }

  return withTenant(db, input.tenantId, async (tx) => {
    await requireTenantPermission(tx, {
      tenantId: input.tenantId,
      userId: input.actorUserId,
      permission: 'members.manage',
    });
    const policy = await lockTenantPolicyForUpdate(tx, input.tenantId);
    assertTenantAllowsAdminMutation(policy.status);

    const existing = await tx.$queryRaw<
      { id: string; revoked_at: Date | null }[]
    >`
      SELECT id, revoked_at FROM event_assignments
      WHERE tenant_id = ${input.tenantId}::uuid
        AND membership_id = ${input.membershipId}::uuid
        AND event_id = ${input.eventId}::uuid
      FOR UPDATE
    `;
    if (!existing[0]) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.RESOURCE_NOT_FOUND,
        'Event assignment not found',
      );
    }
    if (!existing[0].revoked_at) {
      await tx.$executeRaw`
        UPDATE event_assignments
        SET revoked_at = now(), updated_at = now()
        WHERE tenant_id = ${input.tenantId}::uuid
          AND id = ${existing[0].id}::uuid
      `;
      await writeMembershipAudit(tx, {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: 'membership.assignment_revoke',
        resourceType: 'membership',
        resourceId: input.membershipId,
        reason,
        eventId: input.eventId,
        sanitizedDiff: { eventId: input.eventId },
      });
    }

    return { membershipId: input.membershipId };
  });
}

export async function revokePortalInvite(
  db: PrismaClient,
  input: {
    tenantId: string;
    actorUserId: string;
    inviteId: string;
    reason: string;
  },
): Promise<PortalInviteRevokeResponse> {
  const reason = input.reason.trim();
  if (reason.length < 1 || reason.length > 500) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.INVALID_INPUT,
      'reason must be 1..500 chars',
    );
  }

  return withTenant(db, input.tenantId, async (tx) => {
    await requireTenantPermission(tx, {
      tenantId: input.tenantId,
      userId: input.actorUserId,
      permission: 'members.manage',
    });
    const policy = await lockTenantPolicyForUpdate(tx, input.tenantId);
    assertTenantAllowsAdminMutation(policy.status);

    const rows = await tx.$queryRaw<
      {
        id: string;
        accepted_at: Date | null;
        revoked_at: Date | null;
        expires_at: Date;
      }[]
    >`
      SELECT id, accepted_at, revoked_at, expires_at
      FROM membership_invites
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${input.inviteId}::uuid
      FOR UPDATE
    `;
    const invite = rows[0];
    if (!invite) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.RESOURCE_NOT_FOUND,
        'Invite not found',
      );
    }
    if (invite.accepted_at) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.INVITE_ALREADY_USED,
        'Invite already used',
      );
    }
    if (!invite.revoked_at) {
      await tx.$executeRaw`
        UPDATE membership_invites
        SET revoked_at = now(), updated_at = now()
        WHERE tenant_id = ${input.tenantId}::uuid
          AND id = ${input.inviteId}::uuid
      `;
      await writeMembershipAudit(tx, {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: 'membership.invite_revoke',
        resourceType: 'membership_invite',
        resourceId: input.inviteId,
        reason,
      });
    }

    return { inviteId: input.inviteId, state: 'REVOKED' };
  });
}

export async function resendPortalInvite(
  db: PrismaClient,
  security: PlatformSecurityConfig,
  input: {
    tenantId: string;
    actorUserId: string;
    inviteId: string;
    reason: string;
  },
): Promise<{
  inviteId: string;
  state: 'PENDING';
  expiresAt: string;
  deliveryState: 'PENDING';
}> {
  const reason = input.reason.trim();
  if (reason.length < 1 || reason.length > 500) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.INVALID_INPUT,
      'reason must be 1..500 chars',
    );
  }

  return withTenant(db, input.tenantId, async (tx) => {
    await requireTenantPermission(tx, {
      tenantId: input.tenantId,
      userId: input.actorUserId,
      permission: 'members.manage',
    });
    const policy = await lockTenantPolicyForUpdate(tx, input.tenantId);
    assertTenantAllowsAdminMutation(policy.status);

    const rows = await tx.$queryRaw<
      {
        id: string;
        email: string;
        role: string;
        accepted_at: Date | null;
        revoked_at: Date | null;
        expires_at: Date;
      }[]
    >`
      SELECT id, email, role, accepted_at, revoked_at, expires_at
      FROM membership_invites
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${input.inviteId}::uuid
      FOR UPDATE
    `;
    const invite = rows[0];
    if (!invite) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.RESOURCE_NOT_FOUND,
        'Invite not found',
      );
    }
    const now = new Date();
    const state = inviteState({
      accepted_at: invite.accepted_at,
      revoked_at: invite.revoked_at,
      expires_at: invite.expires_at,
      now,
    });
    if (state !== 'PENDING') {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.INVITE_INVALID_OR_EXPIRED,
        'Only pending invites can be resent',
      );
    }

    const recent = await tx.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n
      FROM audit_logs
      WHERE tenant_id = ${input.tenantId}::uuid
        AND resource_id = ${input.inviteId}::uuid
        AND action = 'membership.invite_resend'
        AND created_at > now() - make_interval(secs => ${INVITE_RESEND_COOLDOWN_SECONDS})
    `;
    if ((recent[0]?.n ?? 0) > 0) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.RATE_LIMITED,
        'Invite resend cooldown active',
        true,
      );
    }

    const hourly = await tx.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n
      FROM audit_logs
      WHERE tenant_id = ${input.tenantId}::uuid
        AND actor_user_id = ${input.actorUserId}::uuid
        AND action = 'membership.invite_resend'
        AND created_at > now() - interval '1 hour'
    `;
    if ((hourly[0]?.n ?? 0) >= INVITE_RESEND_LIMIT_PER_HOUR) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.RATE_LIMITED,
        'Invite resend limit reached',
        true,
      );
    }

    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + security.inviteTtlSeconds * 1000);
    await tx.$executeRaw`
      UPDATE membership_invites
      SET token_hash = ${hashToken(rawToken)},
          expires_at = ${expiresAt}::timestamptz,
          updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${input.inviteId}::uuid
    `;

    await tx.$executeRaw`
      INSERT INTO outbox (
        tenant_id, event_id, id, type, aggregate_id, payload_version,
        payload, status, attempts, created_at, updated_at
      ) VALUES (
        ${input.tenantId}::uuid, NULL, ${randomUUID()}::uuid,
        'MembershipInvite', ${input.inviteId}::uuid, 1,
        ${JSON.stringify({
          inviteId: input.inviteId,
          email: invite.email,
          role: invite.role,
          token: rawToken,
          expiresAt: expiresAt.toISOString(),
        })}::jsonb,
        'PENDING', 0, now(), now()
      )
    `;

    await writeMembershipAudit(tx, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      action: 'membership.invite_resend',
      resourceType: 'membership_invite',
      resourceId: input.inviteId,
      reason,
      sanitizedDiff: { expiresAt: expiresAt.toISOString() },
    });

    return {
      inviteId: input.inviteId,
      state: 'PENDING' as const,
      expiresAt: expiresAt.toISOString(),
      deliveryState: 'PENDING' as const,
    };
  });
}
