import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from './generated/prisma/client';
import { EventError, EVENT_ERROR_CODES } from './event-error';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OperationRow = {
  id: string;
  request_hash: string;
  status: string;
  response_json: Prisma.JsonValue | null;
};

export function canonicalHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function requireIdempotencyKey(key: string | undefined): string {
  const trimmed = key?.trim() ?? '';
  if (!UUID_RE.test(trimmed)) {
    throw new EventError(
      EVENT_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
      'Idempotency-Key must be a UUID',
    );
  }
  return trimmed;
}

export async function claimOperation(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    command: string;
    clientKey: string;
    requestHash: string;
  },
): Promise<{ op: OperationRow; claimed: boolean }> {
  const operationId = randomUUID();
  await tx.$executeRaw`
    INSERT INTO operations (
      tenant_id, event_id, id, actor_user_id, command, client_key,
      request_hash, status, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${operationId}::uuid,
      ${input.actorUserId}::uuid, ${input.command}, ${input.clientKey},
      ${input.requestHash}, 'IN_PROGRESS', now(), now()
    )
    ON CONFLICT (tenant_id, event_id, actor_user_id, command, client_key)
    DO NOTHING
  `;
  const ops = await tx.$queryRaw<OperationRow[]>`
    SELECT id, request_hash, status, response_json
    FROM operations
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND actor_user_id = ${input.actorUserId}::uuid
      AND command = ${input.command}
      AND client_key = ${input.clientKey}
    FOR UPDATE
  `;
  const op = ops[0];
  if (!op) {
    throw new EventError(
      EVENT_ERROR_CODES.RETRYABLE_CONFLICT,
      'Failed to claim idempotency operation',
      true,
    );
  }
  if (op.request_hash !== input.requestHash) {
    throw new EventError(
      EVENT_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      'Idempotency-Key was reused with a different request',
    );
  }
  if (op.status === 'COMPLETED') {
    return { op, claimed: false };
  }
  if (op.status === 'FAILED') {
    throw new EventError(
      EVENT_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      'Idempotency-Key already finished with a terminal failure; use a new key',
    );
  }
  return { op, claimed: true };
}

export async function completeOperation(
  tx: Prisma.TransactionClient,
  tenantId: string,
  operationId: string,
  body: unknown,
): Promise<void> {
  await tx.$executeRaw`
    UPDATE operations
    SET status = 'COMPLETED',
        response_json = ${JSON.stringify(body)}::jsonb,
        updated_at = now()
    WHERE tenant_id = ${tenantId}::uuid
      AND id = ${operationId}::uuid
  `;
}

export async function writeAudit(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    action: string;
    reason?: string;
    sanitizedDiff?: unknown;
    operationId?: string;
  },
): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO audit_logs (
      tenant_id, event_id, id, actor_user_id, action, resource_type, resource_id,
      reason, sanitized_diff, operation_id
    ) VALUES (
      ${input.tenantId}::uuid,
      ${input.eventId}::uuid,
      ${randomUUID()}::uuid,
      ${input.actorUserId}::uuid,
      ${input.action},
      'event',
      ${input.eventId}::uuid,
      ${input.reason ?? null},
      ${input.sanitizedDiff ? JSON.stringify(input.sanitizedDiff) : null}::jsonb,
      ${input.operationId ?? null}::uuid
    )
  `;
}
