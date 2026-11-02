'use strict';

// GATE-03 signed-QR credential matrix — layer D (real task-isolated PostgreSQL).
//
// Covers the handoff §10 D matrix against the real domain layer, no mock crypto/auth:
//   1. reserve JWS current version → hold; old version → CREDENTIAL_VERSION_STALE, no hold
//   2. confirm after reissue-between-hold (TOCTOU) → CREDENTIAL_VERSION_STALE, no check-in
//   3. manual proof bound to staffSessionId and current credential version
//   4. stale manual proof minted before reissue, used after → CREDENTIAL_VERSION_STALE
//   5. keyring rotation: two kids both verify; unknown kid denied (CREDENTIAL_SIGNATURE_INVALID)
//   6. every deny writes a `gate.reject` audit row and causes no hold/check-in mutation

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, randomUUID } = require('node:crypto');
const { startPostgres } = require('../../../tests/e2e/backend/pg-fixture.cjs');

process.env.GATE_MANUAL_CODE_PEPPER ||= 'gate03-d-test-pepper-with-32-bytes';

const backend = require('../dist');

const HMAC = backend.readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'gate03-d-test-hmac-pepper',
  CODE_HMAC_VERSION: '1',
});
const CREDENTIAL_KEY = 'gate03-d-test-credential-key';

function keyPair(kid) {
  const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return {
    kid,
    privateKeyPem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    publicKey: pair.publicKey,
  };
}

// Rotation keyring: K1 is the current signing kid, K2 a retained older kid.
// UNKNOWN is a valid key pair that is absent from the verification keyring.
const K1 = keyPair('gate03-d-k1');
const K2 = keyPair('gate03-d-k2');
const UNKNOWN = keyPair('gate03-d-unknown');
const VERIFY_KEYS = [
  { kid: K1.kid, alg: 'ES256', key: K1.publicKey },
  { kid: K2.kid, alg: 'ES256', key: K2.publicKey },
];

async function signQr({ tid, eid, tkt, ver }, kid = K1.kid, pem = K1.privateKeyPem) {
  return backend.signGateCredentialJws({
    claims: { tid, eid, tkt, ver },
    privateKeyPem: pem,
    kid,
  });
}

let boot;
async function pg() {
  if (!boot) boot = await startPostgres();
  return boot;
}
after(async () => {
  if (boot) {
    boot.stop();
    boot = undefined;
  }
});

async function scenario(t) {
  const { url } = await pg();
  const db = backend.createDatabase(url, 6);
  t.after(() => db.$disconnect());
  const users = backend.createPrismaIdentityUserRepository(db);

  const label = randomUUID().slice(0, 8);
  const staff = await users.upsertFromVerifiedIdentity({
    issuer: 'http://127.0.0.1:8080/realms/ticket',
    subject: `gate03-d-staff-${label}`,
    email: `gate03-d-staff-${label}@example.com`,
    emailVerified: true,
  });
  const staffB = await users.upsertFromVerifiedIdentity({
    issuer: 'http://127.0.0.1:8080/realms/ticket',
    subject: `gate03-d-staffb-${label}`,
    email: `gate03-d-staffb-${label}@example.com`,
    emailVerified: true,
  });
  const guest = await users.upsertFromVerifiedIdentity({
    issuer: 'http://127.0.0.1:8080/realms/ticket',
    subject: `gate03-d-guest-${label}`,
    email: `gate03-d-guest-${label}@example.com`,
    emailVerified: true,
  });

  const tenantId = randomUUID();
  const eventId = randomUUID();
  await backend.withTenant(db, tenantId, async (tx) => {
    await tx.tenant.create({
      data: { id: tenantId, slug: `gate03-d-${label}`, name: 'GATE-03 D' },
    });
    await tx.event.create({
      data: {
        tenantId,
        id: eventId,
        slug: `gate03-d-event-${label}`,
        name: 'GATE-03 D Event',
        status: 'PUBLISHED',
      },
    });
    await backend.seedEventInventory(tx, HMAC, {
      tenantId,
      eventId,
      eventQuota: 6,
      rawCodes: [
        'GATE03-D-1',
        'GATE03-D-2',
        'GATE03-D-3',
        'GATE03-D-4',
        'GATE03-D-5',
        'GATE03-D-6',
      ],
    });
    for (const userId of [staff.userId, staffB.userId]) {
      const membership = await backend.grantMembership(tx, {
        tenantId,
        userId,
        role: 'Supervisor',
        permissions: ['gate.confirm', 'gate.undo', 'ticket.revoke', 'ticket.reissue'],
      });
      await backend.grantEventAssignment(tx, {
        tenantId,
        eventId,
        membershipId: membership.membershipId,
        permissions: ['gate.confirm', 'gate.undo', 'ticket.revoke', 'ticket.reissue'],
      });
    }
  });

  const sessionA = await backend.withTenant(db, tenantId, (tx) =>
    backend.openStaffSession(tx, { tenantId, eventId, userId: staff.userId }),
  );
  const sessionB = await backend.withTenant(db, tenantId, (tx) =>
    backend.openStaffSession(tx, { tenantId, eventId, userId: staffB.userId }),
  );

  const manualPepper = backend.readGateManualCodePepper(process.env);

  async function issueTicket(code) {
    const issued = backend.unwrapRedeemOutcome(
      await backend.withTenant(db, tenantId, (tx) =>
        backend.redeemAndIssueTicket(tx, HMAC, CREDENTIAL_KEY, {
          tenantId,
          eventId,
          actorUserId: guest.userId,
          actorEmail: guest.email,
          emailVerified: true,
          rawCode: code,
          idempotencyKey: randomUUID(),
        }),
      ),
    );
    return issued.ticketId;
  }

  async function manualCodeFor(ticketId) {
    const rows = await backend.withTenant(db, tenantId, (tx) => tx.$queryRaw`
      SELECT manual_entry_code_sealed FROM tickets
      WHERE tenant_id = ${tenantId}::uuid AND id = ${ticketId}::uuid
    `);
    return backend.openManualEntryCode(rows[0].manual_entry_code_sealed, CREDENTIAL_KEY);
  }

  return {
    db,
    tenantId,
    eventId,
    staff,
    staffB,
    sessionA,
    sessionB,
    manualPepper,
    issueTicket,
    manualCodeFor,
  };
}

async function heldCount(db, tenantId, ticketId) {
  const rows = await backend.withTenant(db, tenantId, (tx) => tx.$queryRaw`
    SELECT count(*)::int AS n FROM checkin_reservations
    WHERE tenant_id = ${tenantId}::uuid AND ticket_id = ${ticketId}::uuid AND status = 'HELD'
  `);
  return rows[0].n;
}

async function checkinCount(db, tenantId, ticketId) {
  const rows = await backend.withTenant(db, tenantId, (tx) => tx.$queryRaw`
    SELECT count(*)::int AS n FROM checkins
    WHERE tenant_id = ${tenantId}::uuid AND ticket_id = ${ticketId}::uuid AND undone_at IS NULL
  `);
  return rows[0].n;
}

async function rejectCount(db, tenantId, eventId, code) {
  const rows = await backend.withTenant(db, tenantId, (tx) => tx.$queryRaw`
    SELECT count(*)::int AS n FROM audit_logs
    WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid
      AND action = 'gate.reject' AND reason = ${code}
  `);
  return rows[0].n;
}

async function ticketState(db, tenantId, ticketId) {
  const rows = await backend.withTenant(db, tenantId, (tx) => tx.$queryRaw`
    SELECT state FROM tickets WHERE tenant_id = ${tenantId}::uuid AND id = ${ticketId}::uuid
  `);
  return rows[0].state;
}

test(
  'gate03 signed-QR D: reserve current/old version + confirm reissue-between-hold TOCTOU',
  { timeout: 180000 },
  async (t) => {
    const { db, tenantId, eventId, staff, sessionA, issueTicket } = await scenario(t);

    // (1) current-version JWS holds normally (control).
    const tA = await issueTicket('GATE03-D-1');
    const jwsA1 = await signQr({ tid: tenantId, eid: eventId, tkt: tA, ver: 1 });
    const holdA = backend.unwrapReserveOutcome(
      await backend.withTenant(db, tenantId, (tx) =>
        backend.reserveCheckin(tx, {
          tenantId,
          eventId,
          staffSessionId: sessionA.sessionId,
          actorUserId: staff.userId,
          presented: { kind: 'qr', jws: jwsA1 },
          verifyKeys: VERIFY_KEYS,
        }),
      ),
    );
    assert.equal(await heldCount(db, tenantId, tA), 1);

    // (2) reissue between hold (TOCTOU) → confirm denied, no check-in.
    const rotated = await backend.withTenant(db, tenantId, (tx) =>
      backend.reissueTicketCredential(tx, CREDENTIAL_KEY, {
        tenantId,
        eventId,
        ticketId: tA,
        actorUserId: staff.userId,
        reason: 'reissue between hold',
        idempotencyKey: randomUUID(),
      }),
    );
    assert.equal(rotated.credentialVersion, 2);

    const rejectBefore = await rejectCount(db, tenantId, eventId, 'CREDENTIAL_VERSION_STALE');
    const staleConfirm = await backend.withTenant(db, tenantId, (tx) =>
      backend.confirmCheckin(tx, {
        tenantId,
        eventId,
        reservationId: holdA.reservationId,
        token: holdA.token,
        staffSessionId: sessionA.sessionId,
        actorUserId: staff.userId,
      }),
    );
    assert.equal(staleConfirm.ok, false);
    assert.equal(staleConfirm.code, backend.GATE_ERROR_CODES.CREDENTIAL_VERSION_STALE);
    assert.equal(await checkinCount(db, tenantId, tA), 0, 'TOCTOU confirm must not check in');
    assert.equal(await ticketState(db, tenantId, tA), 'ACTIVE', 'ticket must stay ACTIVE');
    assert.equal(
      await rejectCount(db, tenantId, eventId, 'CREDENTIAL_VERSION_STALE'),
      rejectBefore + 1,
      'stale confirm must be audited',
    );

    // (3) old-version JWS → CREDENTIAL_VERSION_STALE, no new hold.
    const heldBefore = await heldCount(db, tenantId, tA);
    const staleReserve = await backend.withTenant(db, tenantId, (tx) =>
      backend.reserveCheckin(tx, {
        tenantId,
        eventId,
        staffSessionId: sessionA.sessionId,
        actorUserId: staff.userId,
        presented: { kind: 'qr', jws: jwsA1 },
        verifyKeys: VERIFY_KEYS,
      }),
    );
    assert.equal(staleReserve.ok, false);
    assert.equal(staleReserve.code, backend.GATE_ERROR_CODES.CREDENTIAL_VERSION_STALE);
    assert.equal(await heldCount(db, tenantId, tA), heldBefore, 'stale reserve must not hold');

    // (4) fresh ticket: current-version (v2) JWS still holds after rotation.
    const tB = await issueTicket('GATE03-D-2');
    await backend.withTenant(db, tenantId, (tx) =>
      backend.reissueTicketCredential(tx, CREDENTIAL_KEY, {
        tenantId,
        eventId,
        ticketId: tB,
        actorUserId: staff.userId,
        reason: 'rotate to v2',
        idempotencyKey: randomUUID(),
      }),
    );
    const jwsB2 = await signQr({ tid: tenantId, eid: eventId, tkt: tB, ver: 2 });
    backend.unwrapReserveOutcome(
      await backend.withTenant(db, tenantId, (tx) =>
        backend.reserveCheckin(tx, {
          tenantId,
          eventId,
          staffSessionId: sessionA.sessionId,
          actorUserId: staff.userId,
          presented: { kind: 'qr', jws: jwsB2 },
          verifyKeys: VERIFY_KEYS,
        }),
      ),
    );
    assert.equal(await heldCount(db, tenantId, tB), 1);
  },
);

test(
  'gate03 signed-QR D: manual proof bound to staffSessionId and current version',
  { timeout: 180000 },
  async (t) => {
    const {
      db,
      tenantId,
      eventId,
      staff,
      staffB,
      sessionA,
      sessionB,
      manualPepper,
      issueTicket,
      manualCodeFor,
    } = await scenario(t);

    const ticketId = await issueTicket('GATE03-D-3');
    const manualCode = await manualCodeFor(ticketId);

    // lookup mints a proof bound to sessionA and the current version (1).
    const lookup = backend.unwrapManualLookupOutcome(
      await backend.withTenant(db, tenantId, (tx) =>
        backend.manualLookupTicket(tx, {
          tenantId,
          eventId,
          staffSessionId: sessionA.sessionId,
          actorUserId: staff.userId,
          code: manualCode,
          verifyKeys: VERIFY_KEYS,
          signingKeyId: K1.kid,
          signingPrivateKeyPem: K1.privateKeyPem,
          manualCodePepper: manualPepper,
        }),
      ),
    );
    const proofClaims = await backend.verifyManualProofToken(
      lookup.proofToken,
      VERIFY_KEYS,
      sessionA.sessionId,
    );
    assert.equal(proofClaims.sid, sessionA.sessionId, 'proof must bind staffSessionId');
    assert.equal(proofClaims.ver, 1, 'proof must bind the current credential version');

    // correct session → hold.
    backend.unwrapReserveOutcome(
      await backend.withTenant(db, tenantId, (tx) =>
        backend.reserveCheckin(tx, {
          tenantId,
          eventId,
          staffSessionId: sessionA.sessionId,
          actorUserId: staff.userId,
          presented: { kind: 'manual', proofToken: lookup.proofToken },
          verifyKeys: VERIFY_KEYS,
        }),
      ),
    );
    assert.equal(await heldCount(db, tenantId, ticketId), 1);

    // different session reusing the same proof → MANUAL_PROOF_INVALID, no new hold.
    const heldBefore = await heldCount(db, tenantId, ticketId);
    const rejectBefore = await rejectCount(db, tenantId, eventId, 'MANUAL_PROOF_INVALID');
    const otherSession = await backend.withTenant(db, tenantId, (tx) =>
      backend.reserveCheckin(tx, {
        tenantId,
        eventId,
        staffSessionId: sessionB.sessionId,
        actorUserId: staffB.userId,
        presented: { kind: 'manual', proofToken: lookup.proofToken },
        verifyKeys: VERIFY_KEYS,
      }),
    );
    assert.equal(otherSession.ok, false);
    assert.equal(otherSession.code, backend.GATE_ERROR_CODES.MANUAL_PROOF_INVALID);
    assert.equal(await heldCount(db, tenantId, ticketId), heldBefore, 'cross-session proof must not hold');
    assert.equal(
      await rejectCount(db, tenantId, eventId, 'MANUAL_PROOF_INVALID'),
      rejectBefore + 1,
      'cross-session deny must be audited',
    );
  },
);

test(
  'gate03 signed-QR D: stale manual proof minted before reissue, used after',
  { timeout: 180000 },
  async (t) => {
    const { db, tenantId, eventId, staff, sessionA, manualPepper, issueTicket, manualCodeFor } =
      await scenario(t);

    const ticketId = await issueTicket('GATE03-D-4');
    const manualCode = await manualCodeFor(ticketId);

    // mint proof BEFORE reissue (ver = 1).
    const lookup = backend.unwrapManualLookupOutcome(
      await backend.withTenant(db, tenantId, (tx) =>
        backend.manualLookupTicket(tx, {
          tenantId,
          eventId,
          staffSessionId: sessionA.sessionId,
          actorUserId: staff.userId,
          code: manualCode,
          verifyKeys: VERIFY_KEYS,
          signingKeyId: K1.kid,
          signingPrivateKeyPem: K1.privateKeyPem,
          manualCodePepper: manualPepper,
        }),
      ),
    );
    assert.equal(
      (await backend.verifyManualProofToken(lookup.proofToken, VERIFY_KEYS, sessionA.sessionId)).ver,
      1,
    );

    // reissue → ver 2.
    const rotated = await backend.withTenant(db, tenantId, (tx) =>
      backend.reissueTicketCredential(tx, CREDENTIAL_KEY, {
        tenantId,
        eventId,
        ticketId,
        actorUserId: staff.userId,
        reason: 'reissue invalidates manual proof',
        idempotencyKey: randomUUID(),
      }),
    );
    assert.equal(rotated.credentialVersion, 2);

    // stale proof (ver 1) used after reissue → STALE, no hold, audited.
    const heldBefore = await heldCount(db, tenantId, ticketId);
    const rejectBefore = await rejectCount(db, tenantId, eventId, 'CREDENTIAL_VERSION_STALE');
    const stale = await backend.withTenant(db, tenantId, (tx) =>
      backend.reserveCheckin(tx, {
        tenantId,
        eventId,
        staffSessionId: sessionA.sessionId,
        actorUserId: staff.userId,
        presented: { kind: 'manual', proofToken: lookup.proofToken },
        verifyKeys: VERIFY_KEYS,
      }),
    );
    assert.equal(stale.ok, false);
    assert.equal(stale.code, backend.GATE_ERROR_CODES.CREDENTIAL_VERSION_STALE);
    assert.equal(await heldCount(db, tenantId, ticketId), heldBefore, 'stale proof must not hold');
    assert.equal(
      await rejectCount(db, tenantId, eventId, 'CREDENTIAL_VERSION_STALE'),
      rejectBefore + 1,
      'stale proof must be audited',
    );
  },
);

test(
  'gate03 signed-QR D: keyring rotation — two kids verify, unknown kid denied',
  { timeout: 180000 },
  async (t) => {
    const { db, tenantId, eventId, staff, sessionA, issueTicket } = await scenario(t);

    // kid K1 signs ticket A → holds.
    const tA = await issueTicket('GATE03-D-5');
    const jwsK1 = await signQr({ tid: tenantId, eid: eventId, tkt: tA, ver: 1 }, K1.kid, K1.privateKeyPem);
    backend.unwrapReserveOutcome(
      await backend.withTenant(db, tenantId, (tx) =>
        backend.reserveCheckin(tx, {
          tenantId,
          eventId,
          staffSessionId: sessionA.sessionId,
          actorUserId: staff.userId,
          presented: { kind: 'qr', jws: jwsK1 },
          verifyKeys: VERIFY_KEYS,
        }),
      ),
    );
    assert.equal(await heldCount(db, tenantId, tA), 1, 'current kid must verify and hold');

    // retained kid K2 signs ticket B → holds (rotation keeps old public key).
    const tB = await issueTicket('GATE03-D-6');
    const jwsK2 = await signQr({ tid: tenantId, eid: eventId, tkt: tB, ver: 1 }, K2.kid, K2.privateKeyPem);
    backend.unwrapReserveOutcome(
      await backend.withTenant(db, tenantId, (tx) =>
        backend.reserveCheckin(tx, {
          tenantId,
          eventId,
          staffSessionId: sessionA.sessionId,
          actorUserId: staff.userId,
          presented: { kind: 'qr', jws: jwsK2 },
          verifyKeys: VERIFY_KEYS,
        }),
      ),
    );
    assert.equal(await heldCount(db, tenantId, tB), 1, 'retained kid must verify and hold');

    // unknown kid → CREDENTIAL_SIGNATURE_INVALID, no hold, audited.
    const rejectBefore = await rejectCount(db, tenantId, eventId, 'CREDENTIAL_SIGNATURE_INVALID');
    const heldBefore = await heldCount(db, tenantId, tB);
    const jwsUnknown = await signQr(
      { tid: tenantId, eid: eventId, tkt: tB, ver: 1 },
      UNKNOWN.kid,
      UNKNOWN.privateKeyPem,
    );
    const unknownOutcome = await backend.withTenant(db, tenantId, (tx) =>
      backend.reserveCheckin(tx, {
        tenantId,
        eventId,
        staffSessionId: sessionA.sessionId,
        actorUserId: staff.userId,
        presented: { kind: 'qr', jws: jwsUnknown },
        verifyKeys: VERIFY_KEYS,
      }),
    );
    assert.equal(unknownOutcome.ok, false);
    assert.equal(unknownOutcome.code, backend.GATE_ERROR_CODES.CREDENTIAL_SIGNATURE_INVALID);
    assert.equal(await heldCount(db, tenantId, tB), heldBefore, 'unknown kid must not hold');
    assert.equal(
      await rejectCount(db, tenantId, eventId, 'CREDENTIAL_SIGNATURE_INVALID'),
      rejectBefore + 1,
      'unknown kid deny must be audited',
    );
  },
);
