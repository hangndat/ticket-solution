import { randomUUID } from 'node:crypto';
import type { PrismaClient } from './generated/prisma/client';
import { PlatformError, PLATFORM_ERROR_CODES } from './platform-error';
import { requireActivePlatformOperator } from './platform-operator';
import type { PlatformSecurityConfig } from './platform-config';
import { withPlatformRole } from './platform-context';

export async function createSupportGrant(
  db: PrismaClient,
  security: PlatformSecurityConfig,
  input: {
    actorUserId: string;
    tenantId: string;
    eventId: string;
    scopes: string[];
    reason: string;
    expiresAt: string;
  },
): Promise<{ grantId: string; expiresAt: string }> {
  if (!input.scopes.includes('cs.read') || input.scopes.length !== 1) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.INVALID_INPUT,
      'Only cs.read scope allowed',
    );
  }
  if (!input.reason?.trim() || input.reason.length > 500) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.INVALID_INPUT,
      'reason required',
    );
  }
  const expires = new Date(input.expiresAt);
  if (Number.isNaN(expires.getTime())) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.INVALID_INPUT,
      'Invalid expiresAt',
    );
  }
  const maxMs = security.supportTtlMaxSeconds * 1000;
  if (expires.getTime() - Date.now() > maxMs || expires.getTime() <= Date.now()) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.INVALID_INPUT,
      'Support grant expiry exceeds max TTL',
    );
  }

  return withPlatformRole(db, async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.actor_id', ${input.actorUserId}, true)`;
    await requireActivePlatformOperator(tx, input.actorUserId);
    const grantId = randomUUID();
    await tx.$executeRaw`
      INSERT INTO support_grants (
        tenant_id, id, operator_user_id, event_id, scopes, reason,
        expires_at, created_by
      ) VALUES (
        ${input.tenantId}::uuid, ${grantId}::uuid, ${input.actorUserId}::uuid,
        ${input.eventId}::uuid, ${['cs.read']}::text[], ${input.reason.trim()},
        ${expires}::timestamptz, ${input.actorUserId}::uuid
      )
    `;
    await tx.$executeRaw`
      INSERT INTO platform_audit_logs (
        id, actor_user_id, action, resource_type, resource_id, tenant_id, sanitized_diff
      ) VALUES (
        ${randomUUID()}::uuid, ${input.actorUserId}::uuid,
        'platform.support.granted', 'support_grant', ${grantId}::uuid,
        ${input.tenantId}::uuid,
        ${JSON.stringify({ eventId: input.eventId, scopes: ['cs.read'] })}::jsonb
      )
    `;
    return { grantId, expiresAt: expires.toISOString() };
  });
}

export async function revokeSupportGrant(
  db: PrismaClient,
  input: { actorUserId: string; tenantId: string; grantId: string; reason: string },
): Promise<{ revokedAt: string }> {
  return withPlatformRole(db, async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.actor_id', ${input.actorUserId}, true)`;
    await requireActivePlatformOperator(tx, input.actorUserId);
    const revokedAt = new Date();
    const n = await tx.$executeRaw`
      UPDATE support_grants
      SET revoked_at = ${revokedAt}::timestamptz, updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${input.grantId}::uuid
        AND revoked_at IS NULL
    `;
    if (!n) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.RESOURCE_NOT_FOUND,
        'Grant not found',
      );
    }
    void input.reason;
    return { revokedAt: revokedAt.toISOString() };
  });
}

/** Read-only masked CS projection under live support grant; audit every read. */
export async function listSupportTickets(
  db: PrismaClient,
  input: {
    actorUserId: string;
    grantId: string;
    tenantId?: string;
  },
): Promise<
  Array<{
    ticketId: string;
    state: string;
    ownerEmailMasked: string | null;
  }>
> {
  return withPlatformRole(db, async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.actor_id', ${input.actorUserId}, true)`;
    await requireActivePlatformOperator(tx, input.actorUserId);

    // Resolve grant metadata for audit (platform may read support_grants).
    const grants = await tx.$queryRaw<
      {
        tenant_id: string;
        expires_at: Date;
        revoked_at: Date | null;
        operator_user_id: string;
        scopes: string[];
      }[]
    >`
      SELECT tenant_id, expires_at, revoked_at, operator_user_id, scopes
      FROM support_grants
      WHERE id = ${input.grantId}::uuid
      FOR UPDATE
    `;
    const g = grants[0];
    if (
      !g ||
      g.revoked_at ||
      g.operator_user_id !== input.actorUserId ||
      g.expires_at.getTime() <= Date.now() ||
      !g.scopes.includes('cs.read')
    ) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.PERMISSION_DENIED,
        'Support grant not live',
      );
    }
    if (g.expires_at.getTime() <= Date.now()) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.PERMISSION_DENIED,
        'Support grant expired',
      );
    }

    let rows: {
      ticket_id: string;
      state: string;
      owner_email_masked: string | null;
    }[];
    try {
      rows = await tx.$queryRaw`
        SELECT ticket_id, state, owner_email_masked
        FROM list_support_tickets_masked(
          ${input.grantId}::uuid,
          ${input.actorUserId}::uuid
        )
      `;
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      if (/support_grant_not_live/i.test(msg)) {
        throw new PlatformError(
          PLATFORM_ERROR_CODES.PERMISSION_DENIED,
          'Support grant not live',
        );
      }
      throw error;
    }

    await tx.$executeRaw`
      INSERT INTO platform_audit_logs (
        id, actor_user_id, action, resource_type, resource_id, tenant_id, sanitized_diff
      ) VALUES (
        ${randomUUID()}::uuid, ${input.actorUserId}::uuid,
        'platform.support.read', 'support_grant', ${input.grantId}::uuid,
        ${g.tenant_id}::uuid,
        ${JSON.stringify({ count: rows.length })}::jsonb
      )
    `;

    return rows.map((r) => ({
      ticketId: r.ticket_id,
      state: r.state,
      ownerEmailMasked: r.owner_email_masked,
    }));
  });
}
