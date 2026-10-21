/**
 * D9 multi-tenant demo seed (fixture). Idempotent upsert by stable UUIDs.
 * Demo marker `· Demo` is only on event.name; org/venue/source/marketing copy
 * look production-like. Never production identities or real secrets.
 * ADR-19: also publishes marketing config (hero/info/faq) for public catalog.
 * Re-seed skips published marketing unless forceRepublishMarketing /
 * D9_DEMO_FORCE_MARKETING=1.
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
import { loadPublishedFormTerms } from './published-form';
import { withTenant } from './tenant-context';

const DEMO_MARKER = '· Demo';

/** Published terms version for all D9 demo events — redeem must send this + termsAccepted. */
export const D9_DEMO_PUBLISHED_TERMS_VERSION = 'terms-v1';

/**
 * Known pre-rebrand D9 tenant slugs (Fun Fest → MFest).
 * Migration is fail-closed: only these UUID + old-slug pairs may rename.
 * Arbitrary slug drift on the same UUID still throws.
 */
export const D9_LEGACY_TENANT_SLUGS: Readonly<Record<string, readonly string[]>> =
  {
    'd9d9f001-0001-4000-8000-000000000001': ['demo-fun'],
  };

/** Stable fixture UUIDs — see docs/demo/D9-DEMO-DATASET.md */
export const D9_DEMO = {
  marker: DEMO_MARKER,
  tenants: {
    mfest: {
      id: 'd9d9f001-0001-4000-8000-000000000001',
      slug: 'mfest-demo',
      // Org name has no · Demo — event.name alone carries the marker (avoids «MFest · Demo · Demo» in UI).
      name: 'MFest',
    },
    studio: {
      id: 'd9d9f001-0001-4000-8000-000000000002',
      slug: 'demo-studio',
      name: 'Studio Organization',
    },
  },
  events: {
    mfest: {
      id: 'd9d9f001-0002-4000-8000-000000000001',
      tenantKey: 'mfest' as const,
      slug: 'mfest',
      name: `MFest ${DEMO_MARKER}`,
      venueName: 'Bến Bạch Đằng, TP. Hồ Chí Minh',
      startsAt: new Date('2027-03-20T10:00:00+07:00'),
      ticketTypeId: 'd9d9f001-0003-4000-8000-000000000001',
      sourceId: 'd9d9f001-0004-4000-8000-000000000001',
      sourceName: 'VIP Pass',
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
      venueName: 'The Factory Contemporary Arts Centre, TP. Hồ Chí Minh',
      startsAt: new Date('2027-04-10T18:00:00+07:00'),
      ticketTypeId: 'd9d9f001-0003-4000-8000-000000000002',
      sourceId: 'd9d9f001-0004-4000-8000-000000000002',
      sourceName: 'General Admission',
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
  /** Redeem consent for published marketing terms (both demo events). */
  termsVersion: D9_DEMO_PUBLISHED_TERMS_VERSION,
  /** Primary attendee UAT redeem code (mfest-demo / mfest). */
  attendeeDemoCode: 'DEMO-MFEST-001',
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
      'A little louder. A little brighter. A day of live music, creative encounters and moments worth sharing along the Saigon riverfront.',
    highlights: [
      'Live sounds, all afternoon',
      'Independent makers & creative spaces',
      'Room to meet, move and explore',
    ],
    doors: 'Doors open at 10:00. Last entry 30 minutes before closing.',
    redeemHint:
      'Enter the redemption code from your confirmation email or ticket purchase on the Redeem page, then sign in to add the ticket to your wallet.',
  },
  studioNight: {
    category: 'Design / Ideas / Conversation',
    description:
      'Make space for a different perspective. An intimate gathering for people shaping what comes next in design and making.',
    highlights: [
      'Conversations with working designers',
      'Hands-on material explorations',
      'A shared table for fresh ideas',
    ],
    doors: 'Doors open at 18:00. Please arrive 15 minutes early for check-in.',
    redeemHint:
      'Use the code on your invitation or purchase receipt in the Redeem flow. After redeeming, your ticket appears under My Tickets.',
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
        id: 'hero',
        visible: true,
        order: 0,
        body: { title: copy.category, text: copy.description },
      },
      {
        kind: 'info',
        id: 'info',
        visible: true,
        order: 1,
        body: { title: 'Highlights', text: highlightsText },
      },
      {
        kind: 'redeem',
        id: 'redeem',
        visible: true,
        order: 2,
        body: {
          title: 'Redeem',
          text: copy.redeemHint,
        },
      },
      {
        kind: 'guide',
        id: 'guide',
        visible: false,
        order: 3,
        body: { title: 'Guide', text: '' },
      },
      {
        kind: 'faq',
        id: 'faq',
        visible: true,
        order: 4,
        body: {
          title: 'FAQ',
          items: [
            {
              question: 'What are the door times?',
              answer: copy.doors,
            },
            {
              question: 'How do I redeem my code?',
              answer: copy.redeemHint,
            },
          ],
        },
      },
      {
        kind: 'terms',
        id: 'terms',
        visible: true,
        order: 5,
        body: {
          title: 'Terms',
          termsVersion: D9_DEMO_PUBLISHED_TERMS_VERSION,
          text: 'By attending you agree to venue house rules, age and safety policies, and the organizer’s ticketing terms. Tickets are non-transferable except where the organizer permits. Photography for personal use is welcome; commercial filming requires prior approval.',
        },
      },
    ],
    termsVersion: D9_DEMO_PUBLISHED_TERMS_VERSION,
  };
}

/** Re-publish when an older published config lacks demo terms (idempotent upgrade). */
async function publishedDemoTermsNeedUpgrade(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
): Promise<boolean> {
  const published = await loadPublishedFormTerms(tx, tenantId, eventId);
  if (published.publishedConfigVersion == null) {
    return false;
  }
  const version = published.termsVersion?.trim() ?? '';
  const body = published.termsBody?.trim() ?? '';
  if (version !== D9_DEMO_PUBLISHED_TERMS_VERSION) {
    return true;
  }
  return body.length === 0;
}

async function ensurePublishedMarketingConfig(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    eventKey: keyof typeof DEMO_MARKETING;
    brand: { primaryColor: string; organizationName: string };
    /** When true, save a new config version and publish even if one already exists. */
    forceRepublish: boolean;
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
  if (
    existing[0]?.published_config_version != null &&
    !input.forceRepublish
  ) {
    const needsTermsUpgrade = await publishedDemoTermsNeedUpgrade(
      tx,
      input.tenantId,
      input.eventId,
    );
    if (!needsTermsUpgrade) {
      return 'skipped';
    }
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
  /**
   * When true, re-seed saves + publishes a new marketing config version even if
   * `published_config_version` is already set (needed after copy/venue updates).
   * CLI: `D9_DEMO_FORCE_MARKETING=1`.
   */
  forceRepublishMarketing?: boolean;
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

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = 'code' in err ? String((err as { code: unknown }).code) : '';
  if (code === 'P2002' || code === '23505') return true;
  const message = err instanceof Error ? err.message : String(err);
  return /unique|duplicate key/i.test(message);
}

async function ensureTenant(
  tx: Prisma.TransactionClient,
  tenant: { id: string; slug: string; name: string },
): Promise<boolean> {
  const byId = await tx.tenant.findUnique({ where: { id: tenant.id } });
  if (byId) {
    if (byId.slug !== tenant.slug) {
      const legacySlugs = D9_LEGACY_TENANT_SLUGS[tenant.id] ?? [];
      const isKnownRebrand = legacySlugs.includes(byId.slug);
      if (!isKnownRebrand) {
        throw new Error(
          `D9 demo tenant id ${tenant.id} exists with slug=${byId.slug}, expected ${tenant.slug}`,
        );
      }
      // Best-effort under RLS (may not see other tenants); UNIQUE(slug) is the hard gate.
      const slugOwner = await tx.tenant.findUnique({
        where: { slug: tenant.slug },
      });
      if (slugOwner && slugOwner.id !== tenant.id) {
        throw new Error(
          `D9 demo rebrand blocked: slug ${tenant.slug} already used by id=${slugOwner.id}; refuse to overwrite`,
        );
      }
      try {
        await tx.tenant.update({
          where: { id: tenant.id },
          data: {
            slug: tenant.slug,
            name: tenant.name,
            status: 'ACTIVE',
          },
        });
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new Error(
            `D9 demo rebrand blocked: slug ${tenant.slug} already used by another tenant; refuse to overwrite`,
            { cause: err },
          );
        }
        throw err;
      }
      return false;
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
  try {
    await tx.tenant.create({
      data: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        status: 'ACTIVE',
        defaultTimezone: 'Asia/Ho_Chi_Minh',
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new Error(
        `Tenant slug ${tenant.slug} already used by another tenant; refuse to overwrite non-demo id`,
        { cause: err },
      );
    }
    throw err;
  }
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
    ON CONFLICT (tenant_id, id) DO UPDATE SET
      name = EXCLUDED.name,
      updated_at = now()
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

function samePermissionSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort().join('\0');
  const right = [...b].sort().join('\0');
  return left === right;
}

async function ensureStaffAccess(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
  userId: string,
): Promise<{ membership: 'granted' | 'skipped'; assignment: 'granted' | 'skipped' }> {
  const expectedTenantPerms = [...tenantPermissionsForRole('Owner')];
  const expectedEventPerms = [...eventPermissionsForRole('Owner')];

  const existing = await tx.membership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });
  let membershipId: string;
  let membership: 'granted' | 'skipped';
  if (existing && !existing.revokedAt) {
    membershipId = existing.id;
    membership = 'skipped';
    const needsTenantPerms =
      existing.role !== 'Owner' ||
      !samePermissionSet(existing.permissions, expectedTenantPerms);
    if (needsTenantPerms) {
      await tx.membership.update({
        where: { id: existing.id },
        data: {
          role: 'Owner',
          permissions: expectedTenantPerms,
          activatedAt: existing.activatedAt ?? new Date(),
        },
      });
      membership = 'granted';
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
  let assignmentStatus: 'granted' | 'skipped' = 'skipped';
  if (assignment && !assignment.revokedAt) {
    if (!samePermissionSet(assignment.permissions, expectedEventPerms)) {
      await tx.eventAssignment.update({
        where: { id: assignment.id },
        data: {
          permissions: expectedEventPerms,
          activatedAt: assignment.activatedAt ?? new Date(),
        },
      });
      assignmentStatus = 'granted';
    }
    return { membership, assignment: assignmentStatus };
  }
  if (assignment?.revokedAt) {
    await tx.eventAssignment.update({
      where: { id: assignment.id },
      data: {
        permissions: expectedEventPerms,
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
      permissions: expectedEventPerms,
      activatedAt: new Date(),
    },
  });
  return { membership, assignment: 'granted' };
}

/**
 * Idempotent D9 demo seed. Safe to re-run. Marks all rows as fixture/demo.
 * Venue / event / tenant fields always upsert. Published marketing config is
 * skipped when already present unless `forceRepublishMarketing` is set
 * (ops: `D9_DEMO_FORCE_MARKETING=1 ./scripts/d9-demo-seed.sh`).
 */
export async function seedD9DemoDataset(
  db: PrismaClient,
  hmac: CodeHmacConfig,
  options: D9DemoSeedOptions,
): Promise<D9DemoSeedReport> {
  const issuer = options.oidcIssuer.replace(/\/$/, '');
  const forceRepublishMarketing = options.forceRepublishMarketing === true;
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
        forceRepublish: forceRepublishMarketing,
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
