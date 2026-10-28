/**
 * Epic #686 production-like pilot seed (4 org / 6 event). Idempotent by stable UUIDs
 * in namespace `686f0001-*`. No `· Demo` marker on UI fields. Staff membership is
 * granted only for existing `users` rows (OIDC login first — ADR-21).
 */
import { randomUUID } from 'node:crypto';
import type { EventConfigPayload, MembershipRole } from '@ticket/contracts';
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
import {
  eventBrandAssetIds,
  loadProdMediaManifest,
  readyObjectKey,
  tenantReadyObjectKey,
  tenantOrgLogoAsset,
  type ProdMediaAssetDef,
  type ProdMediaManifest,
} from './prod-media-manifest';

export const PROD_SEED_NAMESPACE = '686f0001-';

const ORG_KEYS = ['lucbao', 'saigon', 'hoian', 'mekong'] as const;
type OrgKey = (typeof ORG_KEYS)[number];

const STAFF_ROLES: ReadonlyArray<{
  roleKey: string;
  role: MembershipRole;
  roleNum: number;
}> = [
  { roleKey: 'owner', role: 'Owner', roleNum: 1 },
  { roleKey: 'admin', role: 'Manager', roleNum: 2 },
  { roleKey: 'support', role: 'CS', roleNum: 3 },
  { roleKey: 'door-lead', role: 'Supervisor', roleNum: 4 },
  { roleKey: 'door', role: 'Scanner', roleNum: 5 },
];

function tenantId(n: number): string {
  return `686f0001-0001-4000-8000-00000000000${n}`;
}

function eventId(n: number): string {
  return `686f0001-0002-4000-8000-00000000000${n}`;
}

function ticketTypeId(n: number): string {
  return `686f0001-0003-4000-8000-00000000000${n}`;
}

function sourceId(n: number): string {
  return `686f0001-0004-4000-8000-00000000000${n}`;
}

function quotaEventId(n: number): string {
  return `686f0001-0005-4000-8000-00000000050${n}`;
}

function quotaTypeId(n: number): string {
  return `686f0001-0005-4000-8000-00000000051${n}`;
}

function quotaSourceId(n: number): string {
  return `686f0001-0005-4000-8000-00000000052${n}`;
}

function staffEmail(orgKey: OrgKey, roleKey: string): string {
  return `hangndat+${orgKey}-${roleKey}@gmail.com`;
}

function staffUserUuid(orgNum: number, roleNum: number): string {
  const tail = `${String(orgNum).padStart(3, '0')}${String(roleNum).padStart(2, '0')}`;
  return `686f0001-0007-4000-8000-${tail.padStart(12, '0')}`;
}

function redeemCodes(prefix: string): string[] {
  return Array.from(
    { length: 10 },
    (_, i) => `${prefix}-${String(i + 1).padStart(3, '0')}`,
  );
}

/** O31 gate UUID: kind 0009, tail = eventNum (2) + gateNum (2). */
function gateId(eventNum: number, gateNum: number): string {
  const ee = String(eventNum).padStart(2, '0');
  const gg = String(gateNum).padStart(2, '0');
  return `686f0001-0009-4000-8000-00000000${ee}${gg}`;
}

const GATE_NAME_BY_COUNT: Readonly<
  Record<1 | 2 | 3, readonly { name: string; sortOrder: number }[]>
> = {
  1: [{ name: 'Cổng chính', sortOrder: 0 }],
  2: [
    { name: 'Cổng chính', sortOrder: 0 },
    { name: 'Cổng VIP', sortOrder: 1 },
  ],
  3: [
    { name: 'Cổng chính', sortOrder: 0 },
    { name: 'Cổng VIP', sortOrder: 1 },
    { name: 'Cổng phụ', sortOrder: 2 },
  ],
};

function gatesForEvent(
  eventNum: number,
  count: 1 | 2 | 3,
): readonly { id: string; name: string; sortOrder: number }[] {
  return GATE_NAME_BY_COUNT[count].map((g, i) => ({
    id: gateId(eventNum, i + 1),
    name: g.name,
    sortOrder: g.sortOrder,
  }));
}

export type ProdSeedEventDef = {
  id: string;
  orgKey: OrgKey;
  orgNum: number;
  /** Event index 1–6 (UUID segment + gate id). */
  eventNum: number;
  slug: string;
  name: string;
  venueName: string;
  startsAt: Date;
  endsAt: Date;
  ticketTypeId: string;
  ticketTypeLabel: string;
  sourceId: string;
  sourceName: string;
  eventBucketId: string;
  typeBucketId: string;
  sourceBucketId: string;
  eventQuota: number;
  rawCodes: readonly string[];
  marketingKey: string;
  /** O31: demo gate count so Scan picker covers 1 / 2 / 3. */
  gateCount: 1 | 2 | 3;
};

export const PROD_SEED = {
  namespace: PROD_SEED_NAMESPACE,
  tenants: {
    lucbao: {
      id: tenantId(1),
      slug: 'luc-bao-live',
      name: 'Lục Bảo Live',
      orgKey: 'lucbao' as const,
      orgNum: 1,
      brand: { primaryColor: '#1B4D3E', organizationName: 'Lục Bảo Live' },
    },
    saigon: {
      id: tenantId(2),
      slug: 'saigon-pulse',
      name: 'Saigon Pulse',
      orgKey: 'saigon' as const,
      orgNum: 2,
      brand: { primaryColor: '#E85D04', organizationName: 'Saigon Pulse' },
    },
    hoian: {
      id: tenantId(3),
      slug: 'heritage-hoi-an',
      name: 'Di sản Hội An',
      orgKey: 'hoian' as const,
      orgNum: 3,
      brand: { primaryColor: '#8B4513', organizationName: 'Di sản Hội An' },
    },
    mekong: {
      id: tenantId(4),
      slug: 'mekong-makers',
      name: 'Mekong Makers',
      orgKey: 'mekong' as const,
      orgNum: 4,
      brand: { primaryColor: '#2A6F97', organizationName: 'Mekong Makers' },
    },
  },
  events: {
    demAmIndie: {
      id: eventId(1),
      orgKey: 'lucbao' as const,
      orgNum: 1,
      eventNum: 1,
      slug: 'dem-am-indie',
      name: 'Đêm Nhạc Indie Lục Bảo',
      venueName: 'Nhà hát Lớn Hà Nội',
      startsAt: new Date('2026-09-05T19:30:00+07:00'),
      endsAt: new Date('2026-09-05T22:30:00+07:00'),
      ticketTypeId: ticketTypeId(1),
      ticketTypeLabel: 'Vé Thường',
      sourceId: sourceId(1),
      sourceName: 'Phát hành Website',
      eventBucketId: quotaEventId(1),
      typeBucketId: quotaTypeId(1),
      sourceBucketId: quotaSourceId(1),
      eventQuota: 120,
      rawCodes: redeemCodes('VEM-LUCBAO'),
      marketingKey: 'demAmIndie',
      gateCount: 1,
    },
    pulseAfterhours: {
      id: eventId(2),
      orgKey: 'saigon' as const,
      orgNum: 2,
      eventNum: 2,
      slug: 'pulse-afterhours',
      name: 'Pulse Afterhours',
      venueName: 'The Observatory, Quận 1, TP.HCM',
      startsAt: new Date('2026-10-18T22:00:00+07:00'),
      endsAt: new Date('2026-10-19T04:00:00+07:00'),
      ticketTypeId: ticketTypeId(2),
      ticketTypeLabel: 'Vé Cửa',
      sourceId: sourceId(2),
      sourceName: 'Đối tác Pulse Club',
      eventBucketId: quotaEventId(2),
      typeBucketId: quotaTypeId(2),
      sourceBucketId: quotaSourceId(2),
      eventQuota: 200,
      rawCodes: redeemCodes('VEM-PULSE-AH'),
      marketingKey: 'pulseAfterhours',
      gateCount: 2,
    },
    pulseRooftop: {
      id: eventId(3),
      orgKey: 'saigon' as const,
      orgNum: 2,
      eventNum: 3,
      slug: 'pulse-rooftop',
      name: 'Pulse Rooftop Session',
      venueName: 'Chill Skybar, Quận 1, TP.HCM',
      startsAt: new Date('2026-10-20T17:00:00+07:00'),
      endsAt: new Date('2026-10-22T23:59:00+07:00'),
      ticketTypeId: ticketTypeId(3),
      ticketTypeLabel: 'Vé Rooftop',
      sourceId: sourceId(3),
      sourceName: 'Phát hành Website',
      eventBucketId: quotaEventId(3),
      typeBucketId: quotaTypeId(3),
      sourceBucketId: quotaSourceId(3),
      eventQuota: 80,
      rawCodes: redeemCodes('VEM-PULSE-RT'),
      marketingKey: 'pulseRooftop',
      gateCount: 3,
    },
    phoCoDem: {
      id: eventId(4),
      orgKey: 'hoian' as const,
      orgNum: 3,
      eventNum: 4,
      slug: 'pho-co-dem',
      name: 'Phố Cổ Về Đêm',
      venueName: 'Khu phố cổ Hội An, Quảng Nam',
      startsAt: new Date('2026-10-21T18:00:00+07:00'),
      endsAt: new Date('2026-10-21T23:00:00+07:00'),
      ticketTypeId: ticketTypeId(4),
      ticketTypeLabel: 'Vé Đi bộ',
      sourceId: sourceId(4),
      sourceName: 'Quầy vé Phố cổ',
      eventBucketId: quotaEventId(4),
      typeBucketId: quotaTypeId(4),
      sourceBucketId: quotaSourceId(4),
      eventQuota: 300,
      rawCodes: redeemCodes('VEM-HOIAN-PC'),
      marketingKey: 'phoCoDem',
      gateCount: 1,
    },
    songThuWorkshop: {
      id: eventId(5),
      orgKey: 'hoian' as const,
      orgNum: 3,
      eventNum: 5,
      slug: 'song-thu-workshop',
      name: 'Workshop Sông Thu',
      venueName: 'An Nhiên Garden, Hội An',
      startsAt: new Date('2026-11-08T09:30:00+07:00'),
      endsAt: new Date('2026-11-08T16:30:00+07:00'),
      ticketTypeId: ticketTypeId(5),
      ticketTypeLabel: 'Vé Workshop',
      sourceId: sourceId(5),
      sourceName: 'Form đăng ký',
      eventBucketId: quotaEventId(5),
      typeBucketId: quotaTypeId(5),
      sourceBucketId: quotaSourceId(5),
      eventQuota: 40,
      rawCodes: redeemCodes('VEM-HOIAN-WS'),
      marketingKey: 'songThuWorkshop',
      gateCount: 2,
    },
    festivalAnSong: {
      id: eventId(6),
      orgKey: 'hoian' as const,
      orgNum: 3,
      eventNum: 6,
      slug: 'festival-an-song',
      name: 'Festival Ăn Sống Hội An',
      venueName: 'Công viên An Bàng, Hội An',
      startsAt: new Date('2027-02-14T08:00:00+07:00'),
      endsAt: new Date('2027-02-16T22:00:00+07:00'),
      ticketTypeId: ticketTypeId(6),
      ticketTypeLabel: 'Vé Ngày',
      sourceId: sourceId(6),
      sourceName: 'Early Bird Online',
      eventBucketId: quotaEventId(6),
      typeBucketId: quotaTypeId(6),
      sourceBucketId: quotaSourceId(6),
      eventQuota: 1500,
      rawCodes: redeemCodes('VEM-HOIAN-FEST'),
      marketingKey: 'festivalAnSong',
      gateCount: 3,
    },
  },
} as const;

const PROD_MARKETING: Record<
  string,
  {
    descriptionVi: string;
    descriptionEn: string;
    highlights: string[];
    redeemHint: string;
  }
> = {
  demAmIndie: {
    descriptionVi:
      'Đêm nhạc độc lập với lineup nghệ sĩ Việt — không gian intime tại Nhà hát Lớn.',
    descriptionEn:
      'An intimate indie night featuring Vietnamese artists at the Hanoi Opera House.',
    highlights: ['Lineup indie Việt', 'Không gian nhà hát', 'Check-in trước cửa'],
    redeemHint:
      'Nhập mã VEM trên trang Đổi vé, đăng nhập và thêm vé vào ví của bạn.',
  },
  pulseAfterhours: {
    descriptionVi:
      'Afterparty điện tử đến sáng — bass, ánh sáng và cộng đồng Pulse.',
    descriptionEn:
      'Electronic afterhours until dawn — bass, lights, and the Pulse community.',
    highlights: ['Bass & lights', 'Cộng đồng Pulse', 'Cửa đến 22:00'],
    redeemHint: 'Dùng mã VEM tại quầy hoặc trang Đổi vé trước khi vào cửa.',
  },
  pulseRooftop: {
    descriptionVi:
      'Sunset-to-late rooftop: house & disco trên tầng thượng Sài Gòn.',
    descriptionEn:
      'Sunset-to-late rooftop house and disco above Saigon.',
    highlights: ['House & disco', 'Sunset session', 'Rooftop view'],
    redeemHint: 'Mã VEM trên email xác nhận hoặc trang Đổi vé.',
  },
  phoCoDem: {
    descriptionVi:
      'Dạo phố cổ về đêm: ẩm thực, nghệ nhân và âm nhạc đường phố.',
    descriptionEn:
      'Old-town night walk: food, artisans, and street music.',
    highlights: ['Ẩm thực phố cổ', 'Nghệ nhân', 'Âm nhạc đường phố'],
    redeemHint: 'Đổi mã VEM tại quầy hoặc trên app trước giờ vào.',
  },
  songThuWorkshop: {
    descriptionVi: 'Buổi học làm gốm và nếm trà bên dòng Thu Bồn.',
    descriptionEn: 'Pottery and tea tasting workshop along the Thu Bon river.',
    highlights: ['Làm gốm', 'Trà Thu Bồn', 'Nhóm nhỏ'],
    redeemHint: 'Mã VEM trong email đăng ký workshop.',
  },
  festivalAnSong: {
    descriptionVi:
      'Lễ hội ẩm thực sống lành mạnh — ba ngày chef pop-up và chợ nông trại.',
    descriptionEn:
      'Three-day clean-eating festival with chef pop-ups and farm market.',
    highlights: ['Chef pop-up', 'Chợ nông trại', 'Ba ngày liên tục'],
    redeemHint: 'Early bird: mã VEM trên trang Đổi vé.',
  },
};

export type ProdSeedReport = {
  fixture: true;
  dryRun: boolean;
  tenants: Array<{ id: string; slug: string; created: boolean }>;
  events: Array<{ id: string; slug: string; tenantId: string; created: boolean }>;
  codesInserted: number;
  codesSkipped: number;
  membershipsGranted: number;
  membershipsSkipped: number;
  assignmentsGranted: number;
  assignmentsSkipped: number;
  configsPublished: number;
  configsSkipped: number;
  gatesInserted: number;
  gatesSkipped: number;
  staffEmailsMissing: string[];
  staffUserIdsByEmail: Record<string, string[]>;
};

export type ProdSeedOptions = {
  oidcIssuer: string;
  forceRepublishMarketing?: boolean;
  dryRun?: boolean;
  /**
   * When true (local tests only), create missing staff users with stable UUIDs
   * before granting membership. Production path must keep this false (ADR-21).
   */
  createMissingStaffUsers?: boolean;
};

export class ProdSeedDryRunRollback extends Error {
  constructor(public readonly report: ProdSeedReport) {
    super('PROD_SEED_DRY_RUN_ROLLBACK');
    this.name = 'ProdSeedDryRunRollback';
  }
}

/** Refuse known production database hosts — seed must run on VPS via runbook, not accidental laptop URL. */
export function assertProdSeedDatabaseHostAllowed(databaseUrl: string): void {
  const host = (() => {
    try {
      return new URL(databaseUrl).hostname.toLowerCase();
    } catch {
      throw new Error('Invalid DATABASE_URL');
    }
  })();
  const blocked = ['postgres', 'db.vemoki.com', 'api.vemoki.com'];
  if (blocked.includes(host) || host.endsWith('.vemoki.com')) {
    throw new Error(
      `Refuse prod seed: DATABASE_URL host ${host} looks like production`,
    );
  }
}

export function assertProdSeedMutateAllowed(env: NodeJS.ProcessEnv): void {
  const dry =
    env.PROD_SEED_DRY_RUN === '1' || env.PROD_SEED_DRY_RUN === 'true';
  if (dry) return;
  const confirm = env.PROD_SEED_CONFIRM?.trim();
  if (confirm !== '1' && confirm !== 'yes') {
    throw new Error(
      'Set PROD_SEED_CONFIRM=1 to run prod seed (or PROD_SEED_DRY_RUN=1 for dry-run)',
    );
  }
}

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = 'code' in err ? String((err as { code: unknown }).code) : '';
  if (code === 'P2002' || code === '23505') return true;
  const message = err instanceof Error ? err.message : String(err);
  return /unique|duplicate key/i.test(message);
}

function assertFixtureId(id: string, kind: string): void {
  if (!id.startsWith(PROD_SEED_NAMESPACE)) {
    throw new Error(`${kind} id ${id} outside prod seed namespace`);
  }
}

async function withTenantOnTx<T>(
  tx: Prisma.TransactionClient,
  tenantId: string,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  await tx.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
  await tx.$queryRaw`SELECT set_config('statement_timeout', '5000', true)`;
  return operation(tx);
}

type DbLike = PrismaClient | Prisma.TransactionClient;

async function usersByEmail(db: DbLike, email: string): Promise<string[]> {
  const rows = await db.user.findMany({
    where: { email },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function ensureStaffUserRow(
  db: DbLike,
  input: {
    issuer: string;
    userId: string;
    subject: string;
    email: string;
  },
): Promise<void> {
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
    return;
  }
  await db.user.create({
    data: {
      id: input.userId,
      issuer: input.issuer,
      subject: input.subject,
      email: input.email,
      emailVerified: true,
    },
  });
}

async function ensureReadyTenantAsset(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    asset: ProdMediaAssetDef;
    createdByUserId: string;
  },
): Promise<void> {
  assertFixtureId(input.asset.assetId, 'asset');
  const readyKey = tenantReadyObjectKey(
    input.tenantId,
    input.asset.assetId,
    input.asset.extension,
  );
  const quarantineKey = `tenants/${input.tenantId}/assets/quarantine/${input.asset.assetId}`;
  const width = input.asset.widthPx ?? 760;
  const height = input.asset.heightPx ?? 200;
  await tx.$executeRaw`
    INSERT INTO tenant_assets (
      tenant_id, id, status, quarantine_key, ready_key,
      original_filename, content_type, byte_length, width_px, height_px,
      sha256, created_by, finalized_at
    ) VALUES (
      ${input.tenantId}::uuid,
      ${input.asset.assetId}::uuid,
      'READY',
      ${quarantineKey},
      ${readyKey},
      ${input.asset.source.split('/').pop() ?? 'asset'},
      ${input.asset.contentType},
      1,
      ${width},
      ${height},
      'prod-seed-placeholder',
      ${input.createdByUserId}::uuid,
      clock_timestamp()
    )
    ON CONFLICT (tenant_id, id) DO UPDATE SET
      status = 'READY',
      ready_key = EXCLUDED.ready_key,
      content_type = EXCLUDED.content_type,
      width_px = EXCLUDED.width_px,
      height_px = EXCLUDED.height_px,
      finalized_at = clock_timestamp()
    WHERE tenant_assets.status IS DISTINCT FROM 'READY'
       OR tenant_assets.ready_key IS DISTINCT FROM EXCLUDED.ready_key
  `;
}

async function ensureReadyEventAsset(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    asset: ProdMediaAssetDef;
    createdByUserId: string;
  },
): Promise<void> {
  assertFixtureId(input.asset.assetId, 'asset');
  const readyKey = readyObjectKey(
    input.tenantId,
    input.eventId,
    input.asset.assetId,
    input.asset.extension,
  );
  const quarantineKey = `tenants/${input.tenantId}/events/${input.eventId}/assets/quarantine/${input.asset.assetId}`;
  const width = input.asset.widthPx ?? 760;
  const height = input.asset.heightPx ?? 200;
  await tx.$executeRaw`
    INSERT INTO event_assets (
      tenant_id, event_id, id, status, quarantine_key, ready_key,
      original_filename, content_type, byte_length, width_px, height_px,
      sha256, created_by, finalized_at
    ) VALUES (
      ${input.tenantId}::uuid,
      ${input.eventId}::uuid,
      ${input.asset.assetId}::uuid,
      'READY',
      ${quarantineKey},
      ${readyKey},
      ${input.asset.source.split('/').pop() ?? 'asset'},
      ${input.asset.contentType},
      1,
      ${width},
      ${height},
      'prod-seed-placeholder',
      ${input.createdByUserId}::uuid,
      clock_timestamp()
    )
    ON CONFLICT (tenant_id, id) DO UPDATE SET
      status = 'READY',
      ready_key = EXCLUDED.ready_key,
      content_type = EXCLUDED.content_type,
      width_px = EXCLUDED.width_px,
      height_px = EXCLUDED.height_px,
      finalized_at = clock_timestamp()
    WHERE event_assets.status IS DISTINCT FROM 'READY'
       OR event_assets.ready_key IS DISTINCT FROM EXCLUDED.ready_key
  `;
}

async function ensureTenant(
  tx: Prisma.TransactionClient,
  tenant: { id: string; slug: string; name: string },
  manifest: ProdMediaManifest,
): Promise<boolean> {
  assertFixtureId(tenant.id, 'tenant');
  const byId = await tx.tenant.findUnique({ where: { id: tenant.id } });
  if (byId) {
    if (byId.slug !== tenant.slug) {
      throw new Error(
        `Prod seed tenant id ${tenant.id} exists with slug=${byId.slug}, expected ${tenant.slug}`,
      );
    }
    const orgLogo = tenantOrgLogoAsset(manifest, tenant.id);
    await tx.$executeRaw`
      UPDATE tenants SET
        name = ${tenant.name},
        status = 'ACTIVE',
        logo_asset_id = COALESCE(${orgLogo?.assetId ?? null}::uuid, logo_asset_id)
      WHERE id = ${tenant.id}::uuid
    `;
    return false;
  }
  const bySlug = await tx.tenant.findUnique({ where: { slug: tenant.slug } });
  if (bySlug) {
    throw new Error(
      `Tenant slug ${tenant.slug} already used by id=${bySlug.id}; refuse to overwrite non-fixture id`,
    );
  }
  try {
    const orgLogo = tenantOrgLogoAsset(manifest, tenant.id);
    await tx.tenant.create({
      data: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        status: 'ACTIVE',
        defaultTimezone: 'Asia/Ho_Chi_Minh',
        ...(orgLogo ? { logoAssetId: orgLogo.assetId } : {}),
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new Error(
        `Tenant slug ${tenant.slug} already used by another tenant; refuse to overwrite`,
        { cause: err },
      );
    }
    throw err;
  }
  return true;
}

function eventWindowTimes(event: ProdSeedEventDef) {
  const twoHoursMs = 2 * 60 * 60 * 1000;
  const oneDayMs = 24 * 60 * 60 * 1000;
  return {
    redemptionOpens: new Date(event.startsAt.getTime() - twoHoursMs),
    redemptionCloses: new Date(event.endsAt.getTime() + oneDayMs),
    checkInOpens: new Date(event.startsAt.getTime() - twoHoursMs),
    checkInCloses: new Date(event.endsAt.getTime() + oneDayMs),
  };
}

/**
 * O31: idempotent gates for demo events (unique tenant+event+name).
 * Uses ticket_runtime + app.tenant_id via withTenant — same RLS path as createEventGate.
 */
async function ensureGates(
  tx: Prisma.TransactionClient,
  tenantId: string,
  event: ProdSeedEventDef,
): Promise<{ inserted: number; skipped: number }> {
  assertFixtureId(event.id, 'event');
  const gates = gatesForEvent(event.eventNum, event.gateCount);
  let inserted = 0;
  let skipped = 0;
  for (const gate of gates) {
    assertFixtureId(gate.id, 'gate');
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      INSERT INTO gates (tenant_id, event_id, id, name, sort_order)
      VALUES (
        ${tenantId}::uuid,
        ${event.id}::uuid,
        ${gate.id}::uuid,
        ${gate.name},
        ${gate.sortOrder}::int
      )
      ON CONFLICT (tenant_id, event_id, name) DO NOTHING
      RETURNING id
    `;
    if (rows[0]) inserted += 1;
    else skipped += 1;
  }
  return { inserted, skipped };
}

async function ensureEvent(
  tx: Prisma.TransactionClient,
  tenantId: string,
  event: ProdSeedEventDef,
  brand: {
    primaryColor: string;
    organizationName: string;
    logoAssetId?: string;
    bannerAssetId?: string;
  },
): Promise<boolean> {
  assertFixtureId(event.id, 'event');
  const brandSnapshot = {
    primaryColor: brand.primaryColor,
    organizationName: brand.organizationName,
    ...(brand.logoAssetId ? { logoAssetId: brand.logoAssetId } : {}),
    ...(brand.bannerAssetId ? { bannerAssetId: brand.bannerAssetId } : {}),
    fixture: true,
  };
  const windows = eventWindowTimes(event);
  const byId = await tx.event.findUnique({
    where: { tenantId_id: { tenantId, id: event.id } },
  });
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
        ends_at = ${event.endsAt},
        venue_name = ${event.venueName},
        redemption_opens_at = ${windows.redemptionOpens},
        redemption_closes_at = ${windows.redemptionCloses},
        check_in_opens_at = ${windows.checkInOpens},
        check_in_closes_at = ${windows.checkInCloses},
        published_brand_snapshot = ${JSON.stringify(brandSnapshot)}::jsonb
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
      visibility, timezone, starts_at, ends_at, venue_name,
      redemption_opens_at, redemption_closes_at,
      check_in_opens_at, check_in_closes_at,
      published_brand_snapshot, revision
    ) VALUES (
      ${tenantId}::uuid, ${event.id}::uuid, ${event.slug}, ${event.name},
      'PUBLISHED', 'PUBLISHED', 'ACTIVE', 'PUBLIC', 'Asia/Ho_Chi_Minh',
      ${event.startsAt}, ${event.endsAt}, ${event.venueName},
      ${windows.redemptionOpens}, ${windows.redemptionCloses},
      ${windows.checkInOpens}, ${windows.checkInCloses},
      ${JSON.stringify(brandSnapshot)}::jsonb, 1
    )
  `;
  return true;
}

async function ensureInventory(
  tx: Prisma.TransactionClient,
  hmac: CodeHmacConfig,
  tenantId: string,
  event: ProdSeedEventDef,
): Promise<{ inserted: number; skipped: number }> {
  await tx.$executeRaw`
    INSERT INTO ticket_types (
      tenant_id, event_id, id, label, entitlement_snapshot, created_at, updated_at
    ) VALUES (
      ${tenantId}::uuid, ${event.id}::uuid, ${event.ticketTypeId}::uuid,
      ${event.ticketTypeLabel}, '{"fixture":true}'::jsonb, now(), now()
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

async function ensureMembershipAndAssignment(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string | null,
  userId: string,
  role: MembershipRole,
): Promise<{ membership: 'granted' | 'skipped'; assignment: 'granted' | 'skipped' | 'n/a' }> {
  const existing = await tx.membership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });
  let membershipId: string;
  let membership: 'granted' | 'skipped';
  const tenantPerms = tenantPermissionsForRole(role);
  if (existing && !existing.revokedAt) {
    membershipId = existing.id;
    membership = 'skipped';
    if (existing.role !== role) {
      await tx.membership.update({
        where: { id: existing.id },
        data: {
          role,
          permissions: [...tenantPerms],
          activatedAt: existing.activatedAt ?? new Date(),
        },
      });
    }
  } else if (existing?.revokedAt) {
    await tx.membership.update({
      where: { id: existing.id },
      data: {
        role,
        permissions: [...tenantPerms],
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
        role,
        permissions: [...tenantPerms],
        activatedAt: new Date(),
      },
    });
    membership = 'granted';
  }

  if (!eventId) {
    return { membership, assignment: 'n/a' };
  }

  const eventPerms = eventPermissionsForRole(role);
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
        permissions: [...eventPerms],
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
      permissions: [...eventPerms],
      activatedAt: new Date(),
    },
  });
  return { membership, assignment: 'granted' };
}

function marketingPayload(
  event: ProdSeedEventDef,
  brand: {
    primaryColor: string;
    organizationName: string;
    logoAssetId?: string;
    bannerAssetId?: string;
  },
): EventConfigPayload {
  const copy = PROD_MARKETING[event.marketingKey]!;
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
        body: { title: event.name, text: copy.descriptionVi },
      },
      {
        kind: 'info',
        id: 'info',
        visible: true,
        order: 1,
        body: { title: 'Điểm nhấn', text: highlightsText },
      },
      {
        kind: 'redeem',
        id: 'redeem',
        visible: true,
        order: 2,
        body: { title: 'Đổi vé', text: copy.redeemHint },
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
          items: [
            {
              question: 'Mô tả (EN)',
              answer: copy.descriptionEn,
            },
            {
              question: 'Cách đổi vé?',
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
          title: 'Điều khoản',
          termsVersion: 'terms-v1',
          text:
            'Bạn đồng ý với quy định nhà tổ chức và điều khoản vé khi tham dự sự kiện.',
        },
      },
    ],
    termsVersion: 'terms-v1',
  };
}

async function ensurePublishedMarketingConfig(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    event: ProdSeedEventDef;
    brand: { primaryColor: string; organizationName: string };
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
    return 'skipped';
  }
  const saved = await saveEventConfigVersion(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    actorUserId: input.actorUserId,
    payload: marketingPayload(input.event, input.brand) as unknown as Record<
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

function tenantForOrgKey(orgKey: OrgKey) {
  return PROD_SEED.tenants[orgKey];
}

async function runProdSeedBody(
  db: DbLike,
  hmac: CodeHmacConfig,
  options: ProdSeedOptions,
  runWithTenant: (
    tenantId: string,
    op: (tx: Prisma.TransactionClient) => Promise<void>,
  ) => Promise<void>,
): Promise<ProdSeedReport> {
  const issuer = options.oidcIssuer.replace(/\/$/, '');
  const forceRepublishMarketing = options.forceRepublishMarketing === true;
  const staffEmailsMissing: string[] = [];
  const staffUserIdsByEmail: Record<string, string[]> = {};

  for (const orgKey of ORG_KEYS) {
    const tenant = tenantForOrgKey(orgKey);
    for (const staff of STAFF_ROLES) {
      const email = staffEmail(orgKey, staff.roleKey);
      if (options.createMissingStaffUsers) {
        const userId = staffUserUuid(tenant.orgNum, staff.roleNum);
        const subject = `prod-seed-${orgKey}-${staff.roleKey}`;
        await ensureStaffUserRow(db, {
          issuer,
          userId,
          subject,
          email,
        });
      }
      const ids = await usersByEmail(db, email);
      staffUserIdsByEmail[email] = ids;
      if (ids.length === 0) {
        staffEmailsMissing.push(email);
      }
    }
  }

  const manifest = loadProdMediaManifest();

  const report: ProdSeedReport = {
    fixture: true,
    dryRun: options.dryRun === true,
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
    gatesInserted: 0,
    gatesSkipped: 0,
    staffEmailsMissing,
    staffUserIdsByEmail,
  };

  const allTenants = Object.values(PROD_SEED.tenants);
  for (const tenant of allTenants) {
    let tenantCreated = false;
    await runWithTenant(tenant.id, async (tx) => {
      tenantCreated = await ensureTenant(tx, tenant, manifest);
    });
    report.tenants.push({
      id: tenant.id,
      slug: tenant.slug,
      created: tenantCreated,
    });
  }

  // Mekong: owner membership only (no events)
  const mekong = PROD_SEED.tenants.mekong;
  const mekongOwnerEmail = staffEmail('mekong', 'owner');
  const mekongOwnerIds = staffUserIdsByEmail[mekongOwnerEmail] ?? [];
  if (mekongOwnerIds.length > 0) {
    await runWithTenant(mekong.id, async (tx) => {
      for (const userId of mekongOwnerIds) {
        const access = await ensureMembershipAndAssignment(
          tx,
          mekong.id,
          null,
          userId,
          'Owner',
        );
        if (access.membership === 'granted') report.membershipsGranted += 1;
        else report.membershipsSkipped += 1;
      }
    });
  }

  for (const tenant of allTenants) {
    const orgLogo = tenantOrgLogoAsset(manifest, tenant.id);
    if (!orgLogo) continue;
    const ownerIds =
      staffUserIdsByEmail[staffEmail(tenant.orgKey, 'owner')] ?? [];
    const actorUserId = ownerIds[0];
    if (!actorUserId) continue;
    await runWithTenant(tenant.id, async (tx) => {
      await ensureReadyTenantAsset(tx, {
        tenantId: tenant.id,
        asset: orgLogo,
        createdByUserId: actorUserId,
      });
    });
  }

  const eventList = Object.values(PROD_SEED.events) as ProdSeedEventDef[];
  for (const event of eventList) {
    const tenant = tenantForOrgKey(event.orgKey);
    const mediaIds = eventBrandAssetIds(manifest, tenant.id, event.id);
    const brand = { ...tenant.brand, ...mediaIds };
    const staffBindings = STAFF_ROLES.map((staff) => ({
      role: staff.role,
      email: staffEmail(event.orgKey, staff.roleKey),
    }));

    let eventCreated = false;
    await runWithTenant(tenant.id, async (tx) => {
      eventCreated = await ensureEvent(tx, tenant.id, event, brand);
      const codes = await ensureInventory(tx, hmac, tenant.id, event);
      report.codesInserted += codes.inserted;
      report.codesSkipped += codes.skipped;
      const gates = await ensureGates(tx, tenant.id, event);
      report.gatesInserted += gates.inserted;
      report.gatesSkipped += gates.skipped;

      for (const binding of staffBindings) {
        const userIds = staffUserIdsByEmail[binding.email] ?? [];
        for (const userId of userIds) {
          const access = await ensureMembershipAndAssignment(
            tx,
            tenant.id,
            event.id,
            userId,
            binding.role,
          );
          if (access.membership === 'granted') report.membershipsGranted += 1;
          else report.membershipsSkipped += 1;
          if (access.assignment === 'granted') report.assignmentsGranted += 1;
          else if (access.assignment === 'skipped') report.assignmentsSkipped += 1;
        }
      }

      const ownerIds =
        staffUserIdsByEmail[staffEmail(event.orgKey, 'owner')] ?? [];
      const eventActorUserId = ownerIds[0];
      if (eventActorUserId) {
        const eventManifest = manifest.tenants
          .find((t) => t.tenantId === tenant.id)
          ?.events.find((e) => e.eventId === event.id);
        if (eventManifest) {
          for (const asset of eventManifest.assets) {
            await ensureReadyEventAsset(tx, {
              tenantId: tenant.id,
              eventId: event.id,
              asset,
              createdByUserId: eventActorUserId,
            });
          }
        }
        const configResult = await ensurePublishedMarketingConfig(tx, {
          tenantId: tenant.id,
          eventId: event.id,
          actorUserId: eventActorUserId,
          event,
          brand,
          forceRepublish: forceRepublishMarketing,
        });
        if (configResult === 'published') report.configsPublished += 1;
        else report.configsSkipped += 1;
      }

    });

    report.events.push({
      id: event.id,
      slug: event.slug,
      tenantId: tenant.id,
      created: eventCreated,
    });
  }

  return report;
}

/**
 * O31-only: ensure demo gates (1/2/3) on fixture events. Idempotent by name.
 * Prefer this for a gates-only prod apply; full seed also calls ensureGates.
 */
export async function seedProdDemoGates(
  db: PrismaClient,
): Promise<{
  gatesInserted: number;
  gatesSkipped: number;
  events: Array<{
    slug: string;
    tenantSlug: string;
    eventId: string;
    gateCount: number;
    names: string[];
    inserted: number;
    skipped: number;
  }>;
}> {
  const events: Array<{
    slug: string;
    tenantSlug: string;
    eventId: string;
    gateCount: number;
    names: string[];
    inserted: number;
    skipped: number;
  }> = [];
  let gatesInserted = 0;
  let gatesSkipped = 0;
  for (const event of Object.values(PROD_SEED.events) as ProdSeedEventDef[]) {
    const tenant = tenantForOrgKey(event.orgKey);
    const names = gatesForEvent(event.eventNum, event.gateCount).map(
      (g) => g.name,
    );
    const result = await withTenant(db, tenant.id, (tx) =>
      ensureGates(tx, tenant.id, event),
    );
    gatesInserted += result.inserted;
    gatesSkipped += result.skipped;
    events.push({
      slug: event.slug,
      tenantSlug: tenant.slug,
      eventId: event.id,
      gateCount: event.gateCount,
      names,
      inserted: result.inserted,
      skipped: result.skipped,
    });
  }
  return { gatesInserted, gatesSkipped, events };
}

/**
 * Idempotent Epic #686 prod-like seed. Re-run safe. Does not enqueue invites or print secrets.
 */
export async function seedProdDataset(
  db: PrismaClient,
  hmac: CodeHmacConfig,
  options: ProdSeedOptions,
): Promise<ProdSeedReport> {
  if (options.dryRun) {
    let report: ProdSeedReport | undefined;
    try {
      await db.$transaction(
        async (tx) => {
          report = await runProdSeedBody(
            tx,
            hmac,
            { ...options, dryRun: true },
            async (tenantId, op) => {
              await withTenantOnTx(tx, tenantId, op);
            },
          );
          throw new ProdSeedDryRunRollback(report);
        },
        { maxWait: 10_000, timeout: 120_000 },
      );
    } catch (err) {
      if (err instanceof ProdSeedDryRunRollback) {
        return err.report;
      }
      throw err;
    }
    throw new Error('prod seed dry-run: expected rollback');
  }

  return runProdSeedBody(
    db,
    hmac,
    options,
    async (tenantId, op) => {
      await withTenant(db, tenantId, op);
    },
  );
}
