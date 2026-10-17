/**
 * C-B event asset quarantine init/finalize — magic bytes + sharp decode/re-encode.
 * No SVG/HTML/external fetch. Client MIME is never trusted as proof.
 */
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import {
  ASSET_LIMITS,
  type AssetFinalizeResponse,
  type AssetMime,
  type AssetUploadInitBody,
  type AssetUploadInitResponse,
} from '@ticket/contracts';
import type { Prisma } from './generated/prisma/client';
import { ConfigError, CONFIG_ERROR_CODES } from './config-error';
import { requireTenantPermission } from './membership';
import type { ObjectStore } from './minio';

const PERMISSION_CONFIG = 'event.config';
const ALLOWED_MIME = new Set<string>(ASSET_LIMITS.allowedMime);

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

function looksLikeWebp(buf: Buffer): boolean {
  return (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}

function detectRasterMime(buf: Buffer): AssetMime | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_MAGIC)) return 'image/png';
  if (buf.length >= 3 && buf.subarray(0, 3).equals(JPEG_MAGIC)) return 'image/jpeg';
  if (looksLikeWebp(buf)) return 'image/webp';
  return null;
}

function looksLikeHtmlOrSvg(buf: Buffer): boolean {
  const head = buf
    .subarray(0, Math.min(buf.length, 256))
    .toString('utf8')
    .toLowerCase()
    .trimStart();
  return (
    head.startsWith('<!doctype') ||
    head.startsWith('<html') ||
    head.startsWith('<svg') ||
    head.startsWith('<?xml') ||
    head.includes('<script')
  );
}

function extensionForMime(mime: AssetMime): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  return 'png';
}

function quarantineKey(
  tenantId: string,
  eventId: string,
  assetId: string,
): string {
  return `tenants/${tenantId}/events/${eventId}/assets/quarantine/${assetId}`;
}

function readyKey(
  tenantId: string,
  eventId: string,
  assetId: string,
  mime: AssetMime,
): string {
  return `tenants/${tenantId}/events/${eventId}/assets/ready/${assetId}.${extensionForMime(mime)}`;
}

async function lockEvent(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
): Promise<{ id: string; content_status: string; business_status: string }> {
  const rows = await tx.$queryRaw<
    Array<{ id: string; content_status: string; business_status: string }>
  >`
    SELECT id, content_status, business_status
    FROM events
    WHERE tenant_id = ${tenantId}::uuid AND id = ${eventId}::uuid
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row) {
    throw new ConfigError(CONFIG_ERROR_CODES.EVENT_NOT_FOUND, 'Event not found');
  }
  return row;
}

function assertEventMutable(event: {
  content_status: string;
  business_status: string;
}): void {
  if (event.content_status === 'ARCHIVED') {
    throw new ConfigError(CONFIG_ERROR_CODES.EVENT_CLOSED, 'Event is archived');
  }
  if (event.business_status === 'CANCELLED') {
    throw new ConfigError(CONFIG_ERROR_CODES.EVENT_CLOSED, 'Event is cancelled');
  }
}

export function assertAssetInitBody(body: AssetUploadInitBody): AssetUploadInitBody {
  const filename = body.filename?.trim() ?? '';
  if (!filename || filename.length > 255) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.ASSET_INVALID,
      'filename is required (max 255)',
    );
  }
  const lower = filename.toLowerCase();
  if (
    lower.endsWith('.svg') ||
    lower.endsWith('.html') ||
    lower.endsWith('.htm') ||
    lower.endsWith('.js') ||
    lower.endsWith('.css') ||
    lower.endsWith('.xml')
  ) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.ASSET_INVALID,
      'Only PNG/JPEG/WebP rasters are allowed',
    );
  }
  const contentType = body.contentType?.trim().toLowerCase() ?? '';
  if (!ALLOWED_MIME.has(contentType)) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.ASSET_INVALID,
      'contentType must be image/png|jpeg|webp',
    );
  }
  if (!Number.isInteger(body.byteLength) || body.byteLength <= 0) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.ASSET_INVALID,
      'byteLength must be a positive integer',
    );
  }
  if (body.byteLength > ASSET_LIMITS.maxBytes) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.ASSET_LIMIT,
      `Asset exceeds ${ASSET_LIMITS.maxBytes} bytes`,
    );
  }
  return {
    filename,
    contentType: contentType as AssetMime,
    byteLength: body.byteLength,
  };
}

export async function initEventAssetUpload(
  tx: Prisma.TransactionClient,
  store: ObjectStore,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    body: AssetUploadInitBody;
  },
): Promise<AssetUploadInitResponse> {
  const body = assertAssetInitBody(input.body);
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_CONFIG,
    eventId: input.eventId,
  });
  const event = await lockEvent(tx, input.tenantId, input.eventId);
  assertEventMutable(event);

  const countRows = await tx.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*)::bigint AS n
    FROM event_assets
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND status IN ('QUARANTINE', 'READY')
  `;
  const count = Number(countRows[0]?.n ?? 0);
  if (count >= ASSET_LIMITS.maxAssetsPerEvent) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.ASSET_LIMIT,
      `At most ${ASSET_LIMITS.maxAssetsPerEvent} assets per event`,
    );
  }

  const assetId = randomUUID();
  const key = quarantineKey(input.tenantId, input.eventId, assetId);
  await tx.$executeRaw`
    INSERT INTO event_assets (
      tenant_id, event_id, id, status, quarantine_key, original_filename,
      content_type, byte_length, created_by
    ) VALUES (
      ${input.tenantId}::uuid,
      ${input.eventId}::uuid,
      ${assetId}::uuid,
      'QUARANTINE',
      ${key},
      ${body.filename},
      ${body.contentType},
      ${body.byteLength},
      ${input.actorUserId}::uuid
    )
  `;

  const signed = await store.createPresignedPutUrl({
    objectKey: key,
    contentType: body.contentType,
    expiresSeconds: 900,
  });

  return {
    assetId,
    uploadUrl: signed.uploadUrl,
    expiresAt: signed.expiresAt.toISOString(),
  };
}

export async function reencodeRasterAsset(buf: Buffer): Promise<{
  mime: AssetMime;
  widthPx: number;
  heightPx: number;
  body: Buffer;
}> {
  if (buf.length === 0 || buf.length > ASSET_LIMITS.maxBytes) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.ASSET_LIMIT,
      `Asset exceeds ${ASSET_LIMITS.maxBytes} bytes`,
    );
  }
  if (looksLikeHtmlOrSvg(buf)) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.ASSET_INVALID,
      'HTML/SVG content is not allowed',
    );
  }
  const magicMime = detectRasterMime(buf);
  if (!magicMime) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.ASSET_INVALID,
      'Unrecognized raster magic bytes',
    );
  }

  let pipeline: ReturnType<typeof sharp>;
  try {
    pipeline = sharp(buf, { failOn: 'error', sequentialRead: true });
  } catch {
    throw new ConfigError(
      CONFIG_ERROR_CODES.ASSET_INVALID,
      'Image decode failed',
    );
  }

  let meta: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
  try {
    meta = await pipeline.metadata();
  } catch {
    throw new ConfigError(
      CONFIG_ERROR_CODES.ASSET_INVALID,
      'Image metadata decode failed',
    );
  }

  const widthPx = meta.width ?? 0;
  const heightPx = meta.height ?? 0;
  if (widthPx < 1 || heightPx < 1) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.ASSET_INVALID,
      'Image dimensions missing',
    );
  }
  if (
    widthPx > ASSET_LIMITS.maxWidthPx ||
    heightPx > ASSET_LIMITS.maxHeightPx ||
    widthPx * heightPx > ASSET_LIMITS.maxPixels
  ) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.ASSET_LIMIT,
      'Image dimensions exceed caps',
    );
  }

  let out: Buffer;
  let mime: AssetMime = magicMime;
  try {
    const rotated = pipeline.rotate();
    if (magicMime === 'image/png') {
      out = await rotated.png({ compressionLevel: 9 }).toBuffer();
      mime = 'image/png';
    } else if (magicMime === 'image/jpeg') {
      out = await rotated.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
      mime = 'image/jpeg';
    } else {
      out = await rotated.webp({ quality: 85 }).toBuffer();
      mime = 'image/webp';
    }
  } catch {
    throw new ConfigError(
      CONFIG_ERROR_CODES.ASSET_INVALID,
      'Image re-encode failed',
    );
  }

  if (out.length > ASSET_LIMITS.maxBytes) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.ASSET_LIMIT,
      'Re-encoded asset exceeds size cap',
    );
  }

  return { mime, widthPx, heightPx, body: out };
}

export async function finalizeEventAssetUpload(
  tx: Prisma.TransactionClient,
  store: ObjectStore,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    assetId: string;
  },
): Promise<AssetFinalizeResponse> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_CONFIG,
    eventId: input.eventId,
  });
  const event = await lockEvent(tx, input.tenantId, input.eventId);
  assertEventMutable(event);

  const rows = await tx.$queryRaw<
    Array<{
      id: string;
      event_id: string;
      status: string;
      quarantine_key: string;
      ready_key: string | null;
      content_type: string | null;
      byte_length: number | null;
      width_px: number | null;
      height_px: number | null;
    }>
  >`
    SELECT id, event_id, status, quarantine_key, ready_key, content_type,
           byte_length, width_px, height_px
    FROM event_assets
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${input.assetId}::uuid
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row || row.event_id !== input.eventId) {
    throw new ConfigError(CONFIG_ERROR_CODES.ASSET_NOT_FOUND, 'Asset not found');
  }
  if (row.status === 'READY') {
    return {
      assetId: row.id,
      status: 'READY',
      widthPx: row.width_px!,
      heightPx: row.height_px!,
      byteLength: row.byte_length!,
      contentType: row.content_type as AssetMime,
    };
  }
  if (row.status !== 'QUARANTINE') {
    throw new ConfigError(
      CONFIG_ERROR_CODES.ASSET_INVALID,
      'Asset is not in quarantine',
    );
  }

  let raw: Buffer;
  try {
    raw = await store.getObject(row.quarantine_key);
  } catch (error) {
    if (error instanceof ConfigError) throw error;
    throw new ConfigError(
      CONFIG_ERROR_CODES.ASSET_INVALID,
      'Quarantine object missing',
    );
  }

  let encoded: Awaited<ReturnType<typeof reencodeRasterAsset>>;
  try {
    encoded = await reencodeRasterAsset(raw);
  } catch (error) {
    const reason =
      error instanceof ConfigError ? error.message : 'Asset validation failed';
    await tx.$executeRaw`
      UPDATE event_assets
      SET status = 'REJECTED',
          reject_reason = ${reason},
          finalized_at = clock_timestamp()
      WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.assetId}::uuid
    `;
    throw error instanceof ConfigError
      ? error
      : new ConfigError(CONFIG_ERROR_CODES.ASSET_INVALID, reason);
  }

  const dest = readyKey(
    input.tenantId,
    input.eventId,
    input.assetId,
    encoded.mime,
  );
  await store.putObject(dest, encoded.body, encoded.mime);
  const digest = createHash('sha256').update(encoded.body).digest('hex');

  await tx.$executeRaw`
    UPDATE event_assets
    SET status = 'READY',
        ready_key = ${dest},
        content_type = ${encoded.mime},
        byte_length = ${encoded.body.length},
        width_px = ${encoded.widthPx},
        height_px = ${encoded.heightPx},
        sha256 = ${digest},
        finalized_at = clock_timestamp(),
        reject_reason = NULL
    WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.assetId}::uuid
  `;

  return {
    assetId: input.assetId,
    status: 'READY',
    widthPx: encoded.widthPx,
    heightPx: encoded.heightPx,
    byteLength: encoded.body.length,
    contentType: encoded.mime,
  };
}

export async function assertAssetsReadyForBrand(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    logoAssetId?: string;
    bannerAssetId?: string;
  },
): Promise<void> {
  for (const [field, assetId] of [
    ['logoAssetId', input.logoAssetId],
    ['bannerAssetId', input.bannerAssetId],
  ] as const) {
    if (!assetId) continue;
    const rows = await tx.$queryRaw<
      Array<{ status: string; event_id: string }>
    >`
      SELECT status, event_id
      FROM event_assets
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${assetId}::uuid
    `;
    const row = rows[0];
    if (!row || row.event_id !== input.eventId) {
      throw new ConfigError(
        CONFIG_ERROR_CODES.ASSET_NOT_FOUND,
        `${field} asset not found for event`,
      );
    }
    if (row.status !== 'READY') {
      throw new ConfigError(
        CONFIG_ERROR_CODES.ASSET_NOT_READY,
        `${field} asset is not READY`,
      );
    }
  }
}
