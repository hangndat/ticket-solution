import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PrismaClient } from './generated/prisma/client';
import type { MembershipRole } from '@ticket/contracts';
import { PlatformError, PLATFORM_ERROR_CODES } from './platform-error';
import {
  inviteRoleStorageKey,
  isMembershipRole,
  parseInviteRole,
  ROLE_SCHEMA_VERSION,
  type InviteRoleRef,
} from './role-map';
import type { PlatformSecurityConfig } from './platform-config';
import {
  assertTenantAllowsAdminMutation,
  lockTenantPolicyForUpdate,
} from './tenant-policy';
import { withTenant } from './tenant-context';
import {
  assertLockedMembershipPermission,
  requireTenantPermission,
} from './membership';
import { loadPresetInTenant } from './role-presets';

function canonicalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

export async function listMyTenants(
  db: PrismaClient,
  userId: string,
): Promise<
  {
    tenantId: string;
    slug: string;
    name: string;
    status: string;
    role: string;
    tenantPermissions: string[];
  }[]
> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.actor_id', ${userId}, true)`;
    const rows = await tx.$queryRaw<
      {
        tenant_id: string;
        slug: string;
        name: string;
        status: string;
        role: string;
        permissions: string[];
      }[]
    >`SELECT * FROM list_my_tenants()`;
    return rows.map((r) => ({
      tenantId: r.tenant_id,
      slug: r.slug,
      name: r.name,
      status: r.status,
      role: r.role,
      tenantPermissions: r.permissions ?? [],
    }));
  });
}

/** O02 staff discovery: active event assignments + server-computed staffEligible. */
export async function listMyEvents(
  db: PrismaClient,
  userId: string,
): Promise<{
  staffEligible: boolean;
  items: {
    tenantId: string;
    eventId: string;
    name: string;
    permissions: string[];
  }[];
}> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.actor_id', ${userId}, true)`;
    const rows = await tx.$queryRaw<
      {
        tenant_id: string;
        event_id: string;
        name: string;
        permissions: string[];
      }[]
    >`SELECT * FROM list_my_events()`;
    const eligibleRows = await tx.$queryRaw<{ my_staff_eligible: boolean }[]>`
      SELECT my_staff_eligible()
    `;
    return {
      staffEligible: Boolean(eligibleRows[0]?.my_staff_eligible),
      items: rows.map((r) => ({
        tenantId: r.tenant_id,
        eventId: r.event_id,
        name: r.name,
        permissions: r.permissions ?? [],
      })),
    };
  });
}

export async function createMembershipInvite(
  db: PrismaClient,
  security: PlatformSecurityConfig,
  input: {
    tenantId: string;
    actorUserId: string;
    email: string;
    role: InviteRoleRef;
    eventAssignments?: Array<{ eventId: string; role: MembershipRole }>;
    clientKey: string;
    /** Reject forged client permission arrays (ADR §7). */
    forgedPermissions?: unknown;
  },
): Promise<{
  inviteId: string;
  state: 'PENDING';
  expiresAt: string;
  deliveryState: 'PENDING';
  rawToken: string;
}> {
  if (
    input.forgedPermissions !== undefined &&
    input.forgedPermissions !== null
  ) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.INVALID_INPUT,
      'Client permission arrays are not allowed',
    );
  }
  const parsedRole = parseInviteRole(input.role);
  if (!parsedRole) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.INVALID_INPUT,
      'Invalid role',
    );
  }
  for (const a of input.eventAssignments ?? []) {
    if (!isMembershipRole(a.role)) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.INVALID_INPUT,
        'Invalid event assignment role',
      );
    }
  }
  const email = canonicalizeEmail(input.email);
  const roleKey = inviteRoleStorageKey(parsedRole);
  return withTenant(db, input.tenantId, async (tx) => {
    await requireTenantPermission(tx, {
      tenantId: input.tenantId,
      userId: input.actorUserId,
      permission: 'members.manage',
    });
    const policy = await lockTenantPolicyForUpdate(tx, input.tenantId);
    assertTenantAllowsAdminMutation(policy.status);

    if (typeof parsedRole !== 'string') {
      // Unknown / cross-tenant preset → 404 (RLS + explicit load).
      await loadPresetInTenant(tx, parsedRole.presetId);
    }

    const limits = await tx.$queryRaw<{ max_staff: number | null }[]>`
      SELECT max_staff FROM tenant_limits
      WHERE tenant_id = ${input.tenantId}::uuid
      FOR UPDATE
    `;
    const maxStaff = limits[0]?.max_staff ?? null;
    if (maxStaff !== null) {
      const usage = await tx.$queryRaw<{ n: number }[]>`
        SELECT (
          (SELECT COUNT(*) FROM memberships
            WHERE tenant_id = ${input.tenantId}::uuid AND revoked_at IS NULL
              AND activated_at IS NOT NULL)
          +
          (SELECT COUNT(*) FROM membership_invites
            WHERE tenant_id = ${input.tenantId}::uuid
              AND revoked_at IS NULL AND accepted_at IS NULL
              AND expires_at > clock_timestamp())
        )::int AS n
      `;
      if ((usage[0]?.n ?? 0) >= maxStaff) {
        throw new PlatformError(
          PLATFORM_ERROR_CODES.TENANT_LIMIT_REACHED,
          'Staff limit reached',
        );
      }
    }

    const inviteId = randomUUID();
    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + security.inviteTtlSeconds * 1000);
    const intentions = (input.eventAssignments ?? []).map((a) => ({
      eventId: a.eventId,
      role: a.role,
    }));

    await tx.$executeRaw`
      INSERT INTO membership_invites (
        tenant_id, id, email, role, token_hash, expires_at, created_by,
        role_schema_version, assignment_intentions
      ) VALUES (
        ${input.tenantId}::uuid, ${inviteId}::uuid, ${email}, ${roleKey},
        ${hashToken(rawToken)}, ${expiresAt}::timestamptz, ${input.actorUserId}::uuid,
        ${ROLE_SCHEMA_VERSION}, ${JSON.stringify(intentions)}::jsonb
      )
    `;

    await tx.$executeRaw`
      INSERT INTO outbox (
        tenant_id, event_id, id, type, aggregate_id, payload_version,
        payload, status, attempts, created_at, updated_at
      ) VALUES (
        ${input.tenantId}::uuid, NULL, ${randomUUID()}::uuid,
        'MembershipInvite', ${inviteId}::uuid, 1,
        ${JSON.stringify({
          inviteId,
          email,
          role: roleKey,
          token: rawToken,
          expiresAt: expiresAt.toISOString(),
        })}::jsonb,
        'PENDING', 0, now(), now()
      )
    `;

    void input.clientKey;
    return {
      inviteId,
      state: 'PENDING' as const,
      expiresAt: expiresAt.toISOString(),
      deliveryState: 'PENDING' as const,
      rawToken,
    };
  });
}

/**
 * Accept invite: self command before membership exists.
 * Materializes role-map permissions; Owner first accept → tenant ACTIVE.
 */
export async function acceptMembershipInvite(
  db: PrismaClient,
  input: {
    userId: string;
    email: string | null;
    emailVerified: boolean;
    token: string;
  },
): Promise<{ tenantId: string; membershipId: string; status: string }> {
  if (!input.emailVerified || !input.email) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.INVALID_INPUT,
      'Verified email required',
    );
  }
  const email = canonicalizeEmail(input.email);
  const tokenHash = hashToken(input.token.trim());
  try {
    const rows = await db.$queryRaw<
      { out_tenant_id: string; out_membership_id: string; out_status: string }[]
    >`
      SELECT * FROM accept_membership_invite(
        ${tokenHash}::text,
        ${input.userId}::uuid,
        ${email}::text
      )
    `;
    if (!rows[0]) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.INVITE_INVALID_OR_EXPIRED,
        'Invite invalid or expired',
      );
    }
    return {
      tenantId: rows[0].out_tenant_id,
      membershipId: rows[0].out_membership_id,
      status: rows[0].out_status,
    };
  } catch (error) {
    if (error instanceof PlatformError) throw error;
    const msg = error instanceof Error ? error.message : '';
    if (/invite_invalid_or_expired/i.test(msg)) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.INVITE_INVALID_OR_EXPIRED,
        'Invite invalid or expired',
      );
    }
    if (/invite_already_used/i.test(msg)) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.INVITE_ALREADY_USED,
        'Invite already used',
      );
    }
    throw error;
  }
}

export async function revokeMembershipKeepingLastOwner(
  db: PrismaClient,
  input: {
    tenantId: string;
    actorUserId: string;
    membershipId: string;
    reason: string;
  },
): Promise<{ revokedAt: string }> {
  return withTenant(db, input.tenantId, async (tx) => {
    // Lock order matches changePortalMemberRole: tenant_policies → memberships (id ASC)
    // → authz on locked rows (no FOR SHARE upgrade deadlock).
    await lockTenantPolicyForUpdate(tx, input.tenantId);

    const members = await tx.$queryRaw<
      {
        id: string;
        user_id: string;
        role: string;
        permissions: string[];
        revoked_at: Date | null;
        activated_at: Date | null;
      }[]
    >`
      SELECT id, user_id, role, permissions, revoked_at, activated_at FROM memberships
      WHERE tenant_id = ${input.tenantId}::uuid
      ORDER BY id
      FOR UPDATE
    `;
    assertLockedMembershipPermission(
      members,
      input.actorUserId,
      'members.manage',
    );

    const target = members.find((m) => m.id === input.membershipId);
    if (!target || target.revoked_at) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.RESOURCE_NOT_FOUND,
        'Membership not found',
      );
    }

    if (target.role === 'Owner') {
      const activeOwners = members.filter(
        (m) => m.role === 'Owner' && m.revoked_at === null && m.id !== target.id,
      );
      if (activeOwners.length === 0) {
        throw new PlatformError(
          PLATFORM_ERROR_CODES.LAST_OWNER_REQUIRED,
          'Cannot revoke the last Owner',
        );
      }
    }

    const revokedAt = new Date();
    await tx.$executeRaw`
      UPDATE memberships
      SET revoked_at = ${revokedAt}::timestamptz, updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.membershipId}::uuid
    `;
    await tx.$executeRaw`
      UPDATE event_assignments
      SET revoked_at = ${revokedAt}::timestamptz, updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND membership_id = ${input.membershipId}::uuid
        AND revoked_at IS NULL
    `;
    void input.reason;
    return { revokedAt: revokedAt.toISOString() };
  });
}
