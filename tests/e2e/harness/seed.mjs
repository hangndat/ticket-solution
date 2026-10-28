import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, privateJson } from './runtime.mjs';

const requireBackend = createRequire(
  resolve(ROOT, 'packages/backend/package.json'),
);

function formAnswers(email) {
  return {
    full_name: 'E2E Guest',
    email,
    phone: '+639171234567',
    shirt: 'm',
    agree: true,
  };
}

function eventPayload(tenantName, eventName) {
  return {
    schemaVersion: 1,
    brand: { primaryColor: '#164E63', organizationName: tenantName },
    sections: [
      {
        kind: 'hero',
        id: 'hero',
        visible: true,
        order: 0,
        body: { title: eventName, text: 'Synthetic local event' },
      },
      {
        kind: 'info',
        id: 'info',
        visible: true,
        order: 1,
        body: { title: 'Thông tin', text: 'Local fixture' },
      },
      {
        kind: 'redeem',
        id: 'redeem',
        visible: true,
        order: 2,
        body: { title: 'Đổi mã', text: '' },
      },
      {
        kind: 'guide',
        id: 'guide',
        visible: false,
        order: 3,
        body: { title: 'Hướng dẫn', text: '' },
      },
      {
        kind: 'faq',
        id: 'faq',
        visible: true,
        order: 4,
        body: {
          title: 'FAQ',
          items: [{ question: 'Khi nào?', answer: 'Trong thời gian sự kiện.' }],
        },
      },
      {
        kind: 'terms',
        id: 'terms',
        visible: true,
        order: 5,
        body: {
          title: 'Điều khoản',
          termsVersion: 'terms-v1',
          text: 'Synthetic test terms',
        },
      },
    ],
    formDefinitionId: 'form-v1',
    termsVersion: 'terms-v1',
    form: {
      formVersion: 'form-v1',
      fields: [
        { id: 'full_name', label: 'Họ tên', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'email', required: true },
        { id: 'phone', label: 'Điện thoại', type: 'phone', required: true },
        {
          id: 'shirt',
          label: 'Áo',
          type: 'select',
          required: true,
          options: [{ id: 'm', label: 'M' }],
        },
        { id: 'agree', label: 'Đồng ý', type: 'checkbox', required: true },
      ],
    },
  };
}

export async function seedRuntime(state, caseIds) {
  const { Client } = requireBackend('pg');
  const backend = requireBackend('./dist/index.js');
  const { migrationFiles } = requireBackend('./test/migration-files.cjs');
  const admin = new Client({
    connectionString: `postgresql://postgres:${state.secrets.pg}@127.0.0.1:${state.ports.pg}/e2e`,
  });
  await admin.connect();
  try {
    for (const role of [
      'ticket_runtime',
      'ticket_platform_runtime',
      'migration_owner',
    ]) {
      await admin.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
    }
    await admin.query(
      'GRANT CREATE, USAGE ON SCHEMA public TO migration_owner',
    );
    await admin.query('SET ROLE migration_owner');
    for (const file of migrationFiles())
      await admin.query(readFileSync(file, 'utf8'));
    await admin.query('RESET ROLE');
    // Generated hex password, no user input interpolation.
    await admin.query(
      `CREATE ROLE e2e_runtime LOGIN PASSWORD '${state.secrets.pg}' NOSUPERUSER NOBYPASSRLS INHERIT`,
    );
    await admin.query(
      'GRANT ticket_runtime, ticket_platform_runtime TO e2e_runtime',
    );
  } finally {
    await admin.end();
  }
  state.databaseUrl = `postgresql://e2e_runtime:${state.secrets.pg}@127.0.0.1:${state.ports.pg}/e2e`;
  const db = backend.createDatabase(state.databaseUrl, 8);
  const users = backend.createPrismaIdentityUserRepository(db);
  const issuer = `${state.origins.auth}/realms/${state.realm}`;
  const hmac = backend.readCodeHmacEnvironment({
    CODE_HMAC_PEPPER: state.secrets.hmac,
    CODE_HMAC_VERSION: '1',
  });
  const roles = {
    owner: 'Owner',
    manager: 'Manager',
    cs: 'CS',
    scanner: 'Scanner',
    supervisor: 'Supervisor',
  };
  const manifest = {
    schemaVersion: 1,
    runId: state.id,
    origins: state.origins,
    accounts: state.accounts,
    cases: {},
  };
  try {
    for (const accounts of [
      state.accounts,
      ...Object.values(state.caseAccounts),
    ]) {
      for (const [name, value] of Object.entries(accounts)) {
        const user = await users.upsertFromVerifiedIdentity({
          issuer,
          subject: value.subject,
          email: value.username,
          emailVerified: name !== 'unverified',
        });
        value.userId = user.userId;
        if (name === 'operator') {
          // Provision the test's explicit Operator via the isolated seed admin.
          // Runtime API still verifies the real OIDC MFA token and DB grant.
          const provision = new Client({
            connectionString: `postgresql://postgres:${state.secrets.pg}@127.0.0.1:${state.ports.pg}/e2e`,
          });
          await provision.connect();
          try {
            await provision.query(
              'INSERT INTO platform_operators (user_id, activated_at) VALUES ($1, now()) ON CONFLICT (user_id) DO NOTHING',
              [user.userId],
            );
          } finally {
            await provision.end();
          }
        }
      }
    }
    for (const caseId of caseIds) {
      const tenantId = randomUUID();
      const eventId = randomUUID();
      const slug = `${caseId.toLowerCase()}-${state.id}`;
      const accounts = state.caseAccounts[caseId];
      const codes = [
        `E2E-${state.id}-${caseId}-A`,
        `E2E-${state.id}-${caseId}-B`,
      ];
      const fixture = {
        tenantId,
        tenantSlug: slug,
        eventId,
        eventSlug: 'event',
        code: codes[0],
        secondCode: codes[1],
        accounts,
        data: {
          eventName: `E2E ${caseId}`,
          eventNameToCreate: `Created ${caseId}`,
          eventSlug: `new-${caseId.toLowerCase()}`,
          answers: formAnswers(accounts.attendee.username),
          autoAnswers: formAnswers(accounts.attendee.username),
          manualAnswers: formAnswers(accounts.otherAttendee.username),
          gateName: `Gate ${caseId}`,
          expectedPublishedName: `E2E ${caseId}`,
          draftName: `Draft ${caseId}`,
          invalidCode: `INVALID-${state.id}`,
        },
      };
      if (caseId === 'PORT-12') {
        fixture.data.registrationName = `New Tenant ${state.id}`;
        fixture.data.registrationSlug = `new-${slug}`;
      }
      if (['AUTH-03', 'DB-03'].includes(caseId)) {
        fixture.data.formVersion = 'form-v1';
        fixture.data.termsVersion = 'terms-v1';
        if (caseId === 'AUTH-03')
          fixture.data.answers = formAnswers(accounts.unverified.username);
      }
      await backend.withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug, name: `Tenant ${caseId}` },
        });
        if (caseId === 'PORT-12') return;
        const memberships = {};
        for (const [actor, role] of Object.entries(roles)) {
          memberships[actor] = await backend.grantMembership(tx, {
            tenantId,
            userId: accounts[actor].userId,
            role,
            permissions: backend.tenantPermissionsForRole(role),
          });
        }
        fixture.data.eventName =
          caseId === 'PORT-01' ? `New ${caseId} ${state.id}` : `E2E ${caseId}`;
        if (caseId === 'PORT-01') return;
        await tx.event.create({
          data: {
            tenantId,
            id: eventId,
            slug: fixture.eventSlug,
            name: `E2E ${caseId}`,
            status: 'PUBLISHED',
            visibility: 'PUBLIC',
          },
        });
        for (const [actor, role] of Object.entries(roles)) {
          await backend.grantEventAssignment(tx, {
            tenantId,
            eventId,
            membershipId: memberships[actor].membershipId,
            permissions: backend.eventPermissionsForRole(role),
          });
        }
        const inventory = await backend.seedEventInventory(tx, hmac, {
          tenantId,
          eventId,
          eventQuota: 100,
          rawCodes: codes,
          ticketTypeLabel: 'E2E General',
          sourceName: 'E2E Auto',
        });
        fixture.ticketTypeId = inventory.ticketTypeId;
        fixture.sourceId = inventory.sourceId;
        fixture.data.ticketTypeLabel = 'E2E General';
        fixture.data.autoSourceLabel = 'E2E Auto';
        for (let index = 0; index < codes.length; index++) {
          await backend.attachCodeRoutingOnInsert(tx, {
            peppers: [hmac],
            fpSecret: state.secrets.hmac,
            tenantId,
            eventId,
            redemptionCodeId: inventory.codeIds[index],
            rawCode: codes[index],
            codeStatus: 'AVAILABLE',
            insertPepperVersion: 1,
            insertHmac: backend.hashRedemptionCode(hmac, codes[index]),
          });
        }
        const payload = eventPayload(`Tenant ${caseId}`, `E2E ${caseId}`);
        const saved = await backend.saveEventConfigVersion(tx, {
          tenantId,
          eventId,
          actorUserId: accounts.owner.userId,
          payload,
        });
        await backend.publishEventConfig(tx, {
          tenantId,
          eventId,
          actorUserId: accounts.owner.userId,
          expectedVersion: saved.version,
        });
        if (caseId === 'WEB-01') {
          const draftEventId = randomUUID();
          const privateEventId = randomUUID();
          fixture.data.draftEventId = draftEventId;
          fixture.data.draftEventSlug = 'draft-event';
          fixture.data.privateEventId = privateEventId;
          fixture.data.privateEventSlug = 'private-event';
          await tx.event.create({
            data: {
              tenantId,
              id: draftEventId,
              slug: fixture.data.draftEventSlug,
              name: `Draft ${caseId}`,
              status: 'DRAFT',
              visibility: 'PUBLIC',
            },
          });
          await backend.grantEventAssignment(tx, {
            tenantId,
            eventId: draftEventId,
            membershipId: memberships.owner.membershipId,
            permissions: backend.eventPermissionsForRole('Owner'),
          });
          await backend.saveEventConfigVersion(tx, {
            tenantId,
            eventId: draftEventId,
            actorUserId: accounts.owner.userId,
            payload: eventPayload(`Tenant ${caseId}`, `Draft ${caseId}`),
          });
          await tx.event.create({
            data: {
              tenantId,
              id: privateEventId,
              slug: fixture.data.privateEventSlug,
              name: `Private ${caseId}`,
              status: 'PUBLISHED',
              visibility: 'UNLISTED',
            },
          });
          await backend.grantEventAssignment(tx, {
            tenantId,
            eventId: privateEventId,
            membershipId: memberships.owner.membershipId,
            permissions: backend.eventPermissionsForRole('Owner'),
          });
          const privateSaved = await backend.saveEventConfigVersion(tx, {
            tenantId,
            eventId: privateEventId,
            actorUserId: accounts.owner.userId,
            payload: eventPayload(`Tenant ${caseId}`, `Private ${caseId}`),
          });
          await backend.publishEventConfig(tx, {
            tenantId,
            eventId: privateEventId,
            actorUserId: accounts.owner.userId,
            expectedVersion: privateSaved.version,
          });
        }
        if (caseId === 'PORT-03') {
          fixture.data.cloneName = `E2E ${caseId} Clone ${state.id}`;
          fixture.data.cloneSlug = 'cloned-event';
        }
        if (caseId === 'PORT-10') {
          const visibleEventId = randomUUID();
          const hiddenEventId = randomUUID();
          for (const [id, eventSlug, name] of [
            [visibleEventId, 'visible-report', `Visible ${caseId}`],
            [hiddenEventId, 'hidden-report', `Hidden ${caseId}`],
          ]) {
            await tx.event.create({
              data: {
                tenantId,
                id,
                slug: eventSlug,
                name,
                status: 'PUBLISHED',
              },
            });
            await backend.grantEventAssignment(tx, {
              tenantId,
              eventId: id,
              membershipId: memberships.owner.membershipId,
              permissions: backend.eventPermissionsForRole('Owner'),
            });
            if (id === visibleEventId) {
              await backend.grantEventAssignment(tx, {
                tenantId,
                eventId: id,
                membershipId: memberships.manager.membershipId,
                permissions: backend.eventPermissionsForRole('Manager'),
              });
            }
            const reportConfig = await backend.saveEventConfigVersion(tx, {
              tenantId,
              eventId: id,
              actorUserId: accounts.owner.userId,
              payload: eventPayload(`Tenant ${caseId}`, name),
            });
            await backend.publishEventConfig(tx, {
              tenantId,
              eventId: id,
              actorUserId: accounts.owner.userId,
              expectedVersion: reportConfig.version,
            });
          }
          await tx.$executeRaw`UPDATE event_assignments SET revoked_at = now() WHERE tenant_id = ${tenantId}::uuid AND event_id = ${hiddenEventId}::uuid AND membership_id = ${memberships.owner.membershipId}::uuid`;
          fixture.data.visibleEventIds = [eventId, visibleEventId];
          fixture.data.hiddenEventId = hiddenEventId;
        }
        if (caseId === 'PORT-02') {
          fixture.data.publicUrl = new URL(
            `/t/${slug}/events/${fixture.eventSlug}`,
            state.origins.web,
          ).toString();
          fixture.data.configPayload = eventPayload(
            `Tenant ${caseId}`,
            `Updated ${caseId}`,
          );
        }
        if (['WEB-06', 'PORT-06'].includes(caseId)) {
          await tx.$executeRaw`UPDATE issuance_sources SET approval_mode='MANUAL' WHERE tenant_id=${tenantId}::uuid AND id=${fixture.sourceId}::uuid`;
        }
        if (caseId === 'WEB-13') {
          const manualEventId = randomUUID();
          const manualEventSlug = 'manual-event';
          const manualEventName = `E2E ${caseId} Manual`;
          await tx.event.create({
            data: {
              tenantId,
              id: manualEventId,
              slug: manualEventSlug,
              name: manualEventName,
              status: 'PUBLISHED',
            },
          });
          for (const [actor, role] of Object.entries(roles)) {
            await backend.grantEventAssignment(tx, {
              tenantId,
              eventId: manualEventId,
              membershipId: memberships[actor].membershipId,
              permissions: backend.eventPermissionsForRole(role),
            });
          }
          const manual = await backend.seedEventInventory(tx, hmac, {
            tenantId,
            eventId: manualEventId,
            eventQuota: 100,
            rawCodes: [],
            ticketTypeLabel: 'E2E Manual General',
            sourceName: 'E2E Manual',
          });
          const manualPayload = eventPayload(
            `Tenant ${caseId}`,
            manualEventName,
          );
          const manualSaved = await backend.saveEventConfigVersion(tx, {
            tenantId,
            eventId: manualEventId,
            actorUserId: accounts.owner.userId,
            payload: manualPayload,
          });
          await backend.publishEventConfig(tx, {
            tenantId,
            eventId: manualEventId,
            actorUserId: accounts.owner.userId,
            expectedVersion: manualSaved.version,
          });
          await tx.$executeRaw`UPDATE issuance_sources SET approval_mode='MANUAL' WHERE tenant_id=${tenantId}::uuid AND id=${manual.sourceId}::uuid`;
          fixture.data.manualEventId = manualEventId;
          fixture.data.manualEventSlug = manualEventSlug;
          fixture.data.manualEventName = manualEventName;
          fixture.data.manualSourceId = manual.sourceId;
          fixture.data.manualSourceLabel = 'E2E Manual';
          fixture.data.manualTicketTypeId = manual.ticketTypeId;
          fixture.data.manualTicketTypeLabel = 'E2E Manual General';
        }
        if (caseId === 'PORT-05') fixture.data.sourceLabel = 'E2E Auto';
        if (caseId === 'GATE-01') {
          const foreignEventId = randomUUID();
          await tx.event.create({
            data: {
              tenantId,
              id: foreignEventId,
              slug: 'other-event',
              name: `Other ${caseId}`,
              status: 'PUBLISHED',
            },
          });
          fixture.data.foreignEventId = foreignEventId;
          const foreignGateId = randomUUID();
          await tx.$executeRaw`INSERT INTO gates (tenant_id, event_id, id, name, sort_order) VALUES (${tenantId}::uuid, ${foreignEventId}::uuid, ${foreignGateId}::uuid, 'Other gate', 0)`;
          fixture.data.foreignGateId = foreignGateId;
        }
      });
      if (caseId === 'PLAT-02') {
        const pendingTenantId = randomUUID();
        const suspendedTenantId = randomUUID();
        const suspendedEventId = randomUUID();
        const suspendedCode = `E2E-${state.id}-${caseId}-S`;
        fixture.data.pendingTenantId = pendingTenantId;
        fixture.data.suspendedTenantId = suspendedTenantId;
        fixture.data.suspendedEventId = suspendedEventId;
        await backend.withTenant(db, pendingTenantId, async (tx) => {
          await tx.tenant.create({
            data: {
              id: pendingTenantId,
              slug: `${slug}-pending`,
              name: `Pending ${caseId}`,
              status: 'PENDING',
            },
          });
          await tx.$executeRaw`INSERT INTO tenant_limits (tenant_id) VALUES (${pendingTenantId}::uuid) ON CONFLICT DO NOTHING`;
          await backend.grantMembership(tx, {
            tenantId: pendingTenantId,
            userId: accounts.owner.userId,
            role: 'Owner',
            permissions: backend.tenantPermissionsForRole('Owner'),
          });
        });
        await backend.withTenant(db, suspendedTenantId, async (tx) => {
          await tx.tenant.create({
            data: {
              id: suspendedTenantId,
              slug: `${slug}-suspended`,
              name: `Suspended ${caseId}`,
              status: 'ACTIVE',
            },
          });
          await tx.event.create({
            data: {
              tenantId: suspendedTenantId,
              id: suspendedEventId,
              slug: 'event',
              name: `Suspended ${caseId}`,
              status: 'PUBLISHED',
            },
          });
          const ownerMembership = await backend.grantMembership(tx, {
            tenantId: suspendedTenantId,
            userId: accounts.owner.userId,
            role: 'Owner',
            permissions: backend.tenantPermissionsForRole('Owner'),
          });
          await backend.grantEventAssignment(tx, {
            tenantId: suspendedTenantId,
            eventId: suspendedEventId,
            membershipId: ownerMembership.membershipId,
            permissions: backend.eventPermissionsForRole('Owner'),
          });
          const inventory = await backend.seedEventInventory(tx, hmac, {
            tenantId: suspendedTenantId,
            eventId: suspendedEventId,
            eventQuota: 10,
            rawCodes: [suspendedCode],
            ticketTypeLabel: 'E2E Suspended General',
            sourceName: 'E2E Suspended',
          });
          await backend.attachCodeRoutingOnInsert(tx, {
            peppers: [hmac],
            fpSecret: state.secrets.hmac,
            tenantId: suspendedTenantId,
            eventId: suspendedEventId,
            redemptionCodeId: inventory.codeIds[0],
            rawCode: suspendedCode,
            codeStatus: 'AVAILABLE',
            insertPepperVersion: 1,
            insertHmac: backend.hashRedemptionCode(hmac, suspendedCode),
          });
          const config = await backend.saveEventConfigVersion(tx, {
            tenantId: suspendedTenantId,
            eventId: suspendedEventId,
            actorUserId: accounts.owner.userId,
            payload: eventPayload(`Suspended ${caseId}`, `Suspended ${caseId}`),
          });
          await backend.publishEventConfig(tx, {
            tenantId: suspendedTenantId,
            eventId: suspendedEventId,
            actorUserId: accounts.owner.userId,
            expectedVersion: config.version,
          });
        });
        const suspendedOutcome = await backend.withTenant(
          db,
          suspendedTenantId,
          (tx) =>
            backend.redeemAndIssueTicket(tx, hmac, state.secrets.credential, {
              tenantId: suspendedTenantId,
              eventId: suspendedEventId,
              actorUserId: accounts.attendee.userId,
              actorEmail: accounts.attendee.username,
              emailVerified: true,
              rawCode: suspendedCode,
              idempotencyKey: randomUUID(),
              formVersion: 'form-v1',
              termsVersion: 'terms-v1',
              termsAccepted: true,
              answers: fixture.data.answers,
            }),
        );
        fixture.data.suspendedTicketId =
          backend.unwrapRedeemOutcome(suspendedOutcome).ticketId;
        await backend.withTenant(db, suspendedTenantId, (tx) =>
          tx.tenant.update({
            where: { id: suspendedTenantId },
            data: { status: 'SUSPENDED' },
          }),
        );
      }
      const csvPath = resolve(state.dir, `${caseId}-codes.csv`);
      writeFileSync(csvPath, `code\nIMPORTED-${state.id}-${caseId}\n`, {
        mode: 0o600,
      });
      fixture.csvPath = csvPath;
      if (caseId === 'PORT-11') {
        fixture.data.inviteeEmail = accounts.otherAttendee.username;
        fixture.data.inviteeUsername = accounts.otherAttendee.username;
        fixture.data.inviteePassword = accounts.otherAttendee.password;
      }
      if (caseId === 'WEB-13') {
        for (const [kind, actor] of [
          ['auto', 'attendee'],
          ['manual', 'otherAttendee'],
        ]) {
          const path = resolve(state.dir, `${caseId}-${kind}-guests.csv`);
          writeFileSync(path, `email\n${accounts[actor].username}\n`, {
            mode: 0o600,
          });
          fixture.data[`${kind}CsvPath`] = path;
        }
      }
      if (
        [
          'AUTH-07',
          'WEB-09',
          'WEB-11',
          'PORT-03',
          'PORT-04',
          'PORT-08',
          'PORT-09',
          'GATE-03',
        ].includes(caseId)
      ) {
        const outcome = await backend.withTenant(db, tenantId, (tx) =>
          backend.redeemAndIssueTicket(tx, hmac, state.secrets.credential, {
            tenantId,
            eventId,
            actorUserId: accounts.attendee.userId,
            actorEmail: accounts.attendee.username,
            emailVerified: true,
            rawCode: codes[0],
            idempotencyKey: randomUUID(),
            formVersion: 'form-v1',
            termsVersion: 'terms-v1',
            termsAccepted: true,
            answers: fixture.data.answers,
          }),
        );
        const ticket = backend.unwrapRedeemOutcome(outcome);
        fixture.ticketId = ticket.ticketId;
      }
      if (caseId === 'PORT-06') {
        const outcome = await backend.withTenant(db, tenantId, (tx) =>
          backend.redeemAndIssueTicket(tx, hmac, state.secrets.credential, {
            tenantId,
            eventId,
            actorUserId: accounts.attendee.userId,
            actorEmail: accounts.attendee.username,
            emailVerified: true,
            rawCode: codes[0],
            idempotencyKey: randomUUID(),
            formVersion: 'form-v1',
            termsVersion: 'terms-v1',
            termsAccepted: true,
            answers: fixture.data.answers,
          }),
        );
        if (outcome.ok !== 'pending')
          throw new Error('PORT-06 seed expected a pending MANUAL redemption');
        fixture.requestId = outcome.result.requestId;
      }
      if (caseId === 'PORT-08') {
        fixture.data.report = await backend.withTenant(db, tenantId, (tx) =>
          backend.readEventReport(tx, {
            tenantId,
            eventId,
            actorUserId: accounts.owner.userId,
          }),
        );
      }
      if (caseId === 'PORT-04') fixture.data.capacity = 100;
      if (caseId === 'SEC-01') {
        const foreignTenantId = randomUUID();
        const foreignEventId = randomUUID();
        await backend.withTenant(db, foreignTenantId, async (tx) => {
          await tx.tenant.create({
            data: {
              id: foreignTenantId,
              slug: `foreign-${slug}`,
              name: `Foreign ${caseId}`,
            },
          });
          await tx.event.create({
            data: {
              tenantId: foreignTenantId,
              id: foreignEventId,
              slug: 'event',
              name: `Foreign ${caseId}`,
              status: 'PUBLISHED',
            },
          });
        });
        fixture.data.foreignTenantId = foreignTenantId;
        fixture.data.foreignEventId = foreignEventId;
      }
      manifest.cases[caseId] = fixture;
    }
  } finally {
    await db.$disconnect();
  }
  manifest.runtime = {
    ownerRunId: state.id,
    profile: 'isolated-https',
    tlsSpki: state.spki,
    hostSuffix: state.suffix,
    httpClientId: 'e2e-http',
    httpClientSecret: state.clientSecrets['e2e-http'],
  };
  state.manifest = manifest;
  state.manifestPath = resolve(state.dir, 'manifest.json');
  privateJson(state.manifestPath, manifest);
  return manifest;
}
