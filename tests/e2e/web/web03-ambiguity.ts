import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { expect } from 'playwright/test';
import type { CaseFixture } from '../harness/contract';

const requireBackend = createRequire(
  resolve(process.cwd(), 'packages/backend/package.json'),
);
const backend = requireBackend('./dist/index.js');
const { Client } = requireBackend('pg');

/** Exercise a real legacy collision and restore the run-local fixture afterward. */
export async function withLegacyCodeCollision<T>(
  fixture: CaseFixture,
  codeId: string,
  run: () => Promise<T>,
): Promise<T> {
  if (
    !process.env.DATABASE_URL ||
    !process.env.E2E_RUN_DIR ||
    !process.env.CODE_HMAC_PEPPER
  )
    throw new Error('BLOCKED: legacy collision requires isolated E2E runtime');
  if (!fixture.code)
    throw new Error('BLOCKED: WEB-03 needs a raw fixture code');

  const eventId = randomUUID();
  const db = backend.createDatabase(process.env.DATABASE_URL);
  let inventory: { codeIds: string[] } | undefined;
  try {
    await backend.withTenant(db, fixture.tenantId, async (tx: any) => {
      await tx.event.create({
        data: {
          tenantId: fixture.tenantId,
          id: eventId,
          slug: 'legacy-collision',
          name: 'E2E legacy collision',
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
        },
      });
      const hmac = backend.readCodeHmacEnvironment({
        CODE_HMAC_PEPPER: process.env.CODE_HMAC_PEPPER,
        CODE_HMAC_VERSION: '1',
      });
      inventory = await backend.seedEventInventory(tx, hmac, {
        tenantId: fixture.tenantId,
        eventId,
        eventQuota: 100,
        rawCodes: [fixture.code],
      });
      const result = await backend.backfillCodeRoutingFromRedemptionCodes(tx);
      expect(result.candidates).toBe(1);
      expect(result.ambiguousGroups).toBeGreaterThanOrEqual(1);
    });
  } finally {
    await db.$disconnect();
  }

  if (!inventory?.codeIds[0])
    throw new Error('BLOCKED: legacy collision code was not created');
  const collisionCodeId = inventory.codeIds[0];
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      fixture.tenantId,
    ]);
    const { rows } = await client.query(
      `SELECT g.id AS group_id, g.resolution, g.routed_code_id, c.event_id, c.redemption_code_id
       FROM code_routing_groups g
       JOIN code_routing_candidates c ON c.routing_group_id = g.id
       WHERE c.tenant_id=$1::uuid AND c.redemption_code_id IN ($2::uuid, $3::uuid)
       ORDER BY c.event_id`,
      [fixture.tenantId, codeId, collisionCodeId],
    );
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row: any) => row.group_id)).size).toBe(1);
    expect(rows.map((row: any) => row.event_id).sort()).toEqual(
      [fixture.eventId, eventId].sort(),
    );
    expect(rows.map((row: any) => row.redemption_code_id).sort()).toEqual(
      [codeId, collisionCodeId].sort(),
    );
    expect(rows.map((row: any) => row.resolution)).toEqual([
      'AMBIGUOUS',
      'AMBIGUOUS',
    ]);
    expect(rows.map((row: any) => row.routed_code_id)).toEqual([null, null]);
    await client.query('COMMIT');
    return await run();
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
    // The candidate must go before its code; restore the sole route before
    // deleting the temporary event inventory. The run-local admin owns these
    // tables; the app's tenant role intentionally has no routing DELETE grant.
    const adminUrl = new URL(process.env.DATABASE_URL);
    adminUrl.username = 'postgres';
    const admin = new Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    await admin.query('BEGIN');
    try {
      const { rows } = await admin.query(
        `SELECT c.routing_group_id AS group_id
         FROM code_routing_candidates c
         WHERE c.tenant_id=$1::uuid AND c.event_id=$2::uuid
           AND c.redemption_code_id=$3::uuid`,
        [fixture.tenantId, eventId, collisionCodeId],
      );
      expect(rows).toHaveLength(1);
      const groupId = rows[0].group_id as string;
      const original = await admin.query(
        `SELECT 1 FROM code_routing_candidates
         WHERE routing_group_id=$1::uuid AND tenant_id=$2::uuid
           AND event_id=$3::uuid AND redemption_code_id=$4::uuid`,
        [groupId, fixture.tenantId, fixture.eventId, codeId],
      );
      expect(original.rowCount).toBe(1);
      const removed = await admin.query(
        `DELETE FROM code_routing_candidates
         WHERE routing_group_id=$1::uuid AND tenant_id=$2::uuid
           AND event_id=$3::uuid AND redemption_code_id=$4::uuid`,
        [groupId, fixture.tenantId, eventId, collisionCodeId],
      );
      expect(removed.rowCount).toBe(1);
      const restored = await admin.query(
        `UPDATE code_routing_groups
         SET resolution='ROUTABLE', routed_tenant_id=$2::uuid,
             routed_event_id=$3::uuid, routed_code_id=$4::uuid,
             updated_at=now()
         WHERE id=$1::uuid AND resolution='AMBIGUOUS'
           AND NOT EXISTS (
             SELECT 1 FROM code_routing_candidates
             WHERE routing_group_id=$1::uuid
               AND (tenant_id, event_id, redemption_code_id)
                 <> ($2::uuid, $3::uuid, $4::uuid)
           )`,
        [groupId, fixture.tenantId, fixture.eventId, codeId],
      );
      expect(restored.rowCount).toBe(1);
      for (const [table, expected] of [
        ['redemption_codes', 1],
        ['quota_buckets', 3],
        ['source_ticket_types', 1],
        ['issuance_sources', 1],
        ['ticket_types', 1],
      ] as const) {
        const deleted = await admin.query(
          `DELETE FROM ${table} WHERE tenant_id=$1::uuid AND event_id=$2::uuid`,
          [fixture.tenantId, eventId],
        );
        expect(deleted.rowCount).toBe(expected);
      }
      const deletedEvent = await admin.query(
        'DELETE FROM events WHERE tenant_id=$1::uuid AND id=$2::uuid',
        [fixture.tenantId, eventId],
      );
      expect(deletedEvent.rowCount).toBe(1);
      await admin.query('COMMIT');
    } catch (error) {
      await admin.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      await admin.end();
    }
  }
}
