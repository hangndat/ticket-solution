#!/usr/bin/env node
/**
 * Cleanup VCX-925 fixture namespace only (UI869 DB + loopback guard).
 */
'use strict';

async function main() {
  const guard = await import('./lib/ui869-fixture-guard.mjs');
  const target = guard.assertUi869FixtureTarget(process.env);
  const mfest = 'd9d9f001-0001-4000-8000-000000000001';
  const mfestEvent = 'd9d9f001-0002-4000-8000-000000000001';
  guard.assertUi869CleanupScope([mfest, 'd9d9f001-0001-4000-8000-000000000002']);

  const {
    createDatabase,
    withTenant,
    readCodeHmacEnvironment,
    hashRedemptionCode,
  } = require('../packages/backend/dist');
  const hmac = readCodeHmacEnvironment(process.env);
  const db = createDatabase(target.databaseUrl, 2);
  const report = { ok: true, namespace: guard.UI869_FIXTURE_NS, removed: {} };

  const fixtureEmails = await db.$queryRaw`
    SELECT id, email FROM users
    WHERE email LIKE 'vcx925-%@example.com'
       OR email LIKE '%.fixture@example.com'`;

  try {
    for (const { id: userId, email } of fixtureEmails) {
      await db.$executeRaw`
        DELETE FROM redemption_requests
        WHERE actor_user_id = ${userId}::uuid`;
      await db.$executeRaw`
        DELETE FROM tickets WHERE owner_user_id = ${userId}::uuid`;
      await db.$executeRaw`
        DELETE FROM event_assignments ea
        USING memberships m
        WHERE m.user_id = ${userId}::uuid AND ea.membership_id = m.id`;
      await db.$executeRaw`
        DELETE FROM memberships WHERE user_id = ${userId}::uuid`;
      await db.$executeRaw`DELETE FROM users WHERE id = ${userId}::uuid`;
      report.removed.users = (report.removed.users || 0) + 1;
      report.removed.lastEmail = email;
    }

    const digests = [];
    for (let i = 1; i <= 40; i += 1) {
      digests.push(
        hashRedemptionCode(hmac, `VCX925-BULK-${String(i).padStart(3, '0')}`),
      );
    }
    for (let i = 1; i <= 20; i += 1) {
      digests.push(
        hashRedemptionCode(hmac, `VCX925-PEND-${String(i).padStart(3, '0')}`),
      );
    }
    for (let i = 1; i <= 30; i += 1) {
      digests.push(
        hashRedemptionCode(hmac, `VCX925-TKT-${String(i).padStart(3, '0')}`),
      );
    }

    await withTenant(db, mfest, async (tx) => {
      for (const digest of digests) {
        const codes = await tx.$queryRaw`
          SELECT id FROM redemption_codes
          WHERE tenant_id = ${mfest}::uuid AND event_id = ${mfestEvent}::uuid
            AND code_hmac = ${digest}`;
        for (const row of codes) {
          await tx.$executeRaw`
            DELETE FROM tickets
            WHERE tenant_id = ${mfest}::uuid AND redemption_code_id = ${row.id}::uuid`;
          await tx.$executeRaw`
            DELETE FROM redemption_requests
            WHERE redemption_code_id = ${row.id}::uuid`;
          await tx.$executeRaw`
            DELETE FROM redemption_codes WHERE id = ${row.id}::uuid`;
          report.removed.codes = (report.removed.codes || 0) + 1;
        }
      }
    });

    console.log(JSON.stringify(report));
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message }));
  process.exitCode = 1;
});
