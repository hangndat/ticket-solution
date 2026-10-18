/**
 * H-I2 guest invitations — list (masked), dispatch-preview, dispatch, claim.
 * Dispatch never reserves quota; claim allocates via redemption.issue path.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  CURSOR_PAGE_LIMIT,
  INVITATION_TTL_HOURS_DEFAULT,
  type InvitationClaimBody,
  type InvitationDispatchBody,
  type InvitationDispatchPreviewBody,
  type InvitationDispatchPreviewResponse,
  type InvitationDispatchResponse,
  type InvitationListPage,
  type InvitationState,
  type InvitationSummary,
} from '@ticket/contracts';
import type { Prisma, PrismaClient } from './generated/prisma/client';
import {
  IMPORT_ERROR_CODES,
  ImportError,
} from './import-error';
import type { CodeHmacConfig } from './code-hmac';
import { hashRedemptionCode } from './code-hmac';
import {
  redeemAndIssueTicket,
  type RedeemOutcome,
} from './issue';
import { requireTenantPermission } from './membership';
import { maskEmail } from './notification-status';
import { withTenant } from './tenant-context';

const PERMISSION_IMPORT = 'inventory.import';
const DISPATCH_COMMAND = 'invitation.dispatch';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hashToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

function canonicalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function requireIdempotencyKey(raw: string | undefined): string {
  const key = raw?.trim() ?? '';
  if (!UUID_RE.test(key)) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
      'Idempotency-Key must be a UUID',
      400,
    );
  }
  return key;
}

function parseLimit(raw: number | undefined): number {
  if (raw === undefined || Number.isNaN(raw)) return CURSOR_PAGE_LIMIT.default;
  return Math.min(
    CURSOR_PAGE_LIMIT.max,
    Math.max(CURSOR_PAGE_LIMIT.min, Math.floor(raw)),
  );
}

async function readEventRemainingQuota(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
): Promise<number> {
  const rows = await tx.$queryRaw<
    Array<{ capacity: number | null; allocated: number }>
  >`
    SELECT capacity, allocated
    FROM quota_buckets
    WHERE tenant_id = ${tenantId}::uuid
      AND event_id = ${eventId}::uuid
      AND scope = 'EVENT'
  `;
  const row = rows[0];
  if (!row || row.capacity === null) return 0;
  return Math.max(0, row.capacity - row.allocated);
}

function toSummary(row: {
  id: string;
  event_id: string;
  source_id: string;
  ticket_type_id: string;
  invited_email: string;
  state: InvitationState;
  expires_at: Date;
}): InvitationSummary {
  const masked = maskEmail(row.invited_email);
  if (!masked) {
    throw new ImportError(
      IMPORT_ERROR_CODES.INVITATION_NOT_FOUND,
      'Invitation projection failed privacy check',
    );
  }
  return {
    invitationId: row.id,
    eventId: row.event_id,
    sourceId: row.source_id,
    ticketTypeId: row.ticket_type_id,
    invitedEmailMasked: masked,
    state: row.state,
    expiresAt: row.expires_at.toISOString(),
  };
}

export async function listGuestInvitations(
  db: PrismaClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    cursor?: string | null;
    limit?: number;
    state?: InvitationState;
  },
): Promise<InvitationListPage> {
  const limit = parseLimit(input.limit);
  return withTenant(db, input.tenantId, async (tx) => {
    await requireTenantPermission(tx, {
      tenantId: input.tenantId,
      userId: input.actorUserId,
      permission: PERMISSION_IMPORT,
      eventId: input.eventId,
    });

    // Expire due rows opportunistically (no quota side effects).
    await tx.$executeRaw`
      UPDATE guest_invitations
      SET state = 'EXPIRED', updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND event_id = ${input.eventId}::uuid
        AND state IN ('PENDING', 'DISPATCHED')
        AND expires_at < clock_timestamp()
    `;

    const cursor = input.cursor?.trim() || null;
    const stateFilter = input.state ?? null;
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        event_id: string;
        source_id: string;
        ticket_type_id: string;
        invited_email: string;
        state: InvitationState;
        expires_at: Date;
        created_at: Date;
      }>
    >`
      SELECT id, event_id, source_id, ticket_type_id, invited_email, state,
             expires_at, created_at
      FROM guest_invitations
      WHERE tenant_id = ${input.tenantId}::uuid
        AND event_id = ${input.eventId}::uuid
        AND (${stateFilter}::text IS NULL OR state = ${stateFilter})
        AND (
          ${cursor}::text IS NULL
          OR (created_at, id) < (
            SELECT created_at, id FROM guest_invitations
            WHERE tenant_id = ${input.tenantId}::uuid
              AND id = ${cursor}::uuid
          )
        )
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit + 1}
    `;

    const page = rows.slice(0, limit);
    const items = page.map(toSummary);
    // Fail closed: ensure no raw email/token leaked into DTO keys.
    for (const item of items) {
      const rec = item as unknown as Record<string, unknown>;
      if ('invitedEmail' in rec || 'token' in rec || 'rawToken' in rec) {
        throw new ImportError(
          IMPORT_ERROR_CODES.INVITATION_NOT_FOUND,
          'Invitation list failed privacy check',
        );
      }
    }
    const nextCursor =
      rows.length > limit ? page[page.length - 1]!.id : null;
    return { items, nextCursor };
  });
}

export async function previewInvitationDispatch(
  db: PrismaClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    body: InvitationDispatchPreviewBody;
  },
): Promise<InvitationDispatchPreviewResponse> {
  const ids = [...new Set((input.body.invitationIds ?? []).map((id) => id.trim()))];
  if (ids.length === 0 || ids.length > 500) {
    throw new ImportError(
      IMPORT_ERROR_CODES.INVITATION_NOT_FOUND,
      'invitationIds must contain 1..500 ids',
    );
  }
  for (const id of ids) {
    if (!UUID_RE.test(id)) {
      throw new ImportError(
        IMPORT_ERROR_CODES.INVITATION_NOT_FOUND,
        'invitationIds must be UUIDs',
      );
    }
  }

  return withTenant(db, input.tenantId, async (tx) => {
    await requireTenantPermission(tx, {
      tenantId: input.tenantId,
      userId: input.actorUserId,
      permission: PERMISSION_IMPORT,
      eventId: input.eventId,
    });

    const rows = await tx.$queryRaw<Array<{ id: string; state: string }>>`
      SELECT id, state FROM guest_invitations
      WHERE tenant_id = ${input.tenantId}::uuid
        AND event_id = ${input.eventId}::uuid
        AND id = ANY(${ids}::uuid[])
    `;
    if (rows.length !== ids.length) {
      throw new ImportError(
        IMPORT_ERROR_CODES.INVITATION_NOT_FOUND,
        'One or more invitations were not found',
        404,
      );
    }
    for (const row of rows) {
      if (row.state !== 'PENDING') {
        throw new ImportError(
          IMPORT_ERROR_CODES.INVITATION_REVOKED,
          'Only PENDING invitations can be dispatched',
          410,
        );
      }
    }

    const remaining = await readEventRemainingQuota(
      tx,
      input.tenantId,
      input.eventId,
    );
    const estimatedQuota = Math.min(ids.length, remaining);

    const revRows = await tx.$queryRaw<Array<{ n: number }>>`
      SELECT COALESCE(MAX(preview_revision), 0)::int AS n
      FROM invitation_dispatch_previews
      WHERE tenant_id = ${input.tenantId}::uuid
        AND event_id = ${input.eventId}::uuid
        AND actor_user_id = ${input.actorUserId}::uuid
    `;
    const previewRevision = (revRows[0]?.n ?? 0) + 1;
    await tx.$executeRaw`
      INSERT INTO invitation_dispatch_previews (
        tenant_id, event_id, actor_user_id, preview_revision,
        invitation_ids, estimated_quota
      ) VALUES (
        ${input.tenantId}::uuid, ${input.eventId}::uuid,
        ${input.actorUserId}::uuid, ${previewRevision},
        ${ids}::uuid[], ${estimatedQuota}
      )
    `;
    // No outbox / mail on preview — only estimate.
    return {
      previewRevision,
      selectedCount: ids.length,
      estimatedQuota,
    };
  });
}

export async function dispatchGuestInvitations(
  db: PrismaClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    body: InvitationDispatchBody;
    idempotencyKey: string;
  },
): Promise<InvitationDispatchResponse> {
  const key = requireIdempotencyKey(input.idempotencyKey);
  const ids = [...new Set((input.body.invitationIds ?? []).map((id) => id.trim()))];
  if (ids.length === 0) {
    throw new ImportError(
      IMPORT_ERROR_CODES.INVITATION_NOT_FOUND,
      'invitationIds required',
    );
  }

  return withTenant(db, input.tenantId, async (tx) => {
    await requireTenantPermission(tx, {
      tenantId: input.tenantId,
      userId: input.actorUserId,
      permission: PERMISSION_IMPORT,
      eventId: input.eventId,
    });

    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          invitationIds: [...ids].sort(),
          previewRevision: input.body.previewRevision,
        }),
      )
      .digest('hex');
    const operationId = randomUUID();
    await tx.$executeRaw`
      INSERT INTO operations (
        tenant_id, event_id, id, actor_user_id, command, client_key,
        request_hash, status, created_at, updated_at
      ) VALUES (
        ${input.tenantId}::uuid, ${input.eventId}::uuid, ${operationId}::uuid,
        ${input.actorUserId}::uuid, ${DISPATCH_COMMAND}, ${key},
        ${requestHash}, 'IN_PROGRESS', now(), now()
      )
      ON CONFLICT (tenant_id, event_id, actor_user_id, command, client_key)
      DO NOTHING
    `;
    const ops = await tx.$queryRaw<
      Array<{
        id: string;
        request_hash: string;
        status: string;
        response_json: InvitationDispatchResponse | null;
      }>
    >`
      SELECT id, request_hash, status, response_json
      FROM operations
      WHERE tenant_id = ${input.tenantId}::uuid
        AND event_id = ${input.eventId}::uuid
        AND actor_user_id = ${input.actorUserId}::uuid
        AND command = ${DISPATCH_COMMAND}
        AND client_key = ${key}
      FOR UPDATE
    `;
    const op = ops[0];
    if (!op) {
      throw new ImportError(
        IMPORT_ERROR_CODES.IDEMPOTENCY_CONFLICT,
        'Failed to claim idempotency operation',
        409,
      );
    }
    if (op.request_hash !== requestHash) {
      throw new ImportError(
        IMPORT_ERROR_CODES.IDEMPOTENCY_CONFLICT,
        'Idempotency-Key was reused with a different request',
        409,
      );
    }
    if (op.status === 'COMPLETED' && op.response_json) {
      return { ...op.response_json, replayed: true };
    }

    const previews = await tx.$queryRaw<
      Array<{ invitation_ids: string[]; estimated_quota: number }>
    >`
      SELECT invitation_ids, estimated_quota
      FROM invitation_dispatch_previews
      WHERE tenant_id = ${input.tenantId}::uuid
        AND event_id = ${input.eventId}::uuid
        AND actor_user_id = ${input.actorUserId}::uuid
        AND preview_revision = ${input.body.previewRevision}
    `;
    const preview = previews[0];
    if (!preview) {
      throw new ImportError(
        IMPORT_ERROR_CODES.IMPORT_STALE_PREVIEW,
        'dispatch previewRevision is stale',
      );
    }
    const previewSet = new Set(preview.invitation_ids);
    if (
      ids.length !== preview.invitation_ids.length ||
      ids.some((id) => !previewSet.has(id))
    ) {
      throw new ImportError(
        IMPORT_ERROR_CODES.IMPORT_STALE_PREVIEW,
        'invitationIds do not match preview',
      );
    }

    const locked = await tx.$queryRaw<
      Array<{
        id: string;
        state: string;
        invited_email: string;
        token_hash: string;
      }>
    >`
      SELECT id, state, invited_email, token_hash
      FROM guest_invitations
      WHERE tenant_id = ${input.tenantId}::uuid
        AND event_id = ${input.eventId}::uuid
        AND id = ANY(${ids}::uuid[])
      FOR UPDATE
    `;
    if (locked.length !== ids.length) {
      throw new ImportError(
        IMPORT_ERROR_CODES.INVITATION_NOT_FOUND,
        'One or more invitations were not found',
        404,
      );
    }

    let dispatchedCount = 0;
    for (const row of locked) {
      if (row.state === 'DISPATCHED') {
        dispatchedCount += 1;
        continue;
      }
      if (row.state !== 'PENDING') {
        throw new ImportError(
          IMPORT_ERROR_CODES.INVITATION_REVOKED,
          'Invitation is not dispatchable',
          410,
        );
      }
      // Mint a fresh dispatch token (previous mint from commit is for claim).
      // Keep claim token as the one stored at commit; dispatch only notifies.
      // Recover raw token from InvitationTokenMinted outbox if still PENDING.
      const minted = await tx.$queryRaw<
        Array<{ payload: { token?: string; email?: string } }>
      >`
        SELECT payload FROM outbox
        WHERE tenant_id = ${input.tenantId}::uuid
          AND type = 'InvitationTokenMinted'
          AND aggregate_id = ${row.id}::uuid
        ORDER BY created_at DESC
        LIMIT 1
      `;
      const rawToken = minted[0]?.payload?.token;
      if (!rawToken) {
        throw new ImportError(
          IMPORT_ERROR_CODES.INVITATION_TOKEN_INVALID,
          'Invitation token missing for dispatch',
        );
      }
      await tx.$executeRaw`
        UPDATE guest_invitations
        SET state = 'DISPATCHED', updated_at = now()
        WHERE tenant_id = ${input.tenantId}::uuid AND id = ${row.id}::uuid
      `;
      await tx.$executeRaw`
        INSERT INTO outbox (
          tenant_id, event_id, id, type, aggregate_id, payload_version,
          payload, status, attempts, created_at, updated_at
        ) VALUES (
          ${input.tenantId}::uuid, ${input.eventId}::uuid, ${randomUUID()}::uuid,
          'InvitationReady', ${row.id}::uuid, 1,
          ${JSON.stringify({
            invitationId: row.id,
            email: row.invited_email,
            token: rawToken,
            ttlHours: INVITATION_TTL_HOURS_DEFAULT,
          })}::jsonb,
          'PENDING', 0, now(), now()
        )
      `;
      dispatchedCount += 1;
    }

    // Dispatch must not change quota_buckets.allocated.
    const response: InvitationDispatchResponse = {
      dispatchedCount,
      previewRevision: input.body.previewRevision,
      replayed: false,
    };
    await tx.$executeRaw`
      UPDATE operations
      SET status = 'COMPLETED',
          response_json = ${JSON.stringify(response)}::jsonb,
          updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid AND id = ${op.id}::uuid
    `;
    return response;
  });
}

export async function claimGuestInvitation(
  db: PrismaClient,
  hmac: CodeHmacConfig,
  credentialKey: string,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    actorEmail: string | null;
    emailVerified: boolean;
    body: InvitationClaimBody;
    idempotencyKey: string;
  },
): Promise<RedeemOutcome> {
  if (!input.emailVerified || !input.actorEmail) {
    throw new ImportError(
      IMPORT_ERROR_CODES.EMAIL_NOT_VERIFIED,
      'Verified email required to claim invitation',
      403,
    );
  }
  const token = input.body.token?.trim() ?? '';
  if (token.length < 16) {
    throw new ImportError(
      IMPORT_ERROR_CODES.INVITATION_TOKEN_INVALID,
      'Invitation token is invalid',
      410,
    );
  }
  const key = requireIdempotencyKey(input.idempotencyKey);
  const email = canonicalizeEmail(input.actorEmail);
  const tokenHash = hashToken(token);

  return withTenant(db, input.tenantId, async (tx) => {
    const invitations = await tx.$queryRaw<
      Array<{
        id: string;
        event_id: string;
        source_id: string;
        ticket_type_id: string;
        invited_email: string;
        state: string;
        expires_at: Date;
        redemption_code_id: string | null;
      }>
    >`
      SELECT id, event_id, source_id, ticket_type_id, invited_email, state,
             expires_at, redemption_code_id
      FROM guest_invitations
      WHERE token_hash = ${tokenHash}
      FOR UPDATE
    `;
    const inv = invitations[0];
    if (!inv || inv.event_id !== input.eventId) {
      throw new ImportError(
        IMPORT_ERROR_CODES.INVITATION_TOKEN_INVALID,
        'Invitation token is invalid',
        410,
      );
    }
    if (canonicalizeEmail(inv.invited_email) !== email) {
      throw new ImportError(
        IMPORT_ERROR_CODES.INVITATION_EMAIL_MISMATCH,
        'Invitation email does not match verified identity',
        403,
      );
    }
    if (inv.state === 'REVOKED') {
      throw new ImportError(
        IMPORT_ERROR_CODES.INVITATION_REVOKED,
        'Invitation was revoked',
        410,
      );
    }
    if (inv.state === 'EXPIRED' || inv.expires_at.getTime() < Date.now()) {
      await tx.$executeRaw`
        UPDATE guest_invitations
        SET state = 'EXPIRED', updated_at = now()
        WHERE tenant_id = ${input.tenantId}::uuid AND id = ${inv.id}::uuid
          AND state <> 'CLAIMED'
      `;
      throw new ImportError(
        IMPORT_ERROR_CODES.INVITATION_EXPIRED,
        'Invitation expired',
        410,
      );
    }
    if (inv.state !== 'DISPATCHED' && inv.state !== 'CLAIMED') {
      throw new ImportError(
        IMPORT_ERROR_CODES.INVITATION_TOKEN_INVALID,
        'Invitation is not claimable yet',
        410,
      );
    }

    // Ensure a single-use redemption code exists for issue path reuse.
    let rawCode: string;
    if (inv.redemption_code_id) {
      // Replay path: recover code from sealed outbox mint for this invitation.
      const minted = await tx.$queryRaw<
        Array<{ payload: { claimCode?: string } }>
      >`
        SELECT payload FROM outbox
        WHERE tenant_id = ${input.tenantId}::uuid
          AND type = 'InvitationClaimCode'
          AND aggregate_id = ${inv.id}::uuid
        ORDER BY created_at DESC
        LIMIT 1
      `;
      rawCode = minted[0]?.payload?.claimCode ?? '';
      if (!rawCode) {
        throw new ImportError(
          IMPORT_ERROR_CODES.INVITATION_TOKEN_INVALID,
          'Claim code missing for invitation',
        );
      }
    } else {
      rawCode = `inv-${randomBytes(24).toString('base64url')}`;
      const codeHmac = hashRedemptionCode(hmac, rawCode);
      const codeId = randomUUID();
      await tx.$executeRaw`
        INSERT INTO redemption_codes (
          tenant_id, event_id, id, code_hmac, code_pepper_version,
          source_id, ticket_type_id, status, created_at, updated_at
        ) VALUES (
          ${input.tenantId}::uuid, ${input.eventId}::uuid, ${codeId}::uuid,
          ${codeHmac}, ${hmac.version}, ${inv.source_id}::uuid,
          ${inv.ticket_type_id}::uuid, 'AVAILABLE', now(), now()
        )
      `;
      await tx.$executeRaw`
        UPDATE guest_invitations
        SET redemption_code_id = ${codeId}::uuid, updated_at = now()
        WHERE tenant_id = ${input.tenantId}::uuid AND id = ${inv.id}::uuid
      `;
      await tx.$executeRaw`
        INSERT INTO outbox (
          tenant_id, event_id, id, type, aggregate_id, payload_version,
          payload, status, attempts, created_at, updated_at
        ) VALUES (
          ${input.tenantId}::uuid, ${input.eventId}::uuid, ${randomUUID()}::uuid,
          'InvitationClaimCode', ${inv.id}::uuid, 1,
          ${JSON.stringify({ invitationId: inv.id, claimCode: rawCode })}::jsonb,
          'COMPLETE', 0, now(), now()
        )
      `;
    }

    const outcome = await redeemAndIssueTicket(tx, hmac, credentialKey, {
      tenantId: input.tenantId,
      eventId: input.eventId,
      actorUserId: input.actorUserId,
      actorEmail: email,
      emailVerified: true,
      rawCode,
      idempotencyKey: key,
      formVersion: input.body.formVersion,
      termsVersion: input.body.termsVersion,
      answers: input.body.answers as
        | Record<string, string | boolean>
        | undefined,
      termsAccepted: input.body.termsAccepted,
    });

    if (outcome.ok === true || outcome.ok === 'pending') {
      await tx.$executeRaw`
        UPDATE guest_invitations
        SET state = 'CLAIMED',
            claimed_by = ${input.actorUserId}::uuid,
            claimed_at = now(),
            updated_at = now()
        WHERE tenant_id = ${input.tenantId}::uuid
          AND id = ${inv.id}::uuid
          AND state <> 'CLAIMED'
      `;
    }
    return outcome;
  });
}
