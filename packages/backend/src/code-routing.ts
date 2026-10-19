import { createHmac, randomUUID } from 'node:crypto';
import type { Prisma } from './generated/prisma/client';
import {
  hashRedemptionCode,
  type CodeHmacConfig,
} from './code-hmac';
import { IssueError, ISSUE_ERROR_CODES } from './issue-error';
import { InventoryError, INVENTORY_ERROR_CODES } from './inventory-error';
import {
  assertOpenForIssuance,
  dbClock,
  lockEventPolicyForShare,
} from './event-policy';
import { loadPublishedFormTerms } from './published-form';
import type { RedemptionResolveResponse } from '@ticket/contracts';
import { REDEMPTION_FLOW } from '@ticket/contracts';
import { signResolveToken, verifyResolveToken } from './resolve-token';

export type RoutingResolution = 'ROUTABLE' | 'AMBIGUOUS' | 'LEGACY_UNLINKED';

export function normalizeRedemptionCodeInput(rawCode: string): string {
  return rawCode.trim().toUpperCase();
}

export function routingFingerprint(
  fpSecret: string,
  normalizedCode: string,
): Buffer {
  return createHmac('sha256', fpSecret)
    .update(`pf:${normalizedCode}`)
    .digest();
}

export function routingKeyFromFingerprint(fingerprint: Buffer): string {
  return `pf:${fingerprint.toString('hex')}`;
}

export function digestAliasesForCode(
  peppers: CodeHmacConfig[],
  normalizedCode: string,
): Array<{ version: number; hmac: string }> {
  return peppers.map((cfg) => ({
    version: cfg.version,
    hmac: hashRedemptionCode(cfg, normalizedCode),
  }));
}

async function lockRoutingKey(
  tx: Prisma.TransactionClient,
  routingKey: string,
): Promise<void> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext(${routingKey}))
  `;
}

/**
 * Attach routing registry rows for a newly inserted redemption code (same TX).
 */
export async function attachCodeRoutingOnInsert(
  tx: Prisma.TransactionClient,
  input: {
    peppers: CodeHmacConfig[];
    fpSecret: string;
    tenantId: string;
    eventId: string;
    redemptionCodeId: string;
    rawCode: string;
    codeStatus: string;
    insertPepperVersion: number;
    insertHmac: string;
  },
): Promise<void> {
  const normalized = normalizeRedemptionCodeInput(input.rawCode);
  const fingerprint = routingFingerprint(input.fpSecret, normalized);
  const routingKey = routingKeyFromFingerprint(fingerprint);
  await lockRoutingKey(tx, routingKey);

  const aliases = digestAliasesForCode(input.peppers, normalized);

  const existingKey = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM code_routing_groups WHERE routing_key = ${routingKey} LIMIT 1
  `;
  if (existingKey[0]) {
    throw new InventoryError(
      INVENTORY_ERROR_CODES.CODE_DUPLICATE,
      'Routing namespace is already reserved for this code',
    );
  }

  for (const alias of aliases) {
    const hit = await tx.$queryRaw<Array<{ routing_group_id: string }>>`
      SELECT routing_group_id FROM code_routing_digest_aliases
      WHERE code_pepper_version = ${alias.version}
        AND code_hmac = ${alias.hmac}
      LIMIT 1
    `;
    if (hit[0]) {
      throw new InventoryError(
        INVENTORY_ERROR_CODES.CODE_DUPLICATE,
        'Digest alias already reserved globally',
      );
    }
  }

  const groupId = randomUUID();
  await tx.$executeRaw`
    INSERT INTO code_routing_groups (
      id, routing_key, plaintext_fingerprint, resolution,
      routed_tenant_id, routed_event_id, routed_code_id,
      created_at, updated_at
    ) VALUES (
      ${groupId}::uuid, ${routingKey}, ${fingerprint}, 'ROUTABLE',
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${input.redemptionCodeId}::uuid,
      now(), now()
    )
  `;
  await tx.$executeRaw`
    INSERT INTO code_routing_candidates (
      routing_group_id, tenant_id, event_id, redemption_code_id,
      code_pepper_version, code_hmac, code_status_snapshot, created_at
    ) VALUES (
      ${groupId}::uuid, ${input.tenantId}::uuid, ${input.eventId}::uuid,
      ${input.redemptionCodeId}::uuid, ${input.insertPepperVersion}, ${input.insertHmac},
      ${input.codeStatus}, now()
    )
  `;
  for (const alias of aliases) {
    await tx.$executeRaw`
      INSERT INTO code_routing_digest_aliases (
        code_pepper_version, code_hmac, routing_group_id, routing_key, created_at
      ) VALUES (
        ${alias.version}, ${alias.hmac}, ${groupId}::uuid, ${routingKey}, now()
      )
    `;
  }
}

type ResolveGroupRow = {
  group_id: string;
  resolution: RoutingResolution;
  routed_tenant_id: string | null;
  routed_event_id: string | null;
  routed_code_id: string | null;
};

export async function lookupRoutingGroupsForCode(
  tx: Prisma.TransactionClient,
  peppers: CodeHmacConfig[],
  normalizedCode: string,
): Promise<ResolveGroupRow[]> {
  const aliases = digestAliasesForCode(peppers, normalizedCode);
  if (aliases.length === 0) return [];

  const byId = new Map<string, ResolveGroupRow>();
  for (const alias of aliases) {
    const rows = await tx.$queryRaw<ResolveGroupRow[]>`
      SELECT
        g.id AS group_id,
        g.resolution,
        g.routed_tenant_id,
        g.routed_event_id,
        g.routed_code_id
      FROM code_routing_digest_aliases a
      JOIN code_routing_groups g ON g.id = a.routing_group_id
      WHERE a.code_pepper_version = ${alias.version}
        AND a.code_hmac = ${alias.hmac}
    `;
    for (const row of rows) {
      byId.set(row.group_id, row);
    }
  }
  return [...byId.values()];
}

export async function countAmbiguousRoutingGroups(
  tx: Prisma.TransactionClient,
): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count FROM code_routing_groups
    WHERE resolution = 'AMBIGUOUS'
  `;
  return rows[0]?.count ?? 0;
}

export type RoutableTarget = {
  routingGroupId: string;
  tenantId: string;
  eventId: string;
  codeId: string;
};

export function assertRoutableTarget(
  groups: ResolveGroupRow[],
): RoutableTarget {
  if (groups.length === 0 || groups.length > 1) {
    throw new IssueError(
      ISSUE_ERROR_CODES.CODE_INVALID,
      'Redemption code is invalid or no longer available',
    );
  }
  const group = groups[0]!;
  if (
    group.resolution !== 'ROUTABLE' ||
    !group.routed_tenant_id ||
    !group.routed_event_id ||
    !group.routed_code_id
  ) {
    throw new IssueError(
      ISSUE_ERROR_CODES.CODE_INVALID,
      'Redemption code is invalid or no longer available',
    );
  }
  return {
    routingGroupId: group.group_id,
    tenantId: group.routed_tenant_id,
    eventId: group.routed_event_id,
    codeId: group.routed_code_id,
  };
}

export async function lookupRoutableTarget(
  tx: Prisma.TransactionClient,
  peppers: CodeHmacConfig[],
  rawCode: string,
): Promise<RoutableTarget> {
  let normalized: string;
  try {
    normalized = normalizeRedemptionCodeInput(rawCode);
    if (!normalized) {
      throw new IssueError(
        ISSUE_ERROR_CODES.CODE_INVALID,
        'Redemption code is invalid',
      );
    }
    hashRedemptionCode(peppers[peppers.length - 1]!, normalized);
  } catch (error) {
    if (error instanceof IssueError) throw error;
    throw new IssueError(
      ISSUE_ERROR_CODES.CODE_INVALID,
      'Redemption code is invalid',
    );
  }
  const groups = await lookupRoutingGroupsForCode(tx, peppers, normalized);
  return assertRoutableTarget(groups);
}

export type BuildResolveResponseInput = {
  actorUserId: string;
  target: RoutableTarget;
  resolveTokenSecret: string;
};

export async function buildRedemptionResolveResponse(
  tx: Prisma.TransactionClient,
  input: BuildResolveResponseInput,
): Promise<RedemptionResolveResponse> {
  const { tenantId, eventId, codeId } = input.target;

  const event = await lockEventPolicyForShare(tx, tenantId, eventId);
  const now = await dbClock(tx);
  try {
    assertOpenForIssuance(event, now, 'issue');
  } catch (error) {
    if (error instanceof IssueError) throw error;
    throw new IssueError(
      ISSUE_ERROR_CODES.REDEMPTION_WINDOW_CLOSED,
      'Redemption window is closed',
    );
  }

  const meta = await tx.$queryRaw<
    Array<{
      tenant_name: string;
      event_name: string;
      ticket_label: string;
      source_id: string;
      ticket_type_id: string;
      approval_mode: string;
    }>
  >`
    SELECT
      COALESCE(t.display_name, t.name) AS tenant_name,
      e.name AS event_name,
      tt.label AS ticket_label,
      c.source_id,
      c.ticket_type_id,
      s.approval_mode
    FROM redemption_codes c
    JOIN tenants t ON t.id = c.tenant_id
    JOIN events e ON e.tenant_id = c.tenant_id AND e.id = c.event_id
    JOIN ticket_types tt ON tt.tenant_id = c.tenant_id AND tt.id = c.ticket_type_id
    JOIN issuance_sources s ON s.tenant_id = c.tenant_id AND s.id = c.source_id
    WHERE c.tenant_id = ${tenantId}::uuid
      AND c.id = ${codeId}::uuid
  `;
  const row = meta[0];
  if (!row) {
    throw new IssueError(
      ISSUE_ERROR_CODES.CODE_INVALID,
      'Redemption code is invalid or no longer available',
    );
  }

  const published = await loadPublishedFormTerms(tx, tenantId, eventId);
  const opensAt = event.redemption_opens_at
    ? new Date(event.redemption_opens_at).toISOString()
    : null;
  const closesAt = event.redemption_closes_at
    ? new Date(event.redemption_closes_at).toISOString()
    : null;

  const { token, expiresAt } = signResolveToken(input.resolveTokenSecret, {
    actorUserId: input.actorUserId,
    routingGroupId: input.target.routingGroupId,
    tenantId,
    eventId,
    routedCodeId: codeId,
  });

  const terms =
    published.termsVersion && published.termsBody
      ? {
          version: published.termsVersion,
          bodyMarkdown: published.termsBody,
        }
      : null;

  return {
    tenantId,
    eventId,
    ticketTypeId: row.ticket_type_id,
    sourceId: row.source_id,
    tenantDisplayName: row.tenant_name,
    eventTitle: row.event_name,
    ticketTypeLabel: row.ticket_label,
    approvalMode: row.approval_mode === 'MANUAL' ? 'MANUAL' : 'AUTO',
    redemptionWindow: {
      opensAt,
      closesAt,
      open: true,
    },
    published: {
      form: published.form,
      terms,
      schemaVersion: 1,
      publishedConfigVersion: published.publishedConfigVersion ?? 0,
    },
    resolveToken: token,
    resolveExpiresAt: expiresAt,
    redemptionFlow: REDEMPTION_FLOW.GLOBAL,
  };
}

/** Legacy backfill: one candidate per redemption_codes row; merge alias collisions to AMBIGUOUS. */
export async function backfillCodeRoutingFromRedemptionCodes(
  tx: Prisma.TransactionClient,
): Promise<{ candidates: number; ambiguousGroups: number }> {
  const codes = await tx.$queryRaw<
    Array<{
      tenant_id: string;
      event_id: string;
      id: string;
      code_hmac: string;
      code_pepper_version: number;
      status: string;
    }>
  >`
    SELECT tenant_id, event_id, id, code_hmac, code_pepper_version, status
    FROM redemption_codes
    ORDER BY created_at
  `;

  let candidates = 0;
  for (const code of codes) {
    const existing = await tx.$queryRaw<Array<{ routing_group_id: string }>>`
      SELECT routing_group_id FROM code_routing_candidates
      WHERE tenant_id = ${code.tenant_id}::uuid
        AND event_id = ${code.event_id}::uuid
        AND redemption_code_id = ${code.id}::uuid
      LIMIT 1
    `;
    if (existing[0]) continue;

    const aliasHit = await tx.$queryRaw<
      Array<{ routing_group_id: string; routing_key: string }>
    >`
      SELECT routing_group_id, routing_key FROM code_routing_digest_aliases
      WHERE code_pepper_version = ${code.code_pepper_version}
        AND code_hmac = ${code.code_hmac}
      LIMIT 1
    `;

    if (!aliasHit[0]) {
      const groupId = randomUUID();
      const routingKey = `legacy:${code.code_pepper_version}:${code.code_hmac}`;
      await tx.$executeRaw`
        INSERT INTO code_routing_groups (
          id, routing_key, plaintext_fingerprint, resolution,
          routed_tenant_id, routed_event_id, routed_code_id,
          created_at, updated_at
        ) VALUES (
          ${groupId}::uuid, ${routingKey}, NULL, 'ROUTABLE',
          ${code.tenant_id}::uuid, ${code.event_id}::uuid, ${code.id}::uuid,
          now(), now()
        )
      `;
      await tx.$executeRaw`
        INSERT INTO code_routing_candidates (
          routing_group_id, tenant_id, event_id, redemption_code_id,
          code_pepper_version, code_hmac, code_status_snapshot, created_at
        ) VALUES (
          ${groupId}::uuid, ${code.tenant_id}::uuid, ${code.event_id}::uuid,
          ${code.id}::uuid, ${code.code_pepper_version}, ${code.code_hmac},
          ${code.status}, now()
        )
      `;
      await tx.$executeRaw`
        INSERT INTO code_routing_digest_aliases (
          code_pepper_version, code_hmac, routing_group_id, routing_key, created_at
        ) VALUES (
          ${code.code_pepper_version}, ${code.code_hmac},
          ${groupId}::uuid, ${routingKey}, now()
        )
      `;
      candidates += 1;
      continue;
    }

    const groupId = aliasHit[0].routing_group_id;
    await tx.$executeRaw`
      INSERT INTO code_routing_candidates (
        routing_group_id, tenant_id, event_id, redemption_code_id,
        code_pepper_version, code_hmac, code_status_snapshot, created_at
      ) VALUES (
        ${groupId}::uuid, ${code.tenant_id}::uuid, ${code.event_id}::uuid,
        ${code.id}::uuid, ${code.code_pepper_version}, ${code.code_hmac},
        ${code.status}, now()
      )
      ON CONFLICT DO NOTHING
    `;
    await tx.$executeRaw`
      UPDATE code_routing_groups
      SET resolution = 'AMBIGUOUS',
          routed_tenant_id = NULL,
          routed_event_id = NULL,
          routed_code_id = NULL,
          updated_at = now()
      WHERE id = ${groupId}::uuid
    `;
    candidates += 1;
  }

  const ambiguous = await countAmbiguousRoutingGroups(tx);
  return { candidates, ambiguousGroups: ambiguous };
}

export async function verifyResolveTokenForIssue(
  tx: Prisma.TransactionClient,
  input: {
    peppers: CodeHmacConfig[];
    resolveTokenSecret: string;
    token: string;
    actorUserId: string;
    tenantId: string;
    eventId: string;
    rawCode: string;
  },
): Promise<void> {
  const claims = verifyResolveToken(input.resolveTokenSecret, input.token);
  if (!claims) {
    throw new IssueError(
      ISSUE_ERROR_CODES.RESOLVE_TOKEN_STALE,
      'Resolve token is missing, invalid, or expired',
    );
  }
  if (
    claims.actorUserId !== input.actorUserId ||
    claims.tenantId !== input.tenantId ||
    claims.eventId !== input.eventId
  ) {
    throw new IssueError(
      ISSUE_ERROR_CODES.RESOLVE_TOKEN_STALE,
      'Resolve token does not match this redemption',
    );
  }

  const normalized = normalizeRedemptionCodeInput(input.rawCode);
  const groups = await lookupRoutingGroupsForCode(
    tx,
    input.peppers,
    normalized,
  );
  if (groups.length !== 1 || groups[0]!.group_id !== claims.routingGroupId) {
    throw new IssueError(
      ISSUE_ERROR_CODES.RESOLVE_TOKEN_STALE,
      'Resolve token does not match this code',
    );
  }
  if (claims.routedCodeId !== groups[0]!.routed_code_id) {
    throw new IssueError(
      ISSUE_ERROR_CODES.RESOLVE_TOKEN_STALE,
      'Resolve token does not match this code',
    );
  }
}
