/**
 * Operator-only repair for legacy COMPLETE TicketIssued rows. Dry-run by default.
 * Stop old workers before --apply: their email-only completion path is incompatible.
 */
const { randomUUID } = require('node:crypto');
const { createDatabase, withTenant } = require('../dist');

async function main() {
  const tenantIndex = process.argv.indexOf('--tenant');
  const tenantId = tenantIndex >= 0 ? process.argv[tenantIndex + 1] : '';
  const apply = process.argv.includes('--apply');
  const limitIndex = process.argv.indexOf('--limit');
  const limit = limitIndex >= 0 ? Number(process.argv[limitIndex + 1]) : 100;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      tenantId,
    )
  ) {
    throw new Error('usage: --tenant <uuid> [--limit 1..100] [--apply]');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('limit must be 1..100');
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const db = createDatabase(process.env.DATABASE_URL, 2);
  try {
    const result = await withTenant(db, tenantId, async (tx) => {
      const candidates = await tx.$queryRaw`
        SELECT o.id, o.payload->'deliverySnapshot' AS snapshot
        FROM outbox o
        WHERE o.tenant_id = ${tenantId}::uuid
          AND o.type = 'TicketIssued' AND o.status = 'COMPLETE'
          AND EXISTS (
            SELECT 1 FROM notifications e
            WHERE e.tenant_id = o.tenant_id AND e.channel = 'email'
              AND e.business_key = 'ticket:' || o.aggregate_id::text || ':issued:email'
              AND e.state = 'ACCEPTED'
          )
          AND (
            o.payload->'deliverySnapshot' IS NULL
            OR EXISTS (
              SELECT 1 FROM notifications p
              WHERE p.tenant_id = o.tenant_id AND p.channel = 'push'
                AND p.business_key LIKE 'ticket:' || o.aggregate_id::text || ':issued:push:%'
                AND p.state <> 'ACCEPTED'
            )
          )
        ORDER BY o.created_at, o.id
        LIMIT ${limit}::integer
        FOR UPDATE OF o SKIP LOCKED
      `;
      if (apply) {
        for (const row of candidates) {
          await tx.$executeRaw`
            UPDATE outbox SET status = 'PENDING', next_attempt_at = clock_timestamp(),
              lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL,
              updated_at = now()
            WHERE tenant_id = ${tenantId}::uuid AND id = ${row.id}::uuid
              AND status = 'COMPLETE'
          `;
          await tx.$executeRaw`
            INSERT INTO audit_logs (
              tenant_id, id, action, resource_type, resource_id, reason, created_at
            ) VALUES (
              ${tenantId}::uuid, ${randomUUID()}::uuid,
              'outbox.legacy_repair', 'outbox', ${row.id}::uuid,
              'requeue legacy TicketIssued completion for delivery reconciliation', now()
            )
          `;
        }
      }
      return {
        tenantId,
        mode: apply ? 'apply' : 'dry-run',
        candidates: candidates.length,
        legacyWithoutSnapshot: candidates.filter((row) => row.snapshot === null)
          .length,
      };
    });
    process.stdout.write(JSON.stringify(result) + '\n');
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(
    (error instanceof Error ? error.message : 'repair failed') + '\n',
  );
  process.exitCode = 1;
});
