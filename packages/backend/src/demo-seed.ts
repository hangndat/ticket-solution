/**
 * D9 multi-tenant demo seed (fixture). Idempotent upsert by stable UUIDs.
 * Marked demo — never production identities or real secrets.
 * ADR-19: also publishes marketing config (hero/info/faq) for public catalog.
 */
import { randomUUID } from 'node:crypto';
import type { EventConfigPayload } from '@ticket/contracts';
import type { PrismaClient, Prisma } from './generated/prisma/client';
import { hashRedemptionCode, type CodeHmacConfig } from './code-hmac';
import {
  publishEventConfig,
  saveEventConfigVersion,
} from './config-publish';
import {
  eventPermissionsForRole,
  tenantPermissionsForRole,
} from './role-map';
import { withTenant } from './tenant-context';

const DEMO_MARKER = '· Demo';

/** Stable fixture UUIDs — see docs/demo/D9-DEMO-DATASET.md */
export const D9_DEMO = {
  marker: DEMO_MARKER,
  tenants: {
    mfest: {
      id: 'd9d9f001-0001-4000-8000-000000000001',
      slug: 'mfest-demo',
      name: `MFest ${DEMO_MARKER}`,
    },
    studio: {
      id: 'd9d9f001-0001-4000-8000-000000000002',
      slug: 'demo-studio',
      name: `Studio Organization ${DEMO_MARKER}`,
    },
  },
  events: {
    mfest: {
      id: 'd9d9f001-0002-4000-8000-000000000001',
      tenantKey: 'mfest' as const,
      slug: 'mfest',
      name: `MFest ${DEMO_MARKER}`,
      venueName: 'Demo riverside venue, Ho Chi Minh City (fixture)',
      startsAt: new Date('2027-03-20T10:00:00+07:00'),
      ticketTypeId: 'd9d9f001-0003-4000-8000-000000000001',
      sourceId: 'd9d9f001-0004-4000-8000-000000000001',
      sourceName: 'Demo VIP (fixture)',
      eventBucketId: 'd9d9f001-0005-4000-8000-000000000001',
      typeBucketId: 'd9d9f001-0005-4000-8000-000000000011',
      sourceBucketId: 'd9d9f001-0005-4000-8000-000000000021',
      eventQuota: 50,
      rawCodes: Array.from({ length: 10 }, (_, i) =>
        `DEMO-MFEST-${String(i + 1).padStart(3, '0')}`,
      ),
    },
    studioNight: {
      id: 'd9d9f001-0002-4000-8000-000000000002',
      tenantKey: 'studio' as const,
      slug: 'studio-night',
      name: `Studio Night ${DEMO_MARKER}`,
      venueName: 'Demo studio, Ho Chi Minh City (fixture)',
      startsAt: new Date('2027-04-10T18:00:00+07:00'),
      ticketTypeId: 'd9d9f001-0003-4000-8000-000000000002',
      sourceId: 'd9d9f001-0004-4000-8000-000000000002',
      sourceName: 'Demo GA (fixture)',
      eventBucketId: 'd9d9f001-0005-4000-8000-000000000002',
      typeBucketId: 'd9d9f001-0005-4000-8000-000000000012',
      sourceBucketId: 'd9d9f001-0005-4000-8000-000000000022',
      eventQuota: 50,
      rawCodes: Array.from({ length: 10 }, (_, i) =>
        `DEMO-STUDIO-${String(i + 1).padStart(3, '0')}`,
      ),
    },
  },
  staffEmail: 'staff@example.com',
  attendeeEmail: 'attendee@example.com',
} as const;

export type D9DemoSeedReport = {
  fixture: true;
  tenants: Array<{ id: string; slug: string; created: boolean }>;
  events: Array<{ id: string; slug: string; tenantId: string; created: boolean }>;
  codesInserted: number;
  codesSkipped: number;
  membershipsGranted: number;
  membershipsSkipped: number;
  assignmentsGranted: number;
  assignmentsSkipped: number;
  /** ADR-19 marketing config publish per event. */
  configsPublished: number;
  configsSkipped: number;
  staffUserIds: string[];
  attendeeUserIds: string[];
};

/** Marketing copy mapped into published sections (category/description/highlights). */
const DEMO_MARKETING = {
  mfest: {
    category: 'Music / Community / Discovery',
    description:
      'A little louder. A little brighter. A day of live music, creative encounters and moments worth sharing. · Demo',
    highlights: [
      'Live sounds, all afternoon',
      'Independent makers & creative spaces',
      'Room to meet, move and explore',
    ],
  },
  studioNight: {
    category: 'Design / Ideas / Conversation',
    description:
      'Make space for a different perspective. An intimate gathering for people shaping what comes next. · Demo',
    highlights: [
      'Conversations with working designers',
      'Hands-on material explorations',
      'A shared table for fresh ideas',
    ],
  },
} as const;

function marketingPayload(
  eventKey: keyof typeof DEMO_MARKETING,
  brand: { primaryColor: string; organizationName: string },
): EventConfigPayload {
  const copy = DEMO_MARKETING[eventKey];
  const highlightsText = copy.highlights.map((h) => `- ${h}`).join('\n');
  return {
    schemaVersion: 1,
    brand,
    sections: [
      {
        kind: 'hero',
        id: 'hero-demo',
        visible: true,
        order: 0,
        body: { title: copy.category, text: copy.description },
      },
      {
        kind: 'info',
        id: 'info-demo',
        visible: true,
        order: 1,
        body: { title: 'Highlights', text: highlightsText },
      },
      {
        kind: 'redeem',
        id: 'redeem-demo',
        visible: true,
        order: 2,
        body: {
          title: 'Redeem',
          text: 'Use a demo redemption code from the D9 seed dataset.',
        },
      },
      {
        kind: 'guide',
        id: 'guide-demo',
        visible: false,
        order: 3,
        body: { title: 'Guide', text: '' },
      },
      {
        kind: 'faq',
        id: 'faq-demo',
        visible: true,
        order: 4,
        body: {
          title: 'FAQ',
          items: [
            {
              question: 'Is this a real event?',
              answer: `No — this is fixture data (${DEMO_MARKER}).`,
            },
            {
              question: 'Where do I redeem?',
              answer: 'Use the redeem flow with a DEMO-* code from the seed.',
            },
          ],
        },
      },
      {
        kind: 'terms',
        id: 'terms-demo',
        visible: true,
        order: 5,
        body: {
          title: 'Terms',
          termsVersion: 'demo-terms-v1',
          text: `Demo terms for fixture events (${DEMO_MARKER}). Not a real contract.`,
        },
      },
    ],
    termsVersion: 'demo-terms-v1',
  };
}

async function ensurePublishedMarketingConfig(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    eventKey: keyof typeof DEMO_MARKETING;
    brand: { primaryColor: string; organizationName: string };
  },
): Promise<'published' | 'skipped'> {
  const existing = await tx.$queryRaw<
    Array<{ published_config_version: number | null }>
  >`
    SELECT published_config_version
    FROM events
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${input.eventId}::uuid
  `;
  if (existing[0]?.published_config_version != null) {
    return 'skipped';
  }
  const saved = await saveEventConfigVersion(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    actorUserId: input.actorUserId,
    payload: marketingPayload(input.eventKey, input.brand) as unknown as Record<
      string,
      unknown
    >,
  });
  await publishEventConfig(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    actorUserId: input.actorUserId,
    expectedVersion: saved.version,
  });
  return 'published';
}

export type D9DemoSeedOptions = {
  /** OIDC issuer used when creating missing identity rows. */
  oidcIssuer: string;
  /** Optional Keycloak subjects when creating missing users. */
  staffSubject?: string;
  attendeeSubject?: string;
};

function tenantByKey(key: 'mfest' | 'studio') {
  return D9_DEMO.tenants[key];
}

async function ensureUser(
  db: PrismaClient,
  input: {
    issuer: string;
    subject: string;
    email: string;
  },
): Promise<{ userId: string; created: boolean }> {
  const existing = await db.user.findUnique({
    where: {
      issuer_subject: { issuer: input.issuer, subject: input.subject },
    },
  });
  if (existing) {
    if (existing.email !== input.email || !existing.emailVerified) {
      await db.user.update({
        where: { id: existing.id },
        data: { email: input.email, emailVerified: true },
      });
    }
    return { userId: existing.id, created: false };
  }
  const row = await db.user.create({
    data: {
      id: randomUUID(),
      issuer: input.issuer,
      subject: input.subject,
      email: input.email,
      emailVerified: true,
    },
  });
  return { userId: row.id, created: true };
}

/** Find all identity rows for a demo email (multi-issuer local Keycloak). */
async function usersByEmail(
  db: PrismaClient,
  email: string,
): Promise<string[]> {
  const rows = await db.user.findMany({
    where: { email },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function ensureTenant(
  tx: Prisma.TransactionClient,
  tenant: { id: string; slug: string; name: string },
): Promise<boolean> {
  const byId = await tx.tenant.findUnique({ where: { id: tenant.id } });
  if (byId) {
    if (byId.slug !== tenant.slug) {
      throw new Error(
        `D9 demo tenant id ${tenant.id} exists with slug=${byId.slug}, expected ${tenant.slug}`,
      );
    }
    await tx.tenant.update({
      where: { id: tenant.id },
      data: { name: tenant.name, status: 'ACTIVE' },
    });
    return false;
  }
  const bySlug = await tx.tenant.findUnique({ where: { slug: tenant.slug } });
  if (bySlug) {
    throw new Error(
      `Tenant slug ${tenant.slug} already used by id=${bySlug.id}; refuse to overwrite non-demo id`,
    );
  }
  await tx.tenant.create({
    data: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: 'ACTIVE',
      defaultTimezone: 'Asia/Ho_Chi_Minh',
    },
  });
  return true;
}

async function ensureEvent(
  tx: Prisma.TransactionClient,
  tenantId: string,
  event: (typeof D9_DEMO.events)[keyof typeof D9_DEMO.events],
): Promise<boolean> {
  const byId = await tx.event.findUnique({
    where: { tenantId_id: { tenantId, id: event.id } },
  });
  const brand = {
    primaryColor: event.tenantKey === 'mfest' ? '#245B47' : '#59428A',
    organizationName: tenantByKey(event.tenantKey).name,
    fixture: true,
  };
  if (byId) {
    await tx.$executeRaw`
      UPDATE events SET
        slug = ${event.slug},
        name = ${event.name},
        status = 'PUBLISHED',
        content_status = 'PUBLISHED',
        business_status = 'ACTIVE',
        visibility = 'PUBLIC',
        timezone = 'Asia/Ho_Chi_Minh',
        starts_at = ${event.startsAt},
        venue_name = ${event.venueName},
        redemption_opens_at = COALESCE(redemption_opens_at, now() - interval '1 hour'),
        redemption_closes_at = COALESCE(redemption_closes_at, now() + interval '365 days'),
        check_in_opens_at = COALESCE(check_in_opens_at, now() - interval '1 hour'),
        check_in_closes_at = COALESCE(check_in_closes_at, now() + interval '365 days'),
        published_brand_snapshot = ${JSON.stringify(brand)}::jsonb
      WHERE tenant_id = ${tenantId}::uuid AND id = ${event.id}::uuid
    `;
    return false;
  }
  const slugClash = await tx.event.findUnique({
    where: { tenantId_slug: { tenantId, slug: event.slug } },
  });
  if (slugClash) {
    throw new Error(
      `Event slug ${event.slug} already used under tenant ${tenantId}`,
    );
  }
  await tx.$executeRaw`
    INSERT INTO events (
      tenant_id, id, slug, name, status, content_status, business_status,
      visibility, timezone, starts_at, venue_name,
      redemption_opens_at, redemption_closes_at,
      check_in_opens_at, check_in_closes_at,
      published_brand_snapshot, revision
    ) VALUES (
      ${tenantId}::uuid, ${event.id}::uuid, ${event.slug}, ${event.name},
      'PUBLISHED', 'PUBLISHED', 'ACTIVE', 'PUBLIC', 'Asia/Ho_Chi_Minh',
      ${event.startsAt}, ${event.venueName},
      now() - interval '1 hour', now() + interval '365 days',
      now() - interval '1 hour', now() + interval '365 days',
      ${JSON.stringify(brand)}::jsonb, 1
    )
  `;
  return true;
}

async function ensureInventory(
  tx: Prisma.TransactionClient,
  hmac: CodeHmacConfig,
  tenantId: string,
  event: (typeof D9_DEMO.events)[keyof typeof D9_DEMO.events],
): Promise<{ inserted: number; skipped: number }> {
  await tx.$executeRaw`
    INSERT INTO ticket_types (
      tenant_id, event_id, id, label, entitlement_snapshot, created_at, updated_at
    ) VALUES (
      ${tenantId}::uuid, ${event.id}::uuid, ${event.ticketTypeId}::uuid,
      'General', '{"fixture":true}'::jsonb, now(), now()
    )
    ON CONFLICT DO NOTHING
  `;
  await tx.$executeRaw`
    INSERT INTO issuance_sources (
      tenant_id, event_id, id, name, approval_mode, created_at, updated_at
    ) VALUES (
      ${tenantId}::uuid, ${event.id}::uuid, ${event.sourceId}::uuid,
      ${event.sourceName}, 'AUTO', now(), now()
    )
    ON CONFLICT DO NOTHING
  `;
  await tx.$executeRaw`
    INSERT INTO source_ticket_types (tenant_id, event_id, source_id, ticket_type_id)
    VALUES (
      ${tenantId}::uuid, ${event.id}::uuid,
      ${event.sourceId}::uuid, ${event.ticketTypeId}::uuid
    )
    ON CONFLICT DO NOTHING
  `;
  await tx.$executeRaw`
    INSERT INTO quota_buckets (
      tenant_id, event_id, id, scope, scope_id, capacity, allocated, created_at, updated_at
    ) VALUES
      (
        ${tenantId}::uuid, ${event.id}::uuid, ${event.eventBucketId}::uuid,
        'EVENT', NULL, ${event.eventQuota}, 0, now(), now()
      ),
      (
        ${tenantId}::uuid, ${event.id}::uuid, ${event.typeBucketId}::uuid,
        'TICKET_TYPE', ${event.ticketTypeId}::uuid,
        ${event.eventQuota}, 0, now(), now()
      ),
      (
        ${tenantId}::uuid, ${event.id}::uuid, ${event.sourceBucketId}::uuid,
        'ISSUANCE_SOURCE', ${event.sourceId}::uuid,
        ${event.eventQuota}, 0, now(), now()
      )
    ON CONFLICT DO NOTHING
  `;

  let inserted = 0;
  let skipped = 0;
  for (const raw of event.rawCodes) {
    const codeHmac = hashRedemptionCode(hmac, raw);
    const existing = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM redemption_codes
      WHERE tenant_id = ${tenantId}::uuid
        AND event_id = ${event.id}::uuid
        AND code_hmac = ${codeHmac}
      LIMIT 1
    `;
    if (existing[0]) {
      skipped += 1;
      continue;
    }
    const id = randomUUID();
    await tx.$executeRaw`
      INSERT INTO redemption_codes (
        tenant_id, event_id, id, code_hmac, code_pepper_version,
        source_id, ticket_type_id, status, created_at, updated_at
      ) VALUES (
        ${tenantId}::uuid, ${event.id}::uuid, ${id}::uuid,
        ${codeHmac}, ${hmac.version}, ${event.sourceId}::uuid,
        ${event.ticketTypeId}::uuid, 'AVAILABLE', now(), now()
      )
    `;
    inserted += 1;
  }
  return { inserted, skipped };
}

async function ensureStaffAccess(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
  userId: string,
): Promise<{ membership: 'granted' | 'skipped'; assignment: 'granted' | 'skipped' }> {
  const existing = await tx.membership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });
  let membershipId: string;
  let membership: 'granted' | 'skipped';
  if (existing && !existing.revokedAt) {
    membershipId = existing.id;
    membership = 'skipped';
    if (existing.role !== 'Owner') {
      await tx.membership.update({
        where: { id: existing.id },
        data: {
          role: 'Owner',
          permissions: [...tenantPermissionsForRole('Owner')],
          activatedAt: existing.activatedAt ?? new Date(),
        },
      });
    }
  } else if (existing?.revokedAt) {
    await tx.membership.update({
      where: { id: existing.id },
      data: {
        role: 'Owner',
        permissions: [...tenantPermissionsForRole('Owner')],
        activatedAt: new Date(),
        revokedAt: null,
      },
    });
    membershipId = existing.id;
    membership = 'granted';
  } else {
    membershipId = randomUUID();
    await tx.membership.create({
      data: {
        id: membershipId,
        tenantId,
        userId,
        role: 'Owner',
        permissions: [...tenantPermissionsForRole('Owner')],
        activatedAt: new Date(),
      },
    });
    membership = 'granted';
  }

  const assignment = await tx.eventAssignment.findUnique({
    where: {
      tenantId_eventId_membershipId: {
        tenantId,
        eventId,
        membershipId,
      },
    },
  });
  if (assignment && !assignment.revokedAt) {
    return { membership, assignment: 'skipped' };
  }
  if (assignment?.revokedAt) {
    await tx.eventAssignment.update({
      where: { id: assignment.id },
      data: {
        permissions: [...eventPermissionsForRole('Owner')],
        activatedAt: new Date(),
        revokedAt: null,
      },
    });
    return { membership, assignment: 'granted' };
  }
  await tx.eventAssignment.create({
    data: {
      id: randomUUID(),
      tenantId,
      eventId,
      membershipId,
      permissions: [...eventPermissionsForRole('Owner')],
      activatedAt: new Date(),
    },
  });
  return { membership, assignment: 'granted' };
}

/**
 * Idempotent D9 demo seed. Safe to re-run. Marks all rows as fixture/demo.
 */
export async function seedD9DemoDataset(
  db: PrismaClient,
  hmac: CodeHmacConfig,
  options: D9DemoSeedOptions,
): Promise<D9DemoSeedReport> {
  const issuer = options.oidcIssuer.replace(/\/$/, '');
  const staffSubject =
    options.staffSubject ?? 'd9-demo-staff-subject-fixture';
  const attendeeSubject =
    options.attendeeSubject ?? 'd9-demo-attendee-subject-fixture';

  await ensureUser(db, {
    issuer,
    subject: staffSubject,
    email: D9_DEMO.staffEmail,
  });
  await ensureUser(db, {
    issuer,
    subject: attendeeSubject,
    email: D9_DEMO.attendeeEmail,
  });

  const staffUserIds = await usersByEmail(db, D9_DEMO.staffEmail);
  const attendeeUserIds = await usersByEmail(db, D9_DEMO.attendeeEmail);
  if (staffUserIds.length === 0) {
    throw new Error('D9 demo: staff user missing after ensureUser');
  }

  const report: D9DemoSeedReport = {
    fixture: true,
    tenants: [],
    events: [],
    codesInserted: 0,
    codesSkipped: 0,
    membershipsGranted: 0,
    membershipsSkipped: 0,
    assignmentsGranted: 0,
    assignmentsSkipped: 0,
    configsPublished: 0,
    configsSkipped: 0,
    staffUserIds,
    attendeeUserIds,
  };

  for (const tenant of [D9_DEMO.tenants.mfest, D9_DEMO.tenants.studio]) {
    const created = await withTenant(db, tenant.id, (tx) =>
      ensureTenant(tx, tenant),
    );
    report.tenants.push({ id: tenant.id, slug: tenant.slug, created });
  }

  const actorUserId = staffUserIds[0]!;
  for (const event of [D9_DEMO.events.mfest, D9_DEMO.events.studioNight]) {
    const tenant = tenantByKey(event.tenantKey);
    const eventKey =
      event.slug === 'mfest' ? ('mfest' as const) : ('studioNight' as const);
    const brand = {
      primaryColor: event.tenantKey === 'mfest' ? '#245B47' : '#59428A',
      organizationName: tenant.name,
    };
    const created = await withTenant(db, tenant.id, async (tx) => {
      const eventCreated = await ensureEvent(tx, tenant.id, event);
      const codes = await ensureInventory(tx, hmac, tenant.id, event);
      report.codesInserted += codes.inserted;
      report.codesSkipped += codes.skipped;
      for (const userId of staffUserIds) {
        const access = await ensureStaffAccess(
          tx,
          tenant.id,
          event.id,
          userId,
        );
        if (access.membership === 'granted') report.membershipsGranted += 1;
        else report.membershipsSkipped += 1;
        if (access.assignment === 'granted') report.assignmentsGranted += 1;
        else report.assignmentsSkipped += 1;
      }
      const configResult = await ensurePublishedMarketingConfig(tx, {
        tenantId: tenant.id,
        eventId: event.id,
        actorUserId,
        eventKey,
        brand,
      });
      if (configResult === 'published') report.configsPublished += 1;
      else report.configsSkipped += 1;
      return eventCreated;
    });
    report.events.push({
      id: event.id,
      slug: event.slug,
      tenantId: tenant.id,
      created,
    });
  }

  return report;
}
