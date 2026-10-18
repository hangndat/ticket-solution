import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from './generated/prisma/client';
import { PlatformError, PLATFORM_ERROR_CODES } from './platform-error';
import { IdentityError } from './identity-error';
import { IDENTITY_ERROR_CODES } from '@ticket/contracts';
import { withActor } from './tenant-context';
import {
  O06_ACCOUNT_ANONYMIZE_POLICY_VERSION,
  O06_ACCOUNT_ANONYMIZE_MAX_DAYS,
} from './retention-o06';
import type { VerifiedIdentity } from './oidc';
import {
  digestsForIdentity,
  mintTombstoneDigest,
  readTombstoneKeyring,
  TombstoneKeyringError,
  type TombstoneKeyring,
} from './tombstone-keyring';
import {
  createKeycloakErasureAdapter,
  IDP_ERROR_CODES,
  readKeycloakErasureEnvironment,
  type KeycloakErasureAdapter,
} from './keycloak-erasure';

export type AccountDeletionAck = {
  requestId: string;
  state: 'REQUESTED';
  requestedAt: string;
  policyStatus: 'RESOLVED';
  /** O06 SLA: anonymize must complete within this many days of request. */
  anonymizeWithinDays: typeof O06_ACCOUNT_ANONYMIZE_MAX_DAYS;
};

/**
 * SEC-1: revoke all ACTIVE staff_sessions for the user in the current transaction.
 * SECURITY DEFINER helper; failure rolls back the ACK (request insert/update).
 */
async function revokeSessionsForUserInTx(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.$executeRaw`
    SELECT revoke_sessions_for_user(${userId}::uuid)
  `;
}

/** ACK accepted under O06 — schedules anonymize pipeline (≤30 days). Never erases audit. */
export async function createAccountDeletionRequest(
  db: PrismaClient,
  input: { userId: string; confirmation: true },
): Promise<AccountDeletionAck> {
  if (input.confirmation !== true) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.INVALID_INPUT,
      'confirmation required',
    );
  }
  return withActor(db, input.userId, async (tx) => {
    const open = await tx.$queryRaw<
      {
        id: string;
        state: string;
        requested_at: Date;
        policy_version: string | null;
      }[]
    >`
      SELECT id, state, requested_at, policy_version FROM account_deletion_requests
      WHERE user_id = ${input.userId}::uuid
        AND state IN ('REQUESTED', 'UNDER_REVIEW', 'AWAITING_POLICY')
      FOR UPDATE
    `;
    if (open[0]) {
      if (
        open[0].state === 'AWAITING_POLICY' ||
        open[0].policy_version == null
      ) {
        await tx.$executeRaw`
          UPDATE account_deletion_requests
          SET state = 'REQUESTED',
              policy_version = ${O06_ACCOUNT_ANONYMIZE_POLICY_VERSION},
              updated_at = now()
          WHERE id = ${open[0].id}::uuid
        `;
      }
      // Idempotent re-ACK: revoke again (no-op if already REVOKED).
      await revokeSessionsForUserInTx(tx, input.userId);
      return {
        requestId: open[0].id,
        state: 'REQUESTED' as const,
        requestedAt: open[0].requested_at.toISOString(),
        policyStatus: 'RESOLVED' as const,
        anonymizeWithinDays: O06_ACCOUNT_ANONYMIZE_MAX_DAYS,
      };
    }
    const requestId = randomUUID();
    // Use PG clock_timestamp() — JS Date can sit ahead of Docker PG and
    // leave rows invisible to list_due (requested_at <= clock_timestamp()).
    const inserted = await tx.$queryRaw<{ requested_at: Date }[]>`
      INSERT INTO account_deletion_requests (
        id, user_id, state, requested_at, policy_version
      ) VALUES (
        ${requestId}::uuid, ${input.userId}::uuid, 'REQUESTED',
        clock_timestamp(), ${O06_ACCOUNT_ANONYMIZE_POLICY_VERSION}
      )
      RETURNING requested_at
    `;
    // Atomic with ACK: revoke failure rolls back the REQUESTED row.
    await revokeSessionsForUserInTx(tx, input.userId);
    return {
      requestId,
      state: 'REQUESTED' as const,
      requestedAt: inserted[0]!.requested_at.toISOString(),
      policyStatus: 'RESOLVED' as const,
      anonymizeWithinDays: O06_ACCOUNT_ANONYMIZE_MAX_DAYS,
    };
  });
}

export async function getCurrentAccountDeletionRequest(
  db: PrismaClient,
  userId: string,
): Promise<{
  requestId: string;
  state: string;
  requestedAt: string;
  policyStatus: 'UNRESOLVED' | 'RESOLVED';
  anonymizeWithinDays: typeof O06_ACCOUNT_ANONYMIZE_MAX_DAYS;
} | null> {
  return withActor(db, userId, async (tx) => {
    const rows = await tx.$queryRaw<
      { id: string; state: string; requested_at: Date; policy_version: string | null }[]
    >`
      SELECT id, state, requested_at, policy_version
      FROM account_deletion_requests
      WHERE user_id = ${userId}::uuid
      ORDER BY requested_at DESC
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      requestId: row.id,
      state: row.state,
      requestedAt: row.requested_at.toISOString(),
      policyStatus: row.policy_version ? 'RESOLVED' : 'UNRESOLVED',
      anonymizeWithinDays: O06_ACCOUNT_ANONYMIZE_MAX_DAYS,
    };
  });
}

export type DueAccountAnonymization = {
  request_id: string;
  user_id: string;
};

export async function listDueAccountAnonymizations(
  db: PrismaClient,
  limit = 50,
): Promise<DueAccountAnonymization[]> {
  const rows = await db.$queryRaw<
    { out_request_id: string; out_user_id: string }[]
  >`
    SELECT out_request_id, out_user_id
    FROM list_due_account_anonymizations(${limit}::integer)
  `;
  return rows.map((r) => ({
    request_id: r.out_request_id,
    user_id: r.out_user_id,
  }));
}

export type ApplyAccountAnonymizationResult = {
  request_id: string;
  user_id: string | null;
  applied: boolean;
};

export async function applyAccountAnonymization(
  db: PrismaClient,
  requestId: string,
): Promise<ApplyAccountAnonymizationResult> {
  const rows = await db.$queryRaw<
    { out_request_id: string; out_user_id: string | null; out_applied: boolean }[]
  >`
    SELECT out_request_id, out_user_id, out_applied
    FROM apply_account_anonymization(${requestId}::uuid)
  `;
  const row = rows[0];
  if (!row) {
    return { request_id: requestId, user_id: null, applied: false };
  }
  return {
    request_id: row.out_request_id,
    user_id: row.out_user_id,
    applied: row.out_applied,
  };
}

export type ProcessDueAccountDeletionOptions = {
  env?: NodeJS.ProcessEnv;
  leaseOwner?: string;
  /** Test-only IdP adapter; production builds from env. */
  idp?: KeycloakErasureAdapter | null;
  keyring?: TombstoneKeyring;
};

export type ProcessDueAccountDeletionResult = {
  scanned: number;
  /** PG scrub newly applied this run (not COMPLETED). */
  applied: number;
  /** Reached COMPLETED (PG + IdP terminal). */
  completed: number;
  purged: number;
  slaOverdue: number;
};

function backoffSeconds(attempts: number): number {
  return Math.min(3600, 30 * 2 ** Math.min(attempts, 6));
}

async function prepareSnapshotAndApply(
  db: PrismaClient,
  requestId: string,
  userId: string,
  env: NodeJS.ProcessEnv,
  keyring: TombstoneKeyring,
  leaseOwner: string,
): Promise<'applied' | 'skipped' | 'blocked'> {
  const existing = await db.$queryRaw<{ out_pg_applied_at: Date | null }[]>`
    SELECT out_pg_applied_at FROM get_account_deletion_idp_row(${requestId}::uuid)
  `;
  if (existing[0]?.out_pg_applied_at) return 'skipped';

  const users = await db.$queryRaw<{ issuer: string; subject: string }[]>`
    SELECT issuer, subject FROM users WHERE id = ${userId}::uuid
  `;
  const user = users[0];
  if (!user) return 'blocked';

  const allowIssuer = env['OIDC_ISSUER']?.trim() ?? '';
  if (!allowIssuer || user.issuer !== allowIssuer) {
    await db.$queryRaw`
      SELECT mark_account_deletion_idp_attempt(
        ${requestId}::uuid,
        ${leaseOwner}::text,
        ${'FAILED'}::text,
        ${IDP_ERROR_CODES.IDP_ISSUER_NOT_ALLOWLISTED}::text,
        ${60}::integer
      )
    `;
    return 'blocked';
  }

  const { keyId, digest } = mintTombstoneDigest(
    keyring,
    user.issuer,
    user.subject,
  );
  const tentativeExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const digestBytes = Uint8Array.from(digest);

  const prepared = await db.$queryRaw<
    { prepare_account_deletion_snapshot: boolean }[]
  >`
    SELECT prepare_account_deletion_snapshot(
      ${requestId}::uuid,
      ${user.issuer}::text,
      ${user.subject}::text,
      ${digestBytes}::bytea,
      ${keyId}::text,
      ${tentativeExpiry}::timestamptz
    )
  `;
  if (!prepared[0]?.prepare_account_deletion_snapshot) {
    return 'blocked';
  }

  const result = await applyAccountAnonymization(db, requestId);
  return result.applied ? 'applied' : 'skipped';
}

/**
 * Worker entry: PG scrub + IdP DELETE; COMPLETED only when both succeed.
 * Missing IdP/keyring config → fail-closed (no PG-only COMPLETED).
 */
export async function processDueAccountAnonymizations(
  db: PrismaClient,
  limit = 50,
  options: ProcessDueAccountDeletionOptions = {},
): Promise<ProcessDueAccountDeletionResult> {
  const env = options.env ?? process.env;
  const leaseOwner = options.leaseOwner ?? `worker-${randomUUID()}`;
  const rows = await listDueAccountAnonymizations(db, limit);

  let keyring: TombstoneKeyring | null = options.keyring ?? null;
  if (!keyring) {
    try {
      keyring = readTombstoneKeyring(env);
    } catch (err) {
      if (err instanceof TombstoneKeyringError) {
        console.error(
          JSON.stringify({
            alert: 'account_deletion_tombstone_keyring_missing',
            severity: 'error',
            code: err.code,
          }),
        );
      }
      keyring = null;
    }
  }

  let idp: KeycloakErasureAdapter | null | undefined = options.idp;
  if (idp === undefined) {
    const cfg = readKeycloakErasureEnvironment(env);
    idp = cfg ? createKeycloakErasureAdapter(cfg) : null;
  }

  let applied = 0;
  let completed = 0;

  for (const row of rows) {
    if (!keyring) {
      await db.$executeRaw`
        SELECT mark_account_deletion_idp_attempt(
          ${row.request_id}::uuid,
          ${leaseOwner}::text,
          ${'FAILED'}::text,
          ${'IDP_KEYRING_MISSING'}::text,
          ${120}::integer
        )
      `;
      continue;
    }

    const claimed = await db.$queryRaw<{ claim_account_deletion_idp_lease: boolean }[]>`
      SELECT claim_account_deletion_idp_lease(
        ${row.request_id}::uuid,
        ${leaseOwner}::text,
        ${45}::integer
      )
    `;
    if (!claimed[0]?.claim_account_deletion_idp_lease) {
      continue;
    }

    const prep = await prepareSnapshotAndApply(
      db,
      row.request_id,
      row.user_id,
      env,
      keyring,
      leaseOwner,
    );
    if (prep === 'applied') applied += 1;
    if (prep === 'blocked') continue;

    const snap = await db.$queryRaw<
      {
        out_original_issuer: string | null;
        out_original_subject: string | null;
        out_pg_applied_at: Date | null;
        out_idp_attempts: number;
      }[]
    >`
      SELECT out_original_issuer, out_original_subject, out_pg_applied_at, out_idp_attempts
      FROM get_account_deletion_idp_row(${row.request_id}::uuid)
    `;
    const s = snap[0];
    if (
      !s?.out_pg_applied_at ||
      !s.out_original_issuer ||
      !s.out_original_subject
    ) {
      continue;
    }

    if (!idp) {
      await db.$executeRaw`
        SELECT mark_account_deletion_idp_attempt(
          ${row.request_id}::uuid,
          ${leaseOwner}::text,
          ${'FAILED'}::text,
          ${IDP_ERROR_CODES.IDP_MISCONFIGURED}::text,
          ${backoffSeconds(s.out_idp_attempts)}::integer
        )
      `;
      continue;
    }

    const outcome = await idp.deleteUserBySubject({
      issuer: s.out_original_issuer,
      subject: s.out_original_subject,
    });

    if (outcome.kind === 'DELETED' || outcome.kind === 'NOT_FOUND') {
      const ok = await db.$queryRaw<{ finalize_account_deletion_idp: boolean }[]>`
        SELECT finalize_account_deletion_idp(
          ${row.request_id}::uuid,
          ${leaseOwner}::text,
          ${outcome.kind}::text
        )
      `;
      if (ok[0]?.finalize_account_deletion_idp) completed += 1;
      continue;
    }

    const status = outcome.idpStatus ?? 'FAILED';
    await db.$executeRaw`
      SELECT mark_account_deletion_idp_attempt(
        ${row.request_id}::uuid,
        ${leaseOwner}::text,
        ${status}::text,
        ${outcome.errorCode}::text,
        ${backoffSeconds(s.out_idp_attempts)}::integer
      )
    `;
  }

  const purgedRows = await db.$queryRaw<
    { purge_expired_account_deletion_tombstones: number }[]
  >`SELECT purge_expired_account_deletion_tombstones()`;
  const purged = Number(
    purgedRows[0]?.purge_expired_account_deletion_tombstones ?? 0,
  );

  const slaRows = await db.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n
    FROM account_deletion_requests
    WHERE state = 'REQUESTED'
      AND policy_version IS NOT NULL
      AND requested_at < clock_timestamp() - interval '30 days'
  `;
  const slaOverdue = Number(slaRows[0]?.n ?? 0);
  if (slaOverdue > 0) {
    console.error(
      JSON.stringify({
        metric: 'account_deletion_idp_sla_overdue',
        count: slaOverdue,
        severity: 'warning',
      }),
    );
  }

  return {
    scanned: rows.length,
    applied,
    completed,
    purged,
    slaOverdue,
  };
}

export async function purgeExpiredAccountDeletionTombstones(
  db: PrismaClient,
): Promise<number> {
  const rows = await db.$queryRaw<
    { purge_expired_account_deletion_tombstones: number }[]
  >`SELECT purge_expired_account_deletion_tombstones()`;
  return Number(rows[0]?.purge_expired_account_deletion_tombstones ?? 0);
}

/**
 * Distinct key ids still needed to verify unexpired digests (R3 dual-accept).
 * No digests/subjects returned — safe for ops alerts / gating only.
 */
async function listUnexpiredTombstoneKeyIds(
  db: PrismaClient,
): Promise<string[]> {
  const rows = await db.$queryRaw<{ out_key_id: string }[]>`
    SELECT out_key_id FROM account_deletion_unexpired_tombstone_key_ids()
  `;
  return rows.map((r) => r.out_key_id).filter((id) => typeof id === 'string' && id.length > 0);
}

function denyUpsertForDenylist(): never {
  throw new IdentityError(
    IDENTITY_ERROR_CODES.UNAUTHENTICATED,
    'Account deletion in progress',
  );
}

/**
 * Fail-closed identity gate: open deletion request or unexpired tombstone digest.
 * Missing/invalid keyring fails closed when any unexpired digest exists (B1 / R3).
 * Zero live tombstones + disabled keyring may stay operational (dev placeholder).
 * Historical keyId still referenced by live digests must not be silently skipped.
 */
export async function assertIdentityAllowedForUpsert(
  db: PrismaClient,
  identity: VerifiedIdentity,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const open = await db.$queryRaw<
    { account_deletion_open_for_identity: boolean }[]
  >`
    SELECT account_deletion_open_for_identity(
      ${identity.issuer}::text,
      ${identity.subject}::text
    )
  `;
  if (open[0]?.account_deletion_open_for_identity) {
    denyUpsertForDenylist();
  }

  const requiredKeyIds = await listUnexpiredTombstoneKeyIds(db);

  let keyring: TombstoneKeyring;
  try {
    keyring = readTombstoneKeyring(env);
  } catch (err) {
    if (err instanceof TombstoneKeyringError) {
      // Sanitized alert only — never log secrets, digests, or subjects.
      console.error(
        JSON.stringify({
          alert: 'account_deletion_tombstone_keyring_missing',
          severity: 'error',
          code: err.code,
          operational_reason: 'keyring_unavailable',
          live_tombstone_keys: requiredKeyIds.length,
        }),
      );
      if (requiredKeyIds.length > 0) {
        // Cannot verify digests without keys — do not guess identity match.
        denyUpsertForDenylist();
      }
      // Legitimately disabled / unset keyring with zero live tombstones.
      return;
    }
    throw err;
  }

  const ringIds = new Set(keyring.keys.map((k) => k.keyId));
  for (const keyId of requiredKeyIds) {
    if (!ringIds.has(keyId)) {
      console.error(
        JSON.stringify({
          alert: 'account_deletion_tombstone_key_unknown',
          severity: 'error',
          code: 'KEY_UNKNOWN',
          operational_reason: 'required_unexpired_key_absent',
        }),
      );
      denyUpsertForDenylist();
    }
  }

  for (const digest of digestsForIdentity(
    keyring,
    identity.issuer,
    identity.subject,
  )) {
    const digestBytes = Uint8Array.from(digest);
    const hit = await db.$queryRaw<{ account_deletion_tombstone_blocks: boolean }[]>`
      SELECT account_deletion_tombstone_blocks(
        ${identity.issuer}::text,
        ${digestBytes}::bytea
      )
    `;
    if (hit[0]?.account_deletion_tombstone_blocks) {
      denyUpsertForDenylist();
    }
  }
}
