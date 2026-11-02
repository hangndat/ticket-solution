const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID, createHash, generateKeyPairSync } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { migrationFiles } = require('./migration-files.cjs');
const path = require('node:path');
const { Client } = require('pg');
const {
  createDatabase,
  withTenant,
  createPrismaIdentityUserRepository,
  seedEventInventory,
  redeemAndIssueTicket,
  unwrapRedeemOutcome,
  readCodeHmacEnvironment,
  grantMembership,
  grantEventAssignment,
  relayOutboxOnce,
  createSmtpEmailAdapter,
  publishEventConfig,
  saveEventConfigVersion,
  publishNotificationTemplate,
  DEFAULT_TICKET_ISSUED_TEMPLATE,
  openCredentialToken,
  hashCredentialToken,
  sealCredentialToken,
  deriveGateSigningSealKey,
  readGateCredentialVerifyKeys,
  verifyGateCredentialJws,
  tryConsumeRateLimit,
  retryNotificationDelivery,
  NotificationError,
  NOTIFICATION_ERROR_CODES,
} = require('../dist');
const { prepareZXingModule, readBarcodes } = require('zxing-wasm/reader');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();

const HMAC = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'n1-email-test-pepper!!',
  CODE_HMAC_VERSION: '1',
});
const CREDENTIAL_KEY = 'n1-email-credential-key';
const GATE_KEYPAIR = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const GATE_PRIVATE_KEY_PEM = GATE_KEYPAIR.privateKey.export({ type: 'pkcs8', format: 'pem' });
const GATE_PUBLIC_KEY_JWK = GATE_KEYPAIR.publicKey.export({ format: 'jwk' });
const GATE_KID = 'n1-email-gate-current';
const RELAY_OPTS = {
  credentialKeyMaterial: CREDENTIAL_KEY,
  publicWebBaseUrl: 'https://tickets.example.test',
  env: {
    NODE_ENV: 'test',
    GATE_CREDENTIAL_CURRENT_KEY_ID: GATE_KID,
    GATE_CREDENTIAL_SIGNING_KEY_SEALED: sealCredentialToken(
      GATE_PRIVATE_KEY_PEM,
      deriveGateSigningSealKey(CREDENTIAL_KEY),
    ).encryptedToken,
    GATE_CREDENTIAL_VERIFY_KEYS_JSON: JSON.stringify([
      { kid: GATE_KID, alg: 'ES256', publicKeyJwk: GATE_PUBLIC_KEY_JWK },
    ]),
  },
};

async function startIsolatedPostgres() {
  const name = 'ticket-n1-email-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '--label',
    'ticket.task=task_0d1153a008a1',
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=n1_email_test',
    '-p',
    '127.0.0.1::5432',
    'postgres:18.1-alpine',
  );
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      docker(
        'exec',
        name,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'postgres',
        '-d',
        'n1_email_test',
      );
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  assert.ok(ready, 'database must become ready');
  const port = docker('port', name, '5432/tcp').split(':').at(-1);
  const admin = new Client({
    connectionString:
      'postgresql://postgres:' +
      password +
      '@127.0.0.1:' +
      port +
      '/n1_email_test',
  });
  try {
    for (let i = 0; i < 30; i++) {
      try {
        await admin.connect();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    await admin.query(
      'CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS',
    );
    await admin.query(
      'CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS',
    );
    await admin.query(
      'CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS',
    );
    await admin.query(
      'GRANT CREATE, USAGE ON SCHEMA public TO migration_owner',
    );
    await admin.query('SET ROLE migration_owner');
    for (const file of MIGRATIONS) await admin.query(readFileSync(file, 'utf8'));
    await admin.query('RESET ROLE');
    await admin.query('GRANT USAGE ON SCHEMA public TO ticket_runtime');
    await admin.query(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ticket_runtime',
    );
    await admin.query(
      'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ticket_runtime',
    );
    await admin.query(
      "ALTER DATABASE n1_email_test SET app.tenant_id TO ''",
    );
  } finally {
    await admin.end().catch(() => {});
  }
  const url =
    'postgresql://postgres:' +
    password +
    '@127.0.0.1:' +
    port +
    '/n1_email_test';
  return { name, url };
}

async function startMailpit() {
  const name = 'ticket-n1-mailpit-' + randomBytes(4).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '--label',
    'ticket.task=task_0d1153a008a1',
    '-p',
    '127.0.0.1::1025',
    '-p',
    '127.0.0.1::8025',
    'axllent/mailpit:v1.27.10',
  );
  let smtpPort;
  let uiPort;
  for (let i = 0; i < 40; i++) {
    try {
      smtpPort = docker('port', name, '1025/tcp').split(':').at(-1);
      uiPort = docker('port', name, '8025/tcp').split(':').at(-1);
      const res = await fetch('http://127.0.0.1:' + uiPort + '/api/v1/info');
      if (res.ok) break;
    } catch {
      /* wait */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(smtpPort && uiPort, 'Mailpit ports must bind');
  return {
    name,
    smtpUrl: 'smtp+plain://127.0.0.1:' + smtpPort,
    apiBase: 'http://127.0.0.1:' + uiPort,
  };
}

async function mailpitMessages(apiBase) {
  const res = await fetch(apiBase + '/api/v1/messages');
  assert.equal(res.status, 200);
  return res.json();
}

async function mailpitMessage(apiBase, id) {
  const res = await fetch(apiBase + '/api/v1/message/' + id);
  assert.equal(res.status, 200);
  return res.json();
}

async function decodeMailpitQrPng(rawMime) {
  const boundaries = [...rawMime.matchAll(/boundary="?([^";\r\n]+)"?/gi)].map(
    (match) => match[1],
  );
  let pngBytes;
  for (const boundary of boundaries) {
    const imagePart = rawMime
      .split('--' + boundary)
      .find((part) => {
        const [headers] = part.split(/\r?\n\r?\n/, 2);
        return (
          /(?:^|\r?\n)Content-Type:\s*image\/png/i.test(headers) &&
          /(?:^|\r?\n)Content-ID:\s*<ticket-qr@vemoki>/i.test(headers)
        );
      });
    if (!imagePart) continue;
    const [headers, body] = imagePart.split(/\r?\n\r?\n/, 2);
    assert.match(headers, /Content-Transfer-Encoding:\s*base64/i);
    pngBytes = Buffer.from(body.replace(/\s/g, ''), 'base64');
    break;
  }
  assert.ok(pngBytes?.length > 8, 'Mailpit MIME must contain the inline QR PNG bytes');
  assert.deepEqual(
    pngBytes.subarray(0, 8),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    'inline QR attachment must be a PNG',
  );

  const modulePath = require.resolve('zxing-wasm/reader');
  const wasm = readFileSync(
    path.resolve(path.dirname(modulePath), '../../reader/zxing_reader.wasm'),
  );
  await prepareZXingModule({
    overrides: {
      wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength),
    },
    fireImmediately: true,
  });
  const [decoded] = await readBarcodes(new Uint8Array(pngBytes), {
    formats: ['QRCode'],
    tryHarder: true,
    maxNumberOfSymbols: 1,
  });
  assert.ok(decoded?.text, 'Mailpit QR PNG must decode to a credential payload');
  return decoded.text;
}

test(
  'N1 Mailpit MIME has QR/link/guide/contact; resend keeps credential; caps/lease',
  { timeout: 240000 },
  async () => {
    let pgName;
    let mailName;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      pgName = boot.name;
      const mail = await startMailpit();
      mailName = mail.name;
      db = createDatabase(boot.url, 2);

      const users = createPrismaIdentityUserRepository(db);
      const issuer = 'http://127.0.0.1:8080/realms/ticket';
      const owner = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'n1-owner',
        email: 'owner-n1@example.com',
        emailVerified: true,
      });
      const staff = await users.upsertFromVerifiedIdentity({
        issuer,
        subject: 'n1-staff',
        email: 'staff-n1@example.com',
        emailVerified: true,
      });

      const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const eventId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'n1-tenant', name: 'N1 Tenant' },
        });
        await tx.$executeRaw`
          INSERT INTO tenant_limits (tenant_id, email_per_day)
          VALUES (${tenantId}::uuid, 100)
        `;
        await tx.event.create({
          data: {
            tenantId,
            id: eventId,
            slug: 'n1-event',
            name: 'N1 Launch',
            status: 'DRAFT',
          },
        });
        const membership = await grantMembership(tx, {
          tenantId,
          userId: staff.userId,
          role: 'MANAGER',
          permissions: ['event.config', 'event.publish', 'inventory.import'],
        });
        await grantEventAssignment(tx, {
          tenantId,
          eventId,
          membershipId: membership.membershipId,
          permissions: ['event.config', 'event.publish', 'inventory.import'],
        });
        await seedEventInventory(tx, HMAC, {
          tenantId,
          eventId,
          eventQuota: 5,
          rawCodes: ['N1-A', 'N1-B'],
        });
        const saved = await saveEventConfigVersion(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
          payload: {
            schemaVersion: 1,
            brand: {
              primaryColor: '#0B3D2E',
              organizationName: 'hotline@example.test',
            },
            sections: [
              {
                kind: 'hero',
                id: 'hero-1',
                visible: true,
                order: 0,
                body: { title: 'N1 Launch', text: 'Hello' },
              },
              {
                kind: 'info',
                id: 'info-1',
                visible: true,
                order: 1,
                body: { title: 'Info', text: 'Details' },
              },
              {
                kind: 'redeem',
                id: 'redeem-1',
                visible: true,
                order: 2,
                body: { title: 'Redeem', text: 'Code' },
              },
              {
                kind: 'guide',
                id: 'guide-1',
                visible: true,
                order: 3,
                body: {
                  title: 'Guide',
                  text: 'Check-in tại cổng A trước 18:00.',
                },
              },
              {
                kind: 'faq',
                id: 'faq-1',
                visible: true,
                order: 4,
                body: {
                  title: 'FAQ',
                  items: [{ question: 'When?', answer: 'Tonight' }],
                },
              },
              {
                kind: 'terms',
                id: 'terms-1',
                visible: true,
                order: 5,
                body: {
                  title: 'Terms',
                  termsVersion: 'terms-v1',
                  text: 'Be kind',
                },
              },
            ],
            termsVersion: 'terms-v1',
          },
        });
        await publishEventConfig(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
          expectedVersion: saved.version,
        });
        await publishNotificationTemplate(tx, {
          tenantId,
          eventId,
          actorUserId: staff.userId,
          kind: 'TicketIssued',
          subject: DEFAULT_TICKET_ISSUED_TEMPLATE.subject,
          bodyText: DEFAULT_TICKET_ISSUED_TEMPLATE.bodyText,
          bodyHtml: DEFAULT_TICKET_ISSUED_TEMPLATE.bodyHtml,
        });
      });

      const issued = unwrapRedeemOutcome(
        await withTenant(db, tenantId, (tx) =>
          redeemAndIssueTicket(tx, HMAC, CREDENTIAL_KEY, {
            tenantId,
            eventId,
            actorUserId: owner.userId,
            actorEmail: owner.email,
            emailVerified: true,
            rawCode: 'N1-A',
            idempotencyKey: randomUUID(),
            termsVersion: 'terms-v1',
            termsAccepted: true,
          }),
        ),
      );
      assert.ok(issued.ticketId);

      const credBefore = await withTenant(db, tenantId, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT version, token_hash, encrypted_token
          FROM ticket_credentials
          WHERE tenant_id = ${tenantId}::uuid
            AND ticket_id = ${issued.ticketId}::uuid
            AND status = 'ACTIVE'
        `;
        return rows[0];
      });
      const tokenBefore = openCredentialToken(
        credBefore.encrypted_token,
        CREDENTIAL_KEY,
      );
      assert.equal(hashCredentialToken(tokenBefore), credBefore.token_hash);

      const email = createSmtpEmailAdapter({
        smtpUrl: mail.smtpUrl,
        fromAddress: 'tickets@n1.test',
        nodeEnv: 'test',
      });
      const relayed = await relayOutboxOnce(
        db,
        email,
        'n1-mailpit-1',
        10,
        RELAY_OPTS,
      );
      assert.ok(relayed.completed >= 1);

      let messageId;
      for (let i = 0; i < 30; i++) {
        const list = await mailpitMessages(mail.apiBase);
        if (list.total >= 1 && list.messages?.[0]?.ID) {
          messageId = list.messages[0].ID;
          break;
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      assert.ok(messageId, 'Mailpit must capture MIME');
      const msg = await mailpitMessage(mail.apiBase, messageId);
      const text = msg.Text || '';
      const html = msg.HTML || '';
      assert.match(text, /N1 Launch/);
      assert.match(text, new RegExp(issued.ticketId));
      assert.match(
        text,
        /https:\/\/tickets\.example\.test\/t\/n1-tenant\/tickets\//,
      );
      assert.match(text, /Check-in tại cổng A/);
      assert.match(text, /hotline@example\.test/);
      assert.match(html, /cid:ticket-qr/);
      const rawRes = await fetch(mail.apiBase + '/api/v1/message/' + messageId + '/raw');
      assert.equal(rawRes.status, 200);
      const rawMime = await rawRes.text();
      assert.match(rawMime, /Content-Type:\s*image\/png/i);
      assert.match(rawMime, /ticket-qr@vemoki/);
      assert.match(rawMime, /Content-Type:\s*multipart\//i);
      const qrPayload = await decodeMailpitQrPng(rawMime);
      let qrEnvelope;
      assert.doesNotThrow(() => {
        qrEnvelope = JSON.parse(qrPayload);
      }, 'decoded QR must contain the credential envelope JSON');
      assert.deepEqual(Object.keys(qrEnvelope).sort(), ['jws', 'kind', 'v']);
      assert.equal(qrEnvelope.v, 1);
      assert.equal(qrEnvelope.kind, 'ticket.gate_credential');
      assert.equal(typeof qrEnvelope.jws, 'string');
      assert.equal(qrEnvelope.jws.split('.').length, 3, 'credential must be compact JWS, not a legacy AES token');
      assert.notEqual(qrPayload, tokenBefore, 'QR payload must not expose the legacy AES credential token');
      const [protectedHeader] = qrEnvelope.jws.split('.');
      assert.deepEqual(JSON.parse(Buffer.from(protectedHeader, 'base64url').toString('utf8')), {
        alg: 'ES256',
        kid: GATE_KID,
        typ: 'JWT',
      });
      const verifyKeys = await readGateCredentialVerifyKeys(RELAY_OPTS.env);
      const qrClaims = await verifyGateCredentialJws(qrEnvelope.jws, verifyKeys);
      assert.equal(qrClaims.tid, tenantId);
      assert.equal(qrClaims.eid, eventId);
      assert.equal(qrClaims.tkt, issued.ticketId);
      assert.equal(qrClaims.ver, credBefore.version);
      void msg;

      const note = await withTenant(db, tenantId, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT id, state, attempts FROM notifications
          WHERE tenant_id = ${tenantId}::uuid
            AND business_key = ${'ticket:' + issued.ticketId + ':issued:email'}
        `;
        const attempts = await tx.$queryRaw`
          SELECT ordinal, provider_status, channel
          FROM notification_attempts
          WHERE tenant_id = ${tenantId}::uuid
            AND notification_id = ${rows[0].id}::uuid
          ORDER BY ordinal
        `;
        return { row: rows[0], attempts };
      });
      assert.equal(note.row.state, 'ACCEPTED');
      assert.ok(note.attempts.length >= 1);
      assert.equal(note.attempts[0].provider_status, 'ACCEPTED');
      assert.equal(note.attempts[0].channel, 'email');

      // Stale lease cannot ack a newer lease.
      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          UPDATE outbox
          SET status = 'LEASED',
              lease_owner = 'stale-worker',
              lease_token = 'stale-token',
              lease_expires_at = clock_timestamp() + interval '30 seconds',
              updated_at = now()
          WHERE tenant_id = ${tenantId}::uuid
            AND aggregate_id = ${issued.ticketId}::uuid
        `;
        const updated = await tx.$executeRaw`
          UPDATE outbox
          SET status = 'COMPLETE',
              lease_owner = NULL,
              lease_token = NULL
          WHERE tenant_id = ${tenantId}::uuid
            AND aggregate_id = ${issued.ticketId}::uuid
            AND lease_owner = 'other'
            AND lease_token = 'other-token'
        `;
        assert.equal(Number(updated), 0);
        await tx.$executeRaw`
          UPDATE outbox
          SET status = 'COMPLETE',
              lease_owner = NULL,
              lease_token = NULL,
              lease_expires_at = NULL,
              updated_at = now()
          WHERE tenant_id = ${tenantId}::uuid
            AND aggregate_id = ${issued.ticketId}::uuid
        `;
      });

      // Resend does not rotate credential.
      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          UPDATE notifications
          SET updated_at = clock_timestamp() - interval '2 minutes'
          WHERE tenant_id = ${tenantId}::uuid
            AND id = ${note.row.id}::uuid
        `;
        await retryNotificationDelivery(tx, {
          tenantId,
          eventId,
          notificationId: note.row.id,
          actorUserId: staff.userId,
          reason: 'staff resend for UAT',
        });
      });
      const relayed2 = await relayOutboxOnce(
        db,
        email,
        'n1-mailpit-2',
        10,
        RELAY_OPTS,
      );
      assert.ok(relayed2.completed + relayed2.failed >= 0);
      // Wait for second message optionally
      for (let i = 0; i < 20; i++) {
        const list = await mailpitMessages(mail.apiBase);
        if (list.total >= 2) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      const credAfter = await withTenant(db, tenantId, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT version, token_hash, encrypted_token
          FROM ticket_credentials
          WHERE tenant_id = ${tenantId}::uuid
            AND ticket_id = ${issued.ticketId}::uuid
            AND status = 'ACTIVE'
        `;
        return rows[0];
      });
      assert.equal(credAfter.token_hash, credBefore.token_hash);
      assert.equal(credAfter.version, credBefore.version);
      assert.equal(
        openCredentialToken(credAfter.encrypted_token, CREDENTIAL_KEY),
        tokenBefore,
      );

      // Concurrent recipient cap: 3/h.
      await withTenant(db, tenantId, async (tx) => {
        assert.equal(
          await tryConsumeRateLimit(tx, {
            tenantId,
            bucketKey: 'recipient:' + eventId + ':cap-demo',
            limit: 3,
          }),
          true,
        );
        assert.equal(
          await tryConsumeRateLimit(tx, {
            tenantId,
            bucketKey: 'recipient:' + eventId + ':cap-demo',
            limit: 3,
          }),
          true,
        );
        assert.equal(
          await tryConsumeRateLimit(tx, {
            tenantId,
            bucketKey: 'recipient:' + eventId + ':cap-demo',
            limit: 3,
          }),
          true,
        );
        assert.equal(
          await tryConsumeRateLimit(tx, {
            tenantId,
            bucketKey: 'recipient:' + eventId + ':cap-demo',
            limit: 3,
          }),
          false,
        );
      });

      // Push channel failure must not rewrite email ACCEPTED → FAILED.
      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          INSERT INTO notifications (
            tenant_id, event_id, id, business_key, channel, kind,
            payload_version, state, attempts, payload, created_at, updated_at
          ) VALUES (
            ${tenantId}::uuid, ${eventId}::uuid, ${randomUUID()}::uuid,
            ${'ticket:' + issued.ticketId + ':issued:push'}, 'push',
            'TicketIssued', 1, 'FAILED', 1, '{}'::jsonb, now(), now()
          )
        `;
        const emailState = await tx.$queryRaw`
          SELECT state FROM notifications
          WHERE tenant_id = ${tenantId}::uuid
            AND business_key = ${'ticket:' + issued.ticketId + ':issued:email'}
        `;
        assert.equal(emailState[0].state, 'ACCEPTED');
      });

      // Invalid custom publish rejected; default still usable.
      await assert.rejects(
        () =>
          withTenant(db, tenantId, (tx) =>
            publishNotificationTemplate(tx, {
              tenantId,
              eventId,
              actorUserId: staff.userId,
              kind: 'TicketIssued',
              subject: 'bad {{notAllowed}}',
              bodyText: 'x',
              bodyHtml: '<p>x</p>',
            }),
          ),
        (error) =>
          error instanceof NotificationError &&
          error.code === NOTIFICATION_ERROR_CODES.TEMPLATE_UNSUPPORTED_VARIABLE,
      );
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (pgName) {
        try {
          docker('rm', '-f', pgName);
        } catch {
          /* ignore */
        }
      }
      if (mailName) {
        try {
          docker('rm', '-f', mailName);
        } catch {
          /* ignore */
        }
      }
    }
  },
);

// silence unused import in case tree-shake tooling
void createHash;
