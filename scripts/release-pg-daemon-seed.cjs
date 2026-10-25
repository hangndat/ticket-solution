const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

const releaseDir = path.resolve(process.argv[2]);
const suffix = process.argv[3] ?? '2';
assert.match(suffix, /^[2-9]$/);
const backend = require(path.join(releaseDir, 'packages/backend/dist'));
const db = backend.createDatabase(process.env.RELEASE_RUNTIME_URL, 2);

async function main() {
  const tenantId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const eventId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const hmac = backend.readCodeHmacEnvironment({
    CODE_HMAC_PEPPER: 'release-fixture-pepper',
    CODE_HMAC_VERSION: '1',
  });
  const users = backend.createPrismaIdentityUserRepository(db);
  const owner = await users.upsertFromVerifiedIdentity({
    issuer: 'http://127.0.0.1:8080/realms/ticket',
    subject: `ar891-daemon-owner-${suffix}`,
    email: `daemon-owner-${suffix}@example.test`,
    emailVerified: true,
  });
  await backend.withTenant(db, tenantId, (tx) =>
    backend.seedEventInventory(tx, hmac, {
      tenantId,
      eventId,
      eventQuota: 3,
      rawCodes: [`AR891-DAEMON-${suffix}`],
    }),
  );
  const issued = backend.unwrapRedeemOutcome(
    await backend.withTenant(db, tenantId, (tx) =>
      backend.redeemAndIssueTicket(tx, hmac, 'release-fixture-credential-key', {
        tenantId,
        eventId,
        actorUserId: owner.userId,
        actorEmail: owner.email,
        emailVerified: true,
        rawCode: `AR891-DAEMON-${suffix}`,
        idempotencyKey: randomUUID(),
        termsVersion: 'terms-v1',
        termsAccepted: true,
      }),
    ),
  );
  const rows = await backend.withTenant(db, tenantId, (tx) =>
    tx.$queryRaw`SELECT id, status FROM outbox WHERE tenant_id = ${tenantId}::uuid AND aggregate_id = ${issued.ticketId}::uuid AND type = 'TicketIssued'`,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'PENDING');
  console.log(JSON.stringify({ ticketId: issued.ticketId, outboxId: rows[0].id, before: rows[0].status }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
