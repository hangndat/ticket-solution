/**
 * Allowlist parsers for C-B admin BFF bodies — no generic JSON passthrough.
 */

import type {
  AssetFinalizeBody,
  AssetUploadInitBody,
  ConfigRollbackBody,
  EventConfigPayload,
} from '@ticket/contracts';
import { ASSET_LIMITS } from '@ticket/contracts';
import { bffApiError } from '../bff/api-error';
import { isUuid } from '../bff/ids';
import { buildRollbackBody } from './config-api';
import { isAllowedAssetMime, validateAssetFile } from './config-assets';
import { parseConfigPayload } from './config-schema';
import type { AdminScope } from './scope';

export function requireConfigScope(body: {
  tenantId?: string;
  eventId?: string;
}): Response | AdminScope {
  const tenantId = body.tenantId?.trim() ?? '';
  const eventId = body.eventId?.trim() ?? '';
  if (!isUuid(tenantId) || !isUuid(eventId)) {
    return bffApiError(
      'SCOPE_REQUIRED',
      'tenantId and eventId must be UUIDs.',
      422,
    );
  }
  return { tenantId, eventId };
}

export function requireIdempotencyKey(
  raw: string | undefined,
): Response | string {
  const key = raw?.trim() ?? '';
  if (!isUuid(key)) {
    return bffApiError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'idempotencyKey must be a UUID.',
      422,
    );
  }
  return key;
}

export function parseTypedConfigPayload(
  raw: unknown,
): Response | EventConfigPayload {
  const parsed = parseConfigPayload(raw);
  if (!parsed.ok) {
    const first = parsed.issues[0];
    return bffApiError(
      first?.code ?? 'CONFIG_PAYLOAD_REQUIRED',
      first?.message ?? 'payload object is invalid.',
      422,
    );
  }
  return parsed.payload;
}

export function parseRollbackBody(
  body: Record<string, unknown>,
): Response | ConfigRollbackBody {
  for (const key of [
    'targetVersion',
    'expectedPublishedVersion',
    'expectedRevision',
  ] as const) {
    const value = body[key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      return bffApiError(
        'INVALID_INPUT',
        `${key} must be a non-negative integer.`,
        422,
      );
    }
  }
  if (
    (body.targetVersion as number) < 1 ||
    (body.expectedPublishedVersion as number) < 1
  ) {
    return bffApiError(
      'INVALID_INPUT',
      'targetVersion and expectedPublishedVersion must be >= 1.',
      422,
    );
  }
  return buildRollbackBody({
    targetVersion: body.targetVersion as number,
    expectedPublishedVersion: body.expectedPublishedVersion as number,
    expectedRevision: body.expectedRevision as number,
  });
}

export function parseAssetInitBody(
  body: Record<string, unknown>,
): Response | AssetUploadInitBody {
  const filename =
    typeof body.filename === 'string' ? body.filename : undefined;
  const contentType =
    typeof body.contentType === 'string' ? body.contentType : undefined;
  const byteLength =
    typeof body.byteLength === 'number' ? body.byteLength : undefined;
  if (!filename || !contentType || byteLength === undefined) {
    return bffApiError(
      'ASSET_INVALID',
      'filename, contentType, and byteLength are required.',
      422,
    );
  }
  if (!isAllowedAssetMime(contentType)) {
    return bffApiError(
      'ASSET_INVALID',
      `contentType must be one of ${ASSET_LIMITS.allowedMime.join(',')}.`,
      422,
    );
  }
  const validated = validateAssetFile({
    name: filename,
    type: contentType,
    size: byteLength,
  });
  if (!validated.ok) {
    return bffApiError(validated.error.code, validated.error.message, 422);
  }
  return validated.body;
}

export function parseAssetFinalizeBody(
  body: Record<string, unknown>,
): Response | AssetFinalizeBody {
  const assetId =
    typeof body.assetId === 'string' ? body.assetId.trim() : '';
  if (!isUuid(assetId)) {
    return bffApiError('ASSET_INVALID', 'assetId must be a UUID.', 422);
  }
  return { assetId };
}

export function parsePreviewVersionParam(raw: string): Response | number {
  const version = Number(raw);
  if (!Number.isInteger(version) || version < 1) {
    return bffApiError(
      'CONFIG_VERSION_REQUIRED',
      'version must be a positive integer.',
      422,
    );
  }
  return version;
}
