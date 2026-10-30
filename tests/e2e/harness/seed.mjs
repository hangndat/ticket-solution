import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, privateJson } from './runtime.mjs';

const requireBackend = createRequire(
  resolve(ROOT, 'packages/backend/package.json'),
);
const requireApi = createRequire(resolve(ROOT, 'apps/api/package.json'));

function hourWindowStart(now = new Date()) {
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      0,
      0,
      0,
    ),
  );
}

async function primeUserRateCounter(admin, userId, bucketKey, count) {
  const window = hourWindowStart();
  await admin.query(
    `INSERT INTO notification_rate_counters (
      tenant_id, bucket_key, window_started_at, count, updated_at
    ) VALUES ($1::uuid, $2, $3::timestamptz, $4, now())
    ON CONFLICT (tenant_id, bucket_key, window_started_at)
    DO UPDATE SET count = EXCLUDED.count, updated_at = now()`,
    [userId, bucketKey, window.toISOString(), count],
  );
}

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
    ...(state.secondaryActor ? { secondaryActor: state.secondaryActor } : {}),
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
        ...(['DB-03', 'DB-04', 'DB-07'].includes(caseId) ? [`E2E-${state.id}-${caseId}-C`] : []),
        ...(caseId === 'DB-07' ? [`E2E-${state.id}-${caseId}-D`] : []),
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
      if (caseId === 'AUTH-05') {
        fixture.data.shortWebClientSecret =
          state.clientSecrets['ticket-web-short'];
      }
      if (caseId === 'AUTH-06') {
        // Private, run-scoped control. The test uses ticket_runtime + tenant RLS.
        fixture.data.controlDatabaseUrl = state.databaseUrl;
      }
      if (['AUTH-03', 'WEB-04', 'WEB-05', 'DB-03', 'DB-04', 'DB-07', 'DB-02', 'DB-09', 'DB-10', 'DB-11', 'DB-12', 'DB-14'].includes(caseId)) {
        // Private, run-scoped control for H/DB reconciliation under tenant RLS.
        fixture.data.controlDatabaseUrl = state.databaseUrl;
      }
      if (caseId === 'DB-03' || caseId === 'DB-04') {
        // Third code keeps each race request on its own unused code.
        fixture.data.raceCode = codes[2];
      }
      if (caseId === 'DB-07') {
        fixture.data.thirdCode = codes[2];
        fixture.data.fourthCode = codes[3];
      }
      if (caseId === 'PORT-12') {
        fixture.data.registrationName = `New Tenant ${state.id}`;
        fixture.data.registrationSlug = `new-${slug}`;
      }
      if (['AUTH-03', 'DB-03', 'DB-04', 'DB-07', 'DB-10', 'DB-11', 'DB-14', 'SEC-04', 'SEC-05', 'WEB-04', 'WEB-05'].includes(caseId)) {
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
        if (caseId === 'PORT-07') {
          // Fixture-only gate panel reader: Portal nav (report.read) + list API
          // (gate.confirm) without event.update — not a production role preset.
          await tx.$executeRaw`
            UPDATE event_assignments
            SET permissions = ARRAY['report.read', 'gate.confirm']::text[]
            WHERE tenant_id = ${tenantId}::uuid
              AND event_id = ${eventId}::uuid
              AND membership_id = ${memberships.cs.membershipId}::uuid
          `;
        }
        const inventory = await backend.seedEventInventory(tx, hmac, {
          tenantId,
          eventId,
          eventQuota: caseId === 'DB-07' ? 2 : 100,
          rawCodes: codes,
          ticketTypeLabel: 'E2E General',
          sourceName: 'E2E Auto',
        });
        fixture.ticketTypeId = inventory.ticketTypeId;
        fixture.sourceId = inventory.sourceId;
        if (caseId === 'PORT-08') {
          fixture.data.pendingHoldCodeId = inventory.codeIds[1];
        }
        if (caseId === 'DB-10') fixture.data.usedCodeId = inventory.codeIds[0];
        if (caseId === 'DB-14') {
          const entitlement = JSON.stringify({
            gateAccess: 'standard',
            tier: 'db14-v1',
            perks: ['lounge'],
          });
          await tx.$executeRaw`
            UPDATE ticket_types
            SET entitlement_snapshot = ${entitlement}::jsonb
            WHERE tenant_id = ${tenantId}::uuid AND id = ${inventory.ticketTypeId}::uuid
          `;
        }
        if (caseId === 'DB-07') {
          await tx.$executeRaw`UPDATE issuance_sources
            SET approval_mode='MANUAL', pending_ttl_hours=3
            WHERE tenant_id=${tenantId}::uuid AND id=${inventory.sourceId}::uuid`;
          fixture.data.pendingTtlHours = 3;
        }
        if (caseId === 'DB-04') {
          await tx.$executeRaw`
            UPDATE events SET max_tickets_per_attendee = 1
            WHERE tenant_id = ${tenantId}::uuid AND id = ${eventId}::uuid
          `;
        }
        if (
          ['AUTH-03', 'WEB-02', 'WEB-03', 'WEB-05', 'WEB-07', 'WEB-08', 'WEB-10'].includes(caseId)
        ) {
          fixture.data.codeIds = { primary: inventory.codeIds[0] };
          if (caseId === 'WEB-05') {
            fixture.data.codeIds.secondary = inventory.codeIds[1];
          }
        }
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
        if (caseId === 'SEC-05') {
          fixture.data.configVersion = saved.version;
          fixture.data.xssPersistMarker = `SEC05-PERSIST-${state.id}`;
        }
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
          fixture.data.controlDatabaseUrl = state.databaseUrl;
          fixture.data.publicUrl = new URL(
            `/t/${slug}/events/${fixture.eventSlug}`,
            state.origins.web,
          ).toString();
          fixture.data.publicApiUrl = new URL(
            `/v1/public/tenants/${slug}/events/${fixture.eventSlug}`,
            state.origins.api,
          ).toString();
          fixture.data.configPayload = eventPayload(
            `Tenant ${caseId}`,
            `Updated ${caseId}`,
          );
          fixture.data.updatedPublishedName = `Updated ${caseId}`;
          const entitlement = JSON.stringify({
            gateAccess: 'standard',
            tier: 'port02-v1',
            perks: ['e2e'],
          });
          await tx.$executeRaw`
            UPDATE ticket_types
            SET entitlement_snapshot = ${entitlement}::jsonb
            WHERE tenant_id = ${tenantId}::uuid AND id = ${inventory.ticketTypeId}::uuid
          `;
          fixture.data.entitlementV1 = JSON.parse(entitlement);
        }
        if (['WEB-06', 'PORT-06'].includes(caseId)) {
          await tx.$executeRaw`UPDATE issuance_sources SET approval_mode='MANUAL' WHERE tenant_id=${tenantId}::uuid AND id=${fixture.sourceId}::uuid`;
        }
        if (caseId === 'WEB-07') {
          // Extra single-use codes for the replay/reload/conflict cases — the
          // double-submit case keeps using the generic fixture.code.
          const lostResponseCode = `E2E-${state.id}-${caseId}-LR`;
          const reloadCode = `E2E-${state.id}-${caseId}-RL`;
          const conflictCode = `E2E-${state.id}-${caseId}-CF`;
          const raceCode = `E2E-${state.id}-${caseId}-RC`;
          fixture.data.lostResponseCode = lostResponseCode;
          fixture.data.reloadCode = reloadCode;
          fixture.data.conflictCode = conflictCode;
          fixture.data.raceCode = raceCode;
          fixture.data.conflictAnswersAlt = {
            ...formAnswers(accounts.attendee.username),
            phone: '+639171234568',
          };
          for (const [name, raw] of Object.entries({
            lostResponse: lostResponseCode,
            reload: reloadCode,
            conflict: conflictCode,
            race: raceCode,
          })) {
            const codeId = randomUUID();
            fixture.data.codeIds[name] = codeId;
            const codeHmac = backend.hashRedemptionCode(hmac, raw);
            await tx.$executeRaw`
              INSERT INTO redemption_codes (
                tenant_id, event_id, id, code_hmac, code_pepper_version,
                source_id, ticket_type_id, status, created_at, updated_at
              ) VALUES (
                ${tenantId}::uuid, ${eventId}::uuid, ${codeId}::uuid,
                ${codeHmac}, ${hmac.version},
                ${fixture.sourceId}::uuid, ${fixture.ticketTypeId}::uuid,
                'AVAILABLE', now(), now()
              )
            `;
            await backend.attachCodeRoutingOnInsert(tx, {
              peppers: [hmac],
              fpSecret: state.secrets.hmac,
              tenantId,
              eventId,
              redemptionCodeId: codeId,
              rawCode: raw,
              codeStatus: 'AVAILABLE',
              insertPepperVersion: 1,
              insertHmac: codeHmac,
            });
          }
        }
        if (caseId === 'WEB-10') {
          const rawCode = `E2E-${state.id}-${caseId}-DC`;
          const codeId = randomUUID();
          fixture.data.delayedCommitCode = rawCode;
          fixture.data.codeIds.delayedCommit = codeId;
          const codeHmac = backend.hashRedemptionCode(hmac, rawCode);
          await tx.$executeRaw`
            INSERT INTO redemption_codes (
              tenant_id, event_id, id, code_hmac, code_pepper_version,
              source_id, ticket_type_id, status, created_at, updated_at
            ) VALUES (
              ${tenantId}::uuid, ${eventId}::uuid, ${codeId}::uuid,
              ${codeHmac}, ${hmac.version},
              ${fixture.sourceId}::uuid, ${fixture.ticketTypeId}::uuid,
              'AVAILABLE', now(), now()
            )
          `;
          await backend.attachCodeRoutingOnInsert(tx, {
            peppers: [hmac],
            fpSecret: state.secrets.hmac,
            tenantId,
            eventId,
            redemptionCodeId: codeId,
            rawCode,
            codeStatus: 'AVAILABLE',
            insertPepperVersion: 1,
            insertHmac: codeHmac,
          });
        }
        if (caseId === 'WEB-13') {
          const primaryEventName = `E2E ${caseId} primary`;
          fixture.data.eventName = primaryEventName;
          fixture.data.autoSlots = {
            primary: {
              eventId,
              eventName: primaryEventName,
            },
          };
          await tx.$executeRaw`
            UPDATE events SET name = ${primaryEventName}
            WHERE tenant_id = ${tenantId}::uuid AND id = ${eventId}::uuid
          `;
          for (const slot of [
            'wrongEmail',
            'unverified',
            'secondClaim',
            'idempotencyReplay',
            'expired',
            'revoked',
          ]) {
            const slotEventId = randomUUID();
            const slotSlug = `auto-${slot.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
            const slotEventName = `E2E ${caseId} ${slot}`;
            await tx.event.create({
              data: {
                tenantId,
                id: slotEventId,
                slug: slotSlug,
                name: slotEventName,
                status: 'PUBLISHED',
                visibility: 'PUBLIC',
              },
            });
            for (const [actor, role] of Object.entries(roles)) {
              await backend.grantEventAssignment(tx, {
                tenantId,
                eventId: slotEventId,
                membershipId: memberships[actor].membershipId,
                permissions: backend.eventPermissionsForRole(role),
              });
            }
            await backend.seedEventInventory(tx, hmac, {
              tenantId,
              eventId: slotEventId,
              eventQuota: 100,
              rawCodes: [],
              ticketTypeLabel: 'E2E General',
              sourceName: 'E2E Auto',
            });
            const slotPayload = eventPayload(`Tenant ${caseId}`, slotEventName);
            const slotSaved = await backend.saveEventConfigVersion(tx, {
              tenantId,
              eventId: slotEventId,
              actorUserId: accounts.owner.userId,
              payload: slotPayload,
            });
            await backend.publishEventConfig(tx, {
              tenantId,
              eventId: slotEventId,
              actorUserId: accounts.owner.userId,
              expectedVersion: slotSaved.version,
            });
            fixture.data.autoSlots[slot] = {
              eventId: slotEventId,
              eventName: slotEventName,
            };
          }
          const manualPrimaryName = `E2E ${caseId} Manual primary`;
          fixture.data.manualSlots = {};
          for (const [slot, slugSuffix] of [
            ['primary', 'manual-event'],
            ['managerReject', 'manual-reject'],
          ]) {
            const manualEventId = randomUUID();
            const manualEventSlug = slugSuffix;
            const manualEventName =
              slot === 'primary'
                ? manualPrimaryName
                : `E2E ${caseId} Manual reject`;
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
            fixture.data.manualSlots[slot] = {
              eventId: manualEventId,
              eventSlug: manualEventSlug,
              eventName: manualEventName,
              sourceId: manual.sourceId,
              sourceLabel: 'E2E Manual',
              ticketTypeId: manual.ticketTypeId,
              ticketTypeLabel: 'E2E Manual General',
            };
          }
          const manualPrimary = fixture.data.manualSlots.primary;
          fixture.data.manualEventId = manualPrimary.eventId;
          fixture.data.manualEventSlug = manualPrimary.eventSlug;
          fixture.data.manualEventName = manualPrimary.eventName;
          fixture.data.manualSourceId = manualPrimary.sourceId;
          fixture.data.manualSourceLabel = manualPrimary.sourceLabel;
          fixture.data.manualTicketTypeId = manualPrimary.ticketTypeId;
          fixture.data.manualTicketTypeLabel = manualPrimary.ticketTypeLabel;
        }
        if (caseId === 'PORT-05') {
          fixture.data.sourceLabel = 'E2E Auto';
          fixture.data.controlDatabaseUrl = state.databaseUrl;
          await tx.$executeRaw`
            UPDATE redemption_codes SET status = 'CONSUMED'
            WHERE tenant_id = ${tenantId}::uuid AND id = ${inventory.codeIds[0]}::uuid
          `;
          fixture.data.consumedCode = codes[0];
        }
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
        if (caseId === 'WEB-04') {
          const expiredEventId = randomUUID();
          const closedEventId = randomUUID();
          const quotaEventId = randomUUID();
          const limitEventId = randomUUID();
          const expiredCode = `E2E-${state.id}-${caseId}-X`;
          const closedCode = `E2E-${state.id}-${caseId}-C`;
          const quotaCode = `E2E-${state.id}-${caseId}-Q`;
          const quotaConsumedCode = `E2E-${state.id}-${caseId}-QF`;
          const limitConsumedCode = `E2E-${state.id}-${caseId}-LF`;
          const limitCode = `E2E-${state.id}-${caseId}-L`;
          fixture.data.expiredCode = expiredCode;
          fixture.data.closedCode = closedCode;
          fixture.data.quotaCode = quotaCode;
          fixture.data.usedCode = codes[1];
          fixture.data.expiredEventId = expiredEventId;
          fixture.data.closedEventId = closedEventId;
          fixture.data.quotaEventId = quotaEventId;
          fixture.data.limitEventId = limitEventId;
          fixture.data.limitCode = limitCode;

          async function seedNegativeEvent(
            eventId,
            eventSlug,
            eventName,
            rawCodes,
            eventQuota,
            afterPublish,
          ) {
            await tx.event.create({
              data: {
                tenantId,
                id: eventId,
                slug: eventSlug,
                name: eventName,
                status: 'PUBLISHED',
                visibility: 'PUBLIC',
              },
            });
            await backend.grantEventAssignment(tx, {
              tenantId,
              eventId,
              membershipId: memberships.owner.membershipId,
              permissions: backend.eventPermissionsForRole('Owner'),
            });
            const inventory = await backend.seedEventInventory(tx, hmac, {
              tenantId,
              eventId,
              eventQuota,
              rawCodes,
              ticketTypeLabel: 'E2E Negative',
              sourceName: 'E2E Negative',
            });
            for (let index = 0; index < rawCodes.length; index++) {
              await backend.attachCodeRoutingOnInsert(tx, {
                peppers: [hmac],
                fpSecret: state.secrets.hmac,
                tenantId,
                eventId,
                redemptionCodeId: inventory.codeIds[index],
                rawCode: rawCodes[index],
                codeStatus: 'AVAILABLE',
                insertPepperVersion: 1,
                insertHmac: backend.hashRedemptionCode(hmac, rawCodes[index]),
              });
            }
            const saved = await backend.saveEventConfigVersion(tx, {
              tenantId,
              eventId,
              actorUserId: accounts.owner.userId,
              payload: eventPayload(`Tenant ${caseId}`, eventName),
            });
            await backend.publishEventConfig(tx, {
              tenantId,
              eventId,
              actorUserId: accounts.owner.userId,
              expectedVersion: saved.version,
            });
            if (afterPublish) await afterPublish(eventId);
          }

          await seedNegativeEvent(
            expiredEventId,
            'expired-event',
            `Expired ${caseId}`,
            [expiredCode],
            10,
            async (eventId) => {
              await tx.$executeRaw`
                UPDATE events
                SET redemption_opens_at = now() - interval '7 days',
                    redemption_closes_at = now() - interval '1 hour'
                WHERE tenant_id = ${tenantId}::uuid AND id = ${eventId}::uuid
              `;
            },
          );
          await seedNegativeEvent(
            closedEventId,
            'closed-event',
            `Closed ${caseId}`,
            [closedCode],
            10,
            async (eventId) => {
              await tx.$executeRaw`
                UPDATE events
                SET business_status = 'CANCELLED',
                    cancel_reason = 'E2E closed event',
                    cancelled_at = now()
                WHERE tenant_id = ${tenantId}::uuid AND id = ${eventId}::uuid
              `;
            },
          );
          await seedNegativeEvent(
            quotaEventId,
            'quota-event',
            `Quota ${caseId}`,
            [quotaConsumedCode, quotaCode],
            1,
          );
          await seedNegativeEvent(
            limitEventId,
            'limit-event',
            `Limit ${caseId}`,
            [limitConsumedCode, limitCode],
            10,
            async (eventId) => {
              await tx.$executeRaw`
                UPDATE events
                SET max_tickets_per_attendee = 1
                WHERE tenant_id = ${tenantId}::uuid AND id = ${eventId}::uuid
              `;
            },
          );
        }
      });
      if (caseId === 'WEB-04') {
        const answers = fixture.data.answers;
        await backend.withTenant(db, tenantId, (tx) =>
          backend.redeemAndIssueTicket(tx, hmac, state.secrets.credential, {
            tenantId,
            eventId,
            actorUserId: accounts.attendee.userId,
            actorEmail: accounts.attendee.username,
            emailVerified: true,
            rawCode: codes[1],
            idempotencyKey: randomUUID(),
            formVersion: 'form-v1',
            termsVersion: 'terms-v1',
            termsAccepted: true,
            answers,
          }),
        );
        await backend.withTenant(db, tenantId, (tx) =>
          backend.redeemAndIssueTicket(tx, hmac, state.secrets.credential, {
            tenantId,
            eventId: fixture.data.quotaEventId,
            actorUserId: accounts.attendee.userId,
            actorEmail: accounts.attendee.username,
            emailVerified: true,
            rawCode: `E2E-${state.id}-${caseId}-QF`,
            idempotencyKey: randomUUID(),
            formVersion: 'form-v1',
            termsVersion: 'terms-v1',
            termsAccepted: true,
            answers,
          }),
        );
        await backend.withTenant(db, tenantId, (tx) =>
          backend.redeemAndIssueTicket(tx, hmac, state.secrets.credential, {
            tenantId,
            eventId: fixture.data.limitEventId,
            actorUserId: accounts.attendee.userId,
            actorEmail: accounts.attendee.username,
            emailVerified: true,
            rawCode: `E2E-${state.id}-${caseId}-LF`,
            idempotencyKey: randomUUID(),
            formVersion: 'form-v1',
            termsVersion: 'terms-v1',
            termsAccepted: true,
            answers,
          }),
        );
        const suspendedTenantId = randomUUID();
        const suspendedEventId = randomUUID();
        const suspendedSlug = `${slug}-suspended`;
        const suspendedCode = `E2E-${state.id}-${caseId}-S`;
        fixture.data.suspendedTenantId = suspendedTenantId;
        fixture.data.suspendedTenantSlug = suspendedSlug;
        fixture.data.suspendedCode = suspendedCode;
        fixture.data.suspendedEventId = suspendedEventId;
        await backend.withTenant(db, suspendedTenantId, async (tx) => {
          await tx.tenant.create({
            data: {
              id: suspendedTenantId,
              slug: suspendedSlug,
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
            ticketTypeLabel: 'E2E Suspended',
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
        await backend.withTenant(db, suspendedTenantId, (tx) =>
          tx.tenant.update({
            where: { id: suspendedTenantId },
            data: { status: 'SUSPENDED' },
          }),
        );
      }
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
      if (caseId === 'PORT-05') {
        const foreignTenantId = randomUUID();
        const foreignEventId = randomUUID();
        fixture.data.foreignTenantId = foreignTenantId;
        fixture.data.foreignEventId = foreignEventId;
        await backend.withTenant(db, foreignTenantId, async (tx) => {
          await tx.tenant.create({
            data: {
              id: foreignTenantId,
              slug: `${slug}-foreign`,
              name: 'Foreign PORT-05 tenant',
            },
          });
          const membership = await backend.grantMembership(tx, {
            tenantId: foreignTenantId,
            userId: accounts.owner.userId,
            role: 'Owner',
            permissions: backend.tenantPermissionsForRole('Owner'),
          });
          await tx.event.create({
            data: {
              tenantId: foreignTenantId,
              id: foreignEventId,
              slug: 'event',
              name: 'Foreign PORT-05 event',
              status: 'PUBLISHED',
            },
          });
          await backend.grantEventAssignment(tx, {
            tenantId: foreignTenantId,
            eventId: foreignEventId,
            membershipId: membership.membershipId,
            permissions: backend.eventPermissionsForRole('Owner'),
          });
          const inventory = await backend.seedEventInventory(tx, hmac, {
            tenantId: foreignTenantId,
            eventId: foreignEventId,
            eventQuota: 20,
            rawCodes: [],
            ticketTypeLabel: 'Foreign PORT-05 type',
            sourceName: 'Foreign PORT-05 source',
          });
          fixture.data.foreignSourceId = inventory.sourceId;
          fixture.data.foreignTicketTypeId = inventory.ticketTypeId;
        });
      }
      if (caseId === 'DB-10') {
        const otherEventId = randomUUID();
        fixture.data.otherEventId = otherEventId;
        await backend.withTenant(db, tenantId, async (tx) => {
          await tx.event.create({ data: {
            tenantId, id: otherEventId, slug: 'other-event',
            name: 'Other DB-10 event', status: 'PUBLISHED',
          } });
          const membership = await tx.membership.findFirstOrThrow({
            where: { tenantId, userId: accounts.owner.userId },
          });
          await backend.grantEventAssignment(tx, {
            tenantId, eventId: otherEventId, membershipId: membership.id,
            permissions: backend.eventPermissionsForRole('Owner'),
          });
          const inventory = await backend.seedEventInventory(tx, hmac, {
            tenantId, eventId: otherEventId, eventQuota: 20, rawCodes: [],
            ticketTypeLabel: 'Other DB-10 type', sourceName: 'Other DB-10 source',
          });
          fixture.data.otherSourceId = inventory.sourceId;
          fixture.data.otherTicketTypeId = inventory.ticketTypeId;
        });
        const foreignTenantId = randomUUID();
        const foreignEventId = randomUUID();
        fixture.data.foreignTenantId = foreignTenantId;
        fixture.data.foreignEventId = foreignEventId;
        await backend.withTenant(db, foreignTenantId, async (tx) => {
          await tx.tenant.create({ data: {
            id: foreignTenantId, slug: `${slug}-foreign`, name: 'Foreign DB-10 tenant',
          } });
          const membership = await backend.grantMembership(tx, {
            tenantId: foreignTenantId, userId: accounts.owner.userId,
            role: 'Owner', permissions: backend.tenantPermissionsForRole('Owner'),
          });
          await tx.event.create({ data: {
            tenantId: foreignTenantId, id: foreignEventId, slug: 'event',
            name: 'Foreign DB-10 event', status: 'PUBLISHED',
          } });
          await backend.grantEventAssignment(tx, {
            tenantId: foreignTenantId, eventId: foreignEventId,
            membershipId: membership.membershipId,
            permissions: backend.eventPermissionsForRole('Owner'),
          });
          const inventory = await backend.seedEventInventory(tx, hmac, {
            tenantId: foreignTenantId, eventId: foreignEventId,
            eventQuota: 20, rawCodes: [], ticketTypeLabel: 'Foreign DB-10 type',
            sourceName: 'Foreign DB-10 source',
          });
          fixture.data.foreignSourceId = inventory.sourceId;
          fixture.data.foreignTicketTypeId = inventory.ticketTypeId;
        });
      }
      if (caseId === 'DB-12') {
        // The generic block above already saved+published version 1 of
        // `eventId` (brand.organizationName = `Tenant ${caseId}`). Only add
        // the never-published sibling event here.
        const draftId = randomUUID();
        fixture.data.draftEventId = draftId;
        await backend.withTenant(db, tenantId, async (tx) => {
          await tx.event.create({
            data: {
              tenantId,
              id: draftId,
              slug: 'draft-only',
              name: 'Draft Only DB-12',
              status: 'DRAFT',
              visibility: 'PUBLIC',
            },
          });
          const membership = await tx.membership.findFirstOrThrow({
            where: { tenantId, userId: accounts.owner.userId },
          });
          await backend.grantEventAssignment(tx, {
            tenantId,
            eventId: draftId,
            membershipId: membership.id,
            permissions: backend.eventPermissionsForRole('Owner'),
          });
          // Saved but intentionally never published — proves draft/unpublished
          // stays invisible on the public projection (ADR-19 fail-closed).
          await backend.saveEventConfigVersion(tx, {
            tenantId,
            eventId: draftId,
            actorUserId: accounts.owner.userId,
            payload: eventPayload('Draft Org', 'Draft Hero'),
          });
        });
      }
      const csvPath = resolve(state.dir, `${caseId}-codes.csv`);
      writeFileSync(csvPath, `code\nIMPORTED-${state.id}-${caseId}\n`, {
        mode: 0o600,
      });
      fixture.csvPath = csvPath;
      if (caseId === 'PORT-05') {
        const newCode = `PORT05-NEW-${state.id}`;
        const writeCsv = (name, body) => {
          const path = resolve(state.dir, name);
          writeFileSync(path, body, { mode: 0o600 });
          return path;
        };
        fixture.data.newImportCode = newCode;
        fixture.data.invalidMixCsvPath = writeCsv(
          `${caseId}-invalid.csv`,
          `code\n \n${newCode}\n`,
        );
        fixture.data.duplicateCsvPath = writeCsv(
          `${caseId}-dup.csv`,
          `code\n${newCode}\n${newCode}\n`,
        );
        fixture.data.existingCodesCsvPath = writeCsv(
          `${caseId}-existing.csv`,
          `code\n${newCode}\n${codes[0]}\n${codes[1]}\n`,
        );
        const limitLines = ['code'];
        for (let i = 0; i < 10_001; i += 1) {
          limitLines.push(`LIM-${state.id}-${i}`);
        }
        fixture.data.rowLimitCsvPath = writeCsv(
          `${caseId}-row-limit.csv`,
          `${limitLines.join('\n')}\n`,
        );
      }
      if (caseId === 'PORT-11') {
        fixture.data.inviteeEmail = accounts.otherAttendee.username;
        fixture.data.inviteeUsername = accounts.otherAttendee.username;
        fixture.data.inviteePassword = accounts.otherAttendee.password;
      }
      if (caseId === 'WEB-13') {
        for (const [slot, meta] of Object.entries(fixture.data.autoSlots)) {
          const path = resolve(state.dir, `${caseId}-auto-${slot}-guests.csv`);
          writeFileSync(path, `email\n${accounts.attendee.username}\n`, {
            mode: 0o600,
          });
          meta.csvPath = path;
        }
        fixture.data.autoCsvPath = fixture.data.autoSlots.primary.csvPath;
        for (const [slot, meta] of Object.entries(fixture.data.manualSlots)) {
          const path = resolve(state.dir, `${caseId}-manual-${slot}-guests.csv`);
          writeFileSync(path, `email\n${accounts.otherAttendee.username}\n`, {
            mode: 0o600,
          });
          meta.csvPath = path;
        }
        fixture.data.manualCsvPath = fixture.data.manualSlots.primary.csvPath;
      }
      if (
        [
          'AUTH-07',
          'AUTH-06',
          'WEB-09',
          'WEB-11',
          'PORT-02',
          'PORT-03',
          'PORT-04',
          'PORT-08',
          'PORT-09',
          'GATE-03',
          'DB-09',
          'SEC-04',
          'SEC-05',
        ].includes(caseId)
      ) {
        const answers =
          fixture.data.answers ?? formAnswers(accounts.attendee.username);
        if (caseId === 'SEC-05') fixture.data.answers = answers;
        const operationKey = randomUUID();
        const outcome = await backend.withTenant(db, tenantId, (tx) =>
          backend.redeemAndIssueTicket(tx, hmac, state.secrets.credential, {
            tenantId,
            eventId,
            actorUserId: accounts.attendee.userId,
            actorEmail: accounts.attendee.username,
            emailVerified: true,
            rawCode: codes[0],
            idempotencyKey: operationKey,
            formVersion: 'form-v1',
            termsVersion: 'terms-v1',
            termsAccepted: true,
            answers: fixture.data.answers,
          }),
        );
        const ticket = backend.unwrapRedeemOutcome(outcome);
        fixture.ticketId = ticket.ticketId;
        if (caseId === 'WEB-09') {
          fixture.requestId = ticket.requestId;
          fixture.data.operationKey = operationKey;
          const otherTenantId = randomUUID();
          const otherEventId = randomUUID();
          const otherSlug = `other-${slug}`;
          const states = ['ACTIVE', 'REVOKED', 'CANCELLED'];
          const otherCodes = states.map(
            (stateName) => `E2E-${state.id}-${caseId}-${stateName}`,
          );
          const otherTickets = {};
          await backend.withTenant(db, otherTenantId, async (tx) => {
            await tx.tenant.create({
              data: {
                id: otherTenantId,
                slug: otherSlug,
                name: `Other Tenant ${caseId}`,
              },
            });
            await tx.event.create({
              data: {
                tenantId: otherTenantId,
                id: otherEventId,
                slug: 'event',
                name: `Other Event ${caseId}`,
                status: 'PUBLISHED',
                visibility: 'PUBLIC',
              },
            });
            const ownerMembership = await backend.grantMembership(tx, {
              tenantId: otherTenantId,
              userId: accounts.owner.userId,
              role: 'Owner',
              permissions: backend.tenantPermissionsForRole('Owner'),
            });
            await backend.grantEventAssignment(tx, {
              tenantId: otherTenantId,
              eventId: otherEventId,
              membershipId: ownerMembership.membershipId,
              permissions: backend.eventPermissionsForRole('Owner'),
            });
            const inventory = await backend.seedEventInventory(tx, hmac, {
              tenantId: otherTenantId,
              eventId: otherEventId,
              eventQuota: 100,
              rawCodes: otherCodes,
              ticketTypeLabel: 'E2E Other General',
              sourceName: 'E2E Other Auto',
            });
            for (let index = 0; index < otherCodes.length; index++) {
              await backend.attachCodeRoutingOnInsert(tx, {
                peppers: [hmac],
                fpSecret: state.secrets.hmac,
                tenantId: otherTenantId,
                eventId: otherEventId,
                redemptionCodeId: inventory.codeIds[index],
                rawCode: otherCodes[index],
                codeStatus: 'AVAILABLE',
                insertPepperVersion: 1,
                insertHmac: backend.hashRedemptionCode(hmac, otherCodes[index]),
              });
            }
            const saved = await backend.saveEventConfigVersion(tx, {
              tenantId: otherTenantId,
              eventId: otherEventId,
              actorUserId: accounts.owner.userId,
              payload: eventPayload(
                `Other Tenant ${caseId}`,
                `Other Event ${caseId}`,
              ),
            });
            await backend.publishEventConfig(tx, {
              tenantId: otherTenantId,
              eventId: otherEventId,
              actorUserId: accounts.owner.userId,
              expectedVersion: saved.version,
            });
          });
          for (const [index, stateName] of states.entries()) {
            const issued = await backend.withTenant(db, otherTenantId, (tx) =>
              backend.redeemAndIssueTicket(tx, hmac, state.secrets.credential, {
                tenantId: otherTenantId,
                eventId: otherEventId,
                actorUserId: accounts.attendee.userId,
                actorEmail: accounts.attendee.username,
                emailVerified: true,
                rawCode: otherCodes[index],
                idempotencyKey: randomUUID(),
                formVersion: 'form-v1',
                termsVersion: 'terms-v1',
                termsAccepted: true,
                answers,
              }),
            );
            const issuedTicket = backend.unwrapRedeemOutcome(issued);
            otherTickets[stateName] = issuedTicket.ticketId;
            if (stateName !== 'ACTIVE') {
              await backend.withTenant(db, otherTenantId, (tx) =>
                tx.ticket.update({
                  where: {
                    tenantId_id: {
                      tenantId: otherTenantId,
                      id: issuedTicket.ticketId,
                    },
                  },
                  data: { state: stateName },
                }),
              );
            }
          }
          fixture.data.otherTenantId = otherTenantId;
          fixture.data.otherTenantSlug = otherSlug;
          fixture.data.otherEventId = otherEventId;
          fixture.data.otherTickets = otherTickets;
        }
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
        await backend.withTenant(db, tenantId, async (tx) => {
          await backend.configureIssuanceLockTimeout(tx);

          // Deny-with-reason fixture: a fourth code held under the main
          // source, independent of the approve-path requestId above.
          const denyCode = `E2E-${state.id}-${caseId}-DENY`;
          const denyCodeId = randomUUID();
          const denyHmac = backend.hashRedemptionCode(hmac, denyCode);
          await tx.$executeRaw`
            INSERT INTO redemption_codes (
              tenant_id, event_id, id, code_hmac, code_pepper_version,
              source_id, ticket_type_id, status, created_at, updated_at
            ) VALUES (
              ${tenantId}::uuid, ${eventId}::uuid, ${denyCodeId}::uuid,
              ${denyHmac}, ${hmac.version},
              ${fixture.sourceId}::uuid, ${fixture.ticketTypeId}::uuid,
              'AVAILABLE', now(), now()
            )
          `;
          await backend.attachCodeRoutingOnInsert(tx, {
            peppers: [hmac],
            fpSecret: state.secrets.hmac,
            tenantId,
            eventId,
            redemptionCodeId: denyCodeId,
            rawCode: denyCode,
            codeStatus: 'AVAILABLE',
            insertPepperVersion: 1,
            insertHmac: denyHmac,
          });
          const denyOutcome = await backend.redeemAndIssueTicket(
            tx,
            hmac,
            state.secrets.credential,
            {
              tenantId,
              eventId,
              actorUserId: accounts.attendee.userId,
              actorEmail: accounts.attendee.username,
              emailVerified: true,
              rawCode: denyCode,
              idempotencyKey: randomUUID(),
              formVersion: 'form-v1',
              termsVersion: 'terms-v1',
              termsAccepted: true,
              answers: fixture.data.answers,
            },
          );
          if (denyOutcome.ok !== 'pending')
            throw new Error(
              'PORT-06 seed expected a deny-path pending MANUAL redemption',
            );
          fixture.data.denyRequestId = denyOutcome.result.requestId;
          fixture.data.denyReason = 'Thông tin không khớp hồ sơ sự kiện';

          // Duplicate-decision fixture: decide now so the spec can replay the
          // same decision with a fresh Idempotency-Key (lost-response retry).
          const decidedOutcome = await backend.redeemAndIssueTicket(
            tx,
            hmac,
            state.secrets.credential,
            {
              tenantId,
              eventId,
              actorUserId: accounts.otherAttendee.userId,
              actorEmail: accounts.otherAttendee.username,
              emailVerified: true,
              rawCode: fixture.secondCode,
              idempotencyKey: randomUUID(),
              formVersion: 'form-v1',
              termsVersion: 'terms-v1',
              termsAccepted: true,
              answers: fixture.data.manualAnswers,
            },
          );
          if (decidedOutcome.ok !== 'pending')
            throw new Error(
              'PORT-06 seed expected a second pending MANUAL redemption',
            );
          const decidedRequestId = decidedOutcome.result.requestId;
          const approved = backend.unwrapApprovalOutcome(
            await backend.decideRedemption(tx, state.secrets.credential, {
              tenantId,
              eventId,
              requestId: decidedRequestId,
              actorUserId: accounts.manager.userId,
              decision: 'approve',
              idempotencyKey: randomUUID(),
              reason: null,
            }),
          );
          fixture.data.decidedRequestId = decidedRequestId;
          fixture.data.decidedTicketId = approved.ticketId;

          // Expired-pending fixture: a third code held, then pushed past TTL.
          const expiredCode = `E2E-${state.id}-${caseId}-EXP`;
          const expiredCodeId = randomUUID();
          const expiredHmac = backend.hashRedemptionCode(hmac, expiredCode);
          await tx.$executeRaw`
            INSERT INTO redemption_codes (
              tenant_id, event_id, id, code_hmac, code_pepper_version,
              source_id, ticket_type_id, status, created_at, updated_at
            ) VALUES (
              ${tenantId}::uuid, ${eventId}::uuid, ${expiredCodeId}::uuid,
              ${expiredHmac}, ${hmac.version},
              ${fixture.sourceId}::uuid, ${fixture.ticketTypeId}::uuid,
              'AVAILABLE', now(), now()
            )
          `;
          await backend.attachCodeRoutingOnInsert(tx, {
            peppers: [hmac],
            fpSecret: state.secrets.hmac,
            tenantId,
            eventId,
            redemptionCodeId: expiredCodeId,
            rawCode: expiredCode,
            codeStatus: 'AVAILABLE',
            insertPepperVersion: 1,
            insertHmac: expiredHmac,
          });
          const expiredOutcome = await backend.redeemAndIssueTicket(
            tx,
            hmac,
            state.secrets.credential,
            {
              tenantId,
              eventId,
              actorUserId: accounts.unverified.userId,
              actorEmail: accounts.unverified.username,
              emailVerified: true,
              rawCode: expiredCode,
              idempotencyKey: randomUUID(),
              formVersion: 'form-v1',
              termsVersion: 'terms-v1',
              termsAccepted: true,
              answers: fixture.data.answers,
            },
          );
          if (expiredOutcome.ok !== 'pending')
            throw new Error(
              'PORT-06 seed expected an expiring pending MANUAL redemption',
            );
          fixture.data.expiredRequestId = expiredOutcome.result.requestId;
          // The browser spec expires this row only after rendering it, so a
          // stale pending row can exercise the real decision and UI feedback.

          // Quota-exhausted fixture: dedicated type/source at capacity 1,
          // consumed by a decoy approval before the spec's own decision.
          const quotaExhaustedDecoyCode = `E2E-${state.id}-${caseId}-QX-DECOY`;
          const quotaExhaustedCode = `E2E-${state.id}-${caseId}-QX`;
          const exhausted = await backend.seedEventInventory(tx, hmac, {
            tenantId,
            eventId,
            eventQuota: 100,
            typeQuota: 1,
            sourceQuota: 1,
            rawCodes: [quotaExhaustedDecoyCode, quotaExhaustedCode],
            ticketTypeLabel: 'E2E PORT-06 Quota Exhausted',
            sourceName: 'E2E PORT-06 Quota Exhausted',
          });
          // The event already has its shared quota bucket. Remove the helper's
          // extra EVENT bucket so this branch exhausts only its own type/source.
          await tx.$executeRaw`
            DELETE FROM quota_buckets
            WHERE tenant_id = ${tenantId}::uuid
              AND id = ${exhausted.eventBucketId}::uuid
          `;
          await tx.$executeRaw`UPDATE issuance_sources SET approval_mode='MANUAL' WHERE tenant_id=${tenantId}::uuid AND id=${exhausted.sourceId}::uuid`;
          for (const [index, raw] of [
            quotaExhaustedDecoyCode,
            quotaExhaustedCode,
          ].entries()) {
            const codeHmac = backend.hashRedemptionCode(hmac, raw);
            await backend.attachCodeRoutingOnInsert(tx, {
              peppers: [hmac],
              fpSecret: state.secrets.hmac,
              tenantId,
              eventId,
              redemptionCodeId: exhausted.codeIds[index],
              rawCode: raw,
              codeStatus: 'AVAILABLE',
              insertPepperVersion: 1,
              insertHmac: codeHmac,
            });
          }
          const decoyOutcome = await backend.redeemAndIssueTicket(
            tx,
            hmac,
            state.secrets.credential,
            {
              tenantId,
              eventId,
              actorUserId: accounts.scanner.userId,
              actorEmail: accounts.scanner.username,
              emailVerified: true,
              rawCode: quotaExhaustedDecoyCode,
              idempotencyKey: randomUUID(),
              formVersion: 'form-v1',
              termsVersion: 'terms-v1',
              termsAccepted: true,
              answers: fixture.data.autoAnswers,
            },
          );
          if (decoyOutcome.ok !== 'pending')
            throw new Error(
              'PORT-06 seed expected a decoy pending MANUAL redemption',
            );
          const quotaOutcome = await backend.redeemAndIssueTicket(
            tx,
            hmac,
            state.secrets.credential,
            {
              tenantId,
              eventId,
              actorUserId: accounts.supervisor.userId,
              actorEmail: accounts.supervisor.username,
              emailVerified: true,
              rawCode: quotaExhaustedCode,
              idempotencyKey: randomUUID(),
              formVersion: 'form-v1',
              termsVersion: 'terms-v1',
              termsAccepted: true,
              answers: fixture.data.manualAnswers,
            },
          );
          if (quotaOutcome.ok !== 'pending')
            throw new Error(
              'PORT-06 seed expected a quota-exhausted pending MANUAL redemption',
            );
          fixture.data.quotaExhaustedRequestId = quotaOutcome.result.requestId;
          backend.unwrapApprovalOutcome(
            await backend.decideRedemption(tx, state.secrets.credential, {
              tenantId,
              eventId,
              requestId: decoyOutcome.result.requestId,
              actorUserId: accounts.manager.userId,
              decision: 'approve',
              idempotencyKey: randomUUID(),
              reason: null,
            }),
          );
        });
      }
      if (caseId === 'PORT-08') {
        const pendingHoldCodeId = fixture.data.pendingHoldCodeId;
        if (!pendingHoldCodeId) {
          throw new Error('PORT-08 seed missing pendingHoldCodeId');
        }
        await backend.withTenant(db, tenantId, async (tx) => {
          await backend.holdCodeForReview(tx, {
            tenantId,
            eventId,
            codeId: pendingHoldCodeId,
            ownerUserId: accounts.otherAttendee.userId,
          });
          await tx.$executeRaw`
            INSERT INTO notifications (
              tenant_id, event_id, id, business_key, channel, kind,
              state, attempts, last_error, payload
            ) VALUES (
              ${tenantId}::uuid,
              ${eventId}::uuid,
              ${randomUUID()}::uuid,
              ${'ticket:' + fixture.ticketId + ':issued:email-dead-' + state.id},
              'email',
              'TicketIssued',
              'DEAD',
              5,
              'smtp down',
              '{}'::jsonb
            )
          `;
        });
        fixture.data.report = await backend.withTenant(db, tenantId, (tx) =>
          backend.readEventReport(tx, {
            tenantId,
            eventId,
            actorUserId: accounts.owner.userId,
          }),
        );
      }
      if (caseId === 'PORT-04') fixture.data.capacity = 100;
      if (caseId === 'SEC-04') {
        const { API_RATE_BUCKETS, API_RATE_LIMITS } = requireApi(
          './dist/http-limits.js',
        );
        const resolveBucket = 'redemption.resolve';
        const resolveLimit = 30;
        const prime = new Client({
          connectionString: `postgresql://postgres:${state.secrets.pg}@127.0.0.1:${state.ports.pg}/e2e`,
        });
        await prime.connect();
        try {
          await primeUserRateCounter(
            prime,
            accounts.attendee.userId,
            resolveBucket,
            resolveLimit,
          );
          await primeUserRateCounter(
            prime,
            accounts.attendee.userId,
            API_RATE_BUCKETS.redeem,
            API_RATE_LIMITS.redeemPerUser,
          );
          await primeUserRateCounter(
            prime,
            accounts.scanner.userId,
            API_RATE_BUCKETS.gateReserve,
            API_RATE_LIMITS.gateReservePerUser - 1,
          );
          await primeUserRateCounter(
            prime,
            accounts.scanner.userId,
            API_RATE_BUCKETS.gateOfflineSyncReceipt,
            API_RATE_LIMITS.gateOfflineSyncReceiptPerUser,
          );
          await primeUserRateCounter(
            prime,
            accounts.owner.userId,
            API_RATE_BUCKETS.importJobsList,
            API_RATE_LIMITS.importJobsListPerUser,
          );
        } finally {
          await prime.end();
        }
        fixture.data.rateLimits = {
          resolveLimit,
          redeemLimit: API_RATE_LIMITS.redeemPerUser,
        };
      }
      if (caseId === 'SEC-01' || caseId === 'SEC-02' || caseId === 'DB-01') {
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
      if (caseId === 'SEC-06') {
        await backend.withTenant(db, tenantId, async (tx) => {
          const bulkCodes = Array.from(
            { length: 110 },
            (_, i) => `E2E-${state.id}-${caseId}-BULK-${i}`,
          );
          const bulkInventory = await backend.seedEventInventory(tx, hmac, {
            tenantId,
            eventId,
            eventQuota: 1000,
            rawCodes: bulkCodes,
            ticketTypeLabel: 'E2E SEC-06 Bulk',
            sourceName: 'E2E SEC-06 Bulk',
          });
          for (let index = 0; index < bulkCodes.length; index++) {
            await backend.attachCodeRoutingOnInsert(tx, {
              peppers: [hmac],
              fpSecret: state.secrets.hmac,
              tenantId,
              eventId,
              redemptionCodeId: bulkInventory.codeIds[index],
              rawCode: bulkCodes[index],
              codeStatus: 'AVAILABLE',
              insertPepperVersion: 1,
              insertHmac: backend.hashRedemptionCode(hmac, bulkCodes[index]),
            });
          }
          fixture.data.codesSourceId = bulkInventory.sourceId;
          fixture.data.codesTicketTypeId = bulkInventory.ticketTypeId;
          fixture.data.codesBulkCount = bulkCodes.length;
          fixture.data.probeRawCode = bulkCodes[0];

          const secretReason = `SEC06-SECRET-REASON-${state.id}`;
          const secretEmail = `sec06-secret-${state.id}@example.test`;
          const secretHmac = backend.hashRedemptionCode(hmac, bulkCodes[0]);
          fixture.data.secretReason = secretReason;
          fixture.data.secretEmail = secretEmail;
          fixture.data.secretHmac = secretHmac;
          const auditCount = 105;
          for (let i = 0; i < auditCount; i++) {
            await tx.$executeRaw`
              INSERT INTO audit_logs (
                tenant_id, event_id, id, actor_user_id, action,
                resource_type, resource_id, reason, sanitized_diff, operation_id
              ) VALUES (
                ${tenantId}::uuid, ${eventId}::uuid, ${randomUUID()}::uuid,
                ${accounts.owner.userId}::uuid, ${'sec06.demo.' + i},
                'event', ${eventId}::uuid,
                ${i === 0 ? secretReason : 'reason-' + i},
                ${JSON.stringify({
                  email: secretEmail,
                  hmac: secretHmac,
                  rawCode: bulkCodes[0],
                })}::jsonb,
                ${randomUUID()}::uuid
              )
            `;
          }
          fixture.data.auditCount = auditCount;
        });
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
    httpPlatformClientId: 'e2e-http-platform',
    httpPlatformClientSecret: state.clientSecrets['e2e-http-platform'],
    sourceProvenance: state.sourceProvenance,
    ...(state.secondaryRealm
      ? {
          secondaryIssuer: `${state.origins.auth}/realms/${state.secondaryRealm}`,
          secondaryJwksUrl: `${state.origins.auth}/realms/${state.secondaryRealm}/protocol/openid-connect/certs`,
          secondaryHttpClientId: 'e2e-http-secondary',
          secondaryHttpClientSecret: state.secondaryClientSecret,
        }
      : {}),
  };
  state.manifest = manifest;
  state.manifestPath = resolve(state.dir, 'manifest.json');
  privateJson(state.manifestPath, manifest);
  return manifest;
}
