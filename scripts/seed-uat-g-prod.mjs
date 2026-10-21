/**
 * Prod ops: seed uat-g attendee/staff app state + 4 redemption tickets (G01–G04).
 * Run inside vemoki-runtime with DATABASE_URL + TICKET_CREDENTIAL_KEY from /opt/vemoki/.env.
 * Keycloak subjects must be passed via ATTENDEE_SUB / STAFF_SUB (kcadm, not printed).
 */
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import {
  createDatabase,
  withTenant,
  seedEventInventory,
  redeemAndIssueTicket,
  unwrapRedeemOutcome,
  grantMembership,
  grantEventAssignment,
  createPrismaIdentityUserRepository,
  readCodeHmacEnvironment,
  readCredentialKeyEnvironment,
  renderCredentialQrPng,
  openCurrentCredentialForQr,
  hashRedemptionCode,
} from "/app/packages/backend/dist/index.js";

const TENANT_ID = "a1111111-1111-4111-8111-111111111111";
const EVENT_ID = "b2222222-2222-4222-8222-222222222222";
const ISSUER = "https://auth.vemoki.com/realms/ticket";
const ATTENDEE_EMAIL = "uat-g-attendee@vemoki.com";
const STAFF_EMAIL = "uat-g-staff@vemoki.com";
const CODES = ["UAT-DEVICE-G01", "UAT-DEVICE-G02", "UAT-DEVICE-G03", "UAT-DEVICE-G04"];
const SECRETS_DIR = process.env.UAT_G_SECRETS_DIR ?? "/secrets/uat-g";

const attendeeSub = process.env.ATTENDEE_SUB;
const staffSub = process.env.STAFF_SUB;
if (!attendeeSub || !staffSub) {
  console.error("missing ATTENDEE_SUB or STAFF_SUB");
  process.exit(1);
}

const db = createDatabase(process.env.DATABASE_URL, 2);
const hmac = readCodeHmacEnvironment(process.env);
const credKey = readCredentialKeyEnvironment(process.env);
const users = createPrismaIdentityUserRepository(db);

const attendee = await users.upsertFromVerifiedIdentity({
  issuer: ISSUER,
  subject: attendeeSub,
  email: ATTENDEE_EMAIL,
  emailVerified: true,
});
const staff = await users.upsertFromVerifiedIdentity({
  issuer: ISSUER,
  subject: staffSub,
  email: STAFF_EMAIL,
  emailVerified: true,
});
const attendeeUserId = attendee.userId ?? attendee.id;
const staffUserId = staff.userId ?? staff.id;

await withTenant(db, TENANT_ID, async (tx) => {
  const e = await tx.event.findUnique({
    where: { tenantId_id: { tenantId: TENANT_ID, id: EVENT_ID } },
    select: { status: true },
  });
  if (!e) throw new Error("event missing");
  if (e.status !== "PUBLISHED") {
    await tx.event.update({
      where: { tenantId_id: { tenantId: TENANT_ID, id: EVENT_ID } },
      data: { status: "PUBLISHED" },
    });
  }
});

const missingCodes = [];
for (const raw of CODES) {
  const codeHmac = hashRedemptionCode(hmac, raw);
  const found = await withTenant(db, TENANT_ID, async (tx) =>
    tx.redemptionCode.findFirst({
      where: { tenantId: TENANT_ID, eventId: EVENT_ID, codeHmac },
      select: { id: true },
    }),
  );
  if (!found) missingCodes.push(raw);
}
if (missingCodes.length > 0) {
  await withTenant(db, TENANT_ID, async (tx) => {
    const totalCodes = await tx.redemptionCode.count({
      where: { tenantId: TENANT_ID, eventId: EVENT_ID },
    });
    const quotaRows = await tx.$queryRaw`
      SELECT capacity, allocated FROM quota_buckets
      WHERE tenant_id = ${TENANT_ID}::uuid AND event_id = ${EVENT_ID}::uuid AND scope = 'EVENT'
    `;
    const capacity = quotaRows[0]?.capacity;
    const allocated = quotaRows[0]?.allocated ?? 0;
    if (capacity != null && allocated + missingCodes.length > capacity) {
      throw new Error(
        `event quota capacity=${capacity} allocated=${allocated} need +${missingCodes.length}`,
      );
    }
    const existing = await tx.$queryRaw`
      SELECT ticket_type_id, source_id FROM source_ticket_types
      WHERE tenant_id = ${TENANT_ID}::uuid AND event_id = ${EVENT_ID}::uuid
      LIMIT 1
    `;
    if (existing[0]) {
      const { ticket_type_id: ticketTypeId, source_id: sourceId } = existing[0];
      for (const raw of missingCodes) {
        const id = randomUUID();
        const codeHmac = hashRedemptionCode(hmac, raw);
        await tx.$executeRaw`
          INSERT INTO redemption_codes (
            tenant_id, event_id, id, code_hmac, code_pepper_version,
            source_id, ticket_type_id, status, created_at, updated_at
          ) VALUES (
            ${TENANT_ID}::uuid, ${EVENT_ID}::uuid, ${id}::uuid,
            ${codeHmac}, ${hmac.version}, ${sourceId}::uuid, ${ticketTypeId}::uuid,
            'AVAILABLE', now(), now()
          )
        `;
      }
      console.log("inventory_codes_added", missingCodes.join(","), "total_was", totalCodes);
    } else {
      await seedEventInventory(tx, hmac, {
        tenantId: TENANT_ID,
        eventId: EVENT_ID,
        eventQuota: 20,
        rawCodes: missingCodes,
        ticketTypeLabel: "UAT General",
        sourceName: "UAT Source G",
      });
      console.log("inventory_seeded", missingCodes.join(","));
    }
  });
} else {
  console.log("inventory_exists");
}

const ticketIds = [];
for (const rawCode of CODES) {
  const codeHmac = hashRedemptionCode(hmac, rawCode);
  const owned = await withTenant(db, TENANT_ID, async (tx) =>
    tx.ticket.findFirst({
      where: {
        tenantId: TENANT_ID,
        eventId: EVENT_ID,
        ownerUserId: attendeeUserId,
        redemptionCode: { codeHmac },
      },
      select: { id: true, state: true },
    }),
  );
  if (owned?.state === "ACTIVE") {
    ticketIds.push({ code: rawCode, ticketId: owned.id });
    console.log("ticket_exists", rawCode, owned.id);
    continue;
  }
  const outcome = await withTenant(db, TENANT_ID, (tx) =>
    redeemAndIssueTicket(tx, hmac, credKey, {
      tenantId: TENANT_ID,
      eventId: EVENT_ID,
      actorUserId: attendeeUserId,
      emailVerified: true,
      rawCode,
      idempotencyKey: randomUUID(),
    }),
  );
  const issued = unwrapRedeemOutcome(outcome);
  ticketIds.push({ code: rawCode, ticketId: issued.ticketId });
  console.log("ticket_issued", rawCode, issued.ticketId);
}

await withTenant(db, TENANT_ID, async (tx) => {
  let membership = await tx.membership.findUnique({
    where: { tenantId_userId: { tenantId: TENANT_ID, userId: staffUserId } },
  });
  if (!membership) {
    const m = await grantMembership(tx, {
      tenantId: TENANT_ID,
      userId: staffUserId,
      role: "STAFF",
      permissions: ["gate.confirm", "gate.undo"],
    });
    membership = { id: m.membershipId };
    console.log("membership_granted", m.membershipId);
  } else if (membership.revokedAt) {
    await tx.membership.update({
      where: { id: membership.id },
      data: {
        revokedAt: null,
        activatedAt: new Date(),
        permissions: ["gate.confirm", "gate.undo"],
      },
    });
    console.log("membership_reactivated", membership.id);
  } else {
    await tx.membership.update({
      where: { id: membership.id },
      data: { permissions: ["gate.confirm", "gate.undo"] },
    });
    console.log("membership_ok", membership.id);
  }
  const membershipId = membership.id;
  const asg = await tx.eventAssignment.findFirst({
    where: { tenantId: TENANT_ID, eventId: EVENT_ID, membershipId },
  });
  if (!asg) {
    const a = await grantEventAssignment(tx, {
      tenantId: TENANT_ID,
      eventId: EVENT_ID,
      membershipId,
      permissions: ["gate.confirm", "gate.undo"],
    });
    console.log("assignment_granted", a.assignmentId);
  } else if (asg.revokedAt) {
    await tx.eventAssignment.update({
      where: { id: asg.id },
      data: { revokedAt: null, activatedAt: new Date(), permissions: ["gate.confirm", "gate.undo"] },
    });
    console.log("assignment_reactivated", asg.id);
  } else {
    console.log("assignment_ok", asg.id);
  }
});

await mkdir(SECRETS_DIR, { recursive: true, mode: 0o700 });

const ticketLines = [];
for (const { code, ticketId } of ticketIds) {
  const cred = await withTenant(db, TENANT_ID, async (tx) => {
    const tickets = await tx.$queryRaw`
      SELECT credential_version FROM tickets
      WHERE tenant_id = ${TENANT_ID}::uuid AND id = ${ticketId}::uuid
    `;
    const credVersion = tickets[0]?.credential_version;
    if (credVersion == null) throw new Error(`ticket missing ${ticketId}`);
    const creds = await tx.$queryRaw`
      SELECT version, token_hash, encrypted_token FROM ticket_credentials
      WHERE tenant_id = ${TENANT_ID}::uuid AND ticket_id = ${ticketId}::uuid
        AND version = ${credVersion}::integer AND status = 'ACTIVE'
      LIMIT 1
    `;
    const cred = creds[0];
    if (!cred) throw new Error(`no credential for ${ticketId}`);
    const { token } = openCurrentCredentialForQr({
      encryptedToken: cred.encrypted_token,
      credentialKeyMaterial: credKey,
      expectedTokenHash: cred.token_hash,
    });
    const png = await renderCredentialQrPng({
      ticketId,
      tenantId: TENANT_ID,
      eventId: EVENT_ID,
      credentialVersion: cred.version,
      token,
    });
    const suffix = code.replace("UAT-DEVICE-", "");
    const pngPath = `${SECRETS_DIR}/ticket-${suffix}-qr.png`;
    await writeFile(pngPath, png, { mode: 0o600 });
    return { pngPath };
  });
  ticketLines.push(`${code}=${ticketId}`);
  console.log("qr_written", cred.pngPath);
}

await writeFile(`${SECRETS_DIR}/tickets.txt`, `${ticketLines.join("\n")}\n`, { mode: 0o600 });

console.log(
  JSON.stringify({
    tenantId: TENANT_ID,
    eventId: EVENT_ID,
    attendeeUserId,
    staffUserId,
    attendeeSub,
    staffSub,
    tickets: ticketIds,
  }),
);
await db.$disconnect();
