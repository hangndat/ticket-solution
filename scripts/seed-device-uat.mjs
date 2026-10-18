import { randomUUID } from "node:crypto";
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
} from "/app/packages/backend/dist/index.js";

const TENANT_ID = "a1111111-1111-4111-8111-111111111111";
const EVENT_ID = "b2222222-2222-4222-8222-222222222222";
const CODE = "UAT-DEVICE-01";
const ISSUER = "https://auth.vemoki.com/realms/ticket";
const ATTENDEE_SUB = "78f7d158-ba70-4ffd-a50f-b6b28f14f9c6";
const STAFF_SUB = "d206e999-2de7-4b6d-9aaa-09099c9f25ff";

const db = createDatabase(process.env.DATABASE_URL, 2);
const hmac = readCodeHmacEnvironment(process.env);
const credKey = readCredentialKeyEnvironment(process.env);
const users = createPrismaIdentityUserRepository(db);

const attendee = await users.upsertFromVerifiedIdentity({
  issuer: ISSUER,
  subject: ATTENDEE_SUB,
  email: "attendee@example.com",
  emailVerified: true,
});
const staff = await users.upsertFromVerifiedIdentity({
  issuer: ISSUER,
  subject: STAFF_SUB,
  email: "staff@example.com",
  emailVerified: true,
});
const attendeeUserId = attendee.userId ?? attendee.id;
const staffUserId = staff.userId ?? staff.id;

await withTenant(db, TENANT_ID, async (tx) => {
  const t = await tx.tenant.findUnique({ where: { id: TENANT_ID } });
  if (!t) {
    await tx.tenant.create({
      data: { id: TENANT_ID, slug: "uat-device", name: "UAT Device Tenant" },
    });
  }
  const e = await tx.event.findUnique({
    where: { tenantId_id: { tenantId: TENANT_ID, id: EVENT_ID } },
  });
  if (!e) {
    await tx.event.create({
      data: {
        tenantId: TENANT_ID,
        id: EVENT_ID,
        slug: "device-uat",
        name: "Device UAT Event",
        status: "PUBLISHED",
      },
    });
  } else if (e.status !== "PUBLISHED") {
    await tx.event.update({
      where: { tenantId_id: { tenantId: TENANT_ID, id: EVENT_ID } },
      data: { status: "PUBLISHED" },
    });
  }
});

const existingCodes = await withTenant(db, TENANT_ID, async (tx) =>
  tx.redemptionCode.count({ where: { tenantId: TENANT_ID, eventId: EVENT_ID } }),
);
if (existingCodes === 0) {
  await withTenant(db, TENANT_ID, async (tx) => {
    await seedEventInventory(tx, hmac, {
      tenantId: TENANT_ID,
      eventId: EVENT_ID,
      eventQuota: 20,
      rawCodes: [CODE, "UAT-DEVICE-02", "UAT-DEVICE-03"],
      ticketTypeLabel: "UAT General",
      sourceName: "UAT Source",
    });
  });
  console.log("inventory_seeded");
} else {
  console.log("inventory_exists", existingCodes);
}

const owned = await withTenant(db, TENANT_ID, async (tx) =>
  tx.ticket.findMany({
    where: { tenantId: TENANT_ID, ownerUserId: attendeeUserId },
    select: { id: true },
  }),
);

let ticketId = owned[0]?.id ?? null;
if (!ticketId) {
  const outcome = await withTenant(db, TENANT_ID, (tx) =>
    redeemAndIssueTicket(tx, hmac, credKey, {
      tenantId: TENANT_ID,
      eventId: EVENT_ID,
      actorUserId: attendeeUserId,
      emailVerified: true,
      rawCode: CODE,
      idempotencyKey: randomUUID(),
    }),
  );
  const issued = unwrapRedeemOutcome(outcome);
  ticketId = issued.ticketId;
  console.log("ticket_issued", ticketId);
} else {
  console.log("ticket_exists", ticketId);
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
    console.log("membership_exists", membership.id);
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
    console.log("assignment_exists", asg.id);
  }
});

console.log(
  JSON.stringify({
    tenantId: TENANT_ID,
    eventId: EVENT_ID,
    ticketId,
    attendeeUserId,
    staffUserId,
    deepLinkTicket: `ticketsolution://tickets/${ticketId}`,
    deepLinkEvent: `ticketsolution://events/${EVENT_ID}`,
  }),
);
await db.$disconnect();
