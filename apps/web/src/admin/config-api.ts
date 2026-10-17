/**
 * C-B upstream paths + response interpreters (fixtures / live BFF).
 */

import {
  CONFIG_ENDPOINTS,
  CONFIG_FEATURE_ERROR_CODES,
  CONFIG_ROLLBACK_COMMAND,
  type AssetFinalizeResponse,
  type AssetUploadInitResponse,
  type ConfigPreviewResponse,
  type ConfigRollbackBody,
  type ConfigRollbackResponse,
  type ConfigVersionListPage,
  type ConfigVersionSummary,
  type EventConfigPayload,
} from '@ticket/contracts';
import type { AdminScope } from './scope';
import { eventPath } from './scope';
import { parseConfigPayload } from './config-schema';

export const CONFIG_PREVIEW_UNKNOWN =
  'Kết quả xem trước chưa biết. Không coi là đã tải bản render.';

export const CONFIG_HISTORY_UNKNOWN =
  'Kết quả lịch sử chưa biết. Không coi là danh sách phiên bản.';

export const CONFIG_ROLLBACK_UNKNOWN =
  'Kết quả rollback chưa biết. Không coi là đã rollback.';

export const CONFIG_ASSET_UNKNOWN =
  'Kết quả upload chưa biết. Không coi asset đã READY.';

export function configVersionsUpstreamPath(scope: AdminScope): string {
  return eventPath(scope, 'config-versions');
}

export function configPreviewUpstreamPath(
  scope: AdminScope,
  version: number,
): string {
  return eventPath(scope, `config-versions/${version}/preview`);
}

export function configRollbackUpstreamPath(scope: AdminScope): string {
  return eventPath(scope, 'config/rollback');
}

export function assetUploadInitUpstreamPath(scope: AdminScope): string {
  return eventPath(scope, 'assets/upload-init');
}

export function assetFinalizeUpstreamPath(scope: AdminScope): string {
  return eventPath(scope, 'assets/finalize');
}

/** Assert path helpers match frozen CONFIG_ENDPOINTS templates. */
export function configEndpointTemplates(): typeof CONFIG_ENDPOINTS {
  return CONFIG_ENDPOINTS;
}

export function configRollbackCommand(): typeof CONFIG_ROLLBACK_COMMAND {
  return CONFIG_ROLLBACK_COMMAND;
}

function record(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  return json as Record<string, unknown>;
}

function rejection(
  body: Record<string, unknown> | null,
): { kind: 'rejected'; code: string; message: string } | null {
  if (!body || typeof body.code !== 'string') return null;
  const message =
    typeof body.message === 'string' && body.message.trim()
      ? body.message
      : body.code;
  return { kind: 'rejected', code: body.code, message };
}

export type ConfigPreviewView =
  | { kind: 'preview'; preview: ConfigPreviewResponse }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export type ConfigHistoryView =
  | { kind: 'list'; page: ConfigVersionListPage }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export type ConfigRollbackView =
  | { kind: 'rolled_back'; result: ConfigRollbackResponse }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export type AssetInitView =
  | { kind: 'init'; result: AssetUploadInitResponse }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export type AssetFinalizeView =
  | { kind: 'ready'; result: AssetFinalizeResponse }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

function parseVersionSummary(value: unknown): ConfigVersionSummary | null {
  const row = record(value);
  if (!row) return null;
  if (typeof row.version !== 'number' || !Number.isInteger(row.version)) {
    return null;
  }
  if (
    typeof row.schemaVersion !== 'number' ||
    typeof row.authorUserId !== 'string' ||
    typeof row.createdAt !== 'string' ||
    typeof row.published !== 'boolean'
  ) {
    return null;
  }
  if (row.publishedAt !== null && typeof row.publishedAt !== 'string') {
    return null;
  }
  return {
    version: row.version,
    schemaVersion: row.schemaVersion,
    authorUserId: row.authorUserId,
    createdAt: row.createdAt,
    published: row.published,
    publishedAt: row.publishedAt as string | null,
  };
}

export function parseConfigPreview(json: unknown): ConfigPreviewResponse | null {
  const body = record(json);
  if (!body) return null;
  if (typeof body.eventId !== 'string' || typeof body.version !== 'number') {
    return null;
  }
  if (typeof body.schemaVersion !== 'number') return null;
  if (body.cacheControl !== 'no-store') return null;
  const parsed = parseConfigPayload(body.payload);
  if (!parsed.ok) return null;
  return {
    eventId: body.eventId,
    version: body.version,
    schemaVersion: body.schemaVersion,
    payload: parsed.payload,
    cacheControl: 'no-store',
  };
}

export function interpretConfigPreview(
  status: number,
  json: unknown,
  networkError: boolean,
): ConfigPreviewView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: CONFIG_PREVIEW_UNKNOWN };
  }
  if (status === 200) {
    const preview = parseConfigPreview(json);
    if (preview) return { kind: 'preview', preview };
  }
  const rejected = rejection(record(json));
  if (rejected) return rejected;
  return { kind: 'unknown', message: CONFIG_PREVIEW_UNKNOWN };
}

export function interpretConfigHistory(
  status: number,
  json: unknown,
  networkError: boolean,
): ConfigHistoryView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: CONFIG_HISTORY_UNKNOWN };
  }
  if (status === 200) {
    const body = record(json);
    if (body && Array.isArray(body.items)) {
      const items: ConfigVersionSummary[] = [];
      for (const item of body.items) {
        const row = parseVersionSummary(item);
        if (!row) {
          return { kind: 'unknown', message: CONFIG_HISTORY_UNKNOWN };
        }
        items.push(row);
      }
      const nextCursor =
        body.nextCursor === null || typeof body.nextCursor === 'string'
          ? (body.nextCursor as string | null)
          : null;
      return {
        kind: 'list',
        page: { items, nextCursor },
      };
    }
  }
  const rejected = rejection(record(json));
  if (rejected) return rejected;
  return { kind: 'unknown', message: CONFIG_HISTORY_UNKNOWN };
}

export function buildRollbackBody(input: {
  targetVersion: number;
  expectedPublishedVersion: number;
  expectedRevision: number;
}): ConfigRollbackBody {
  return {
    targetVersion: input.targetVersion,
    expectedPublishedVersion: input.expectedPublishedVersion,
    expectedRevision: input.expectedRevision,
  };
}

export function interpretConfigRollback(
  status: number,
  json: unknown,
  networkError: boolean,
): ConfigRollbackView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: CONFIG_ROLLBACK_UNKNOWN };
  }
  if (status === 200 || status === 201) {
    const body = record(json);
    if (
      body &&
      typeof body.newVersion === 'number' &&
      typeof body.publishedVersion === 'number' &&
      typeof body.sourceVersion === 'number' &&
      typeof body.revision === 'number' &&
      typeof body.replayed === 'boolean'
    ) {
      return {
        kind: 'rolled_back',
        result: {
          newVersion: body.newVersion,
          publishedVersion: body.publishedVersion,
          sourceVersion: body.sourceVersion,
          revision: body.revision,
          replayed: body.replayed,
        },
      };
    }
  }
  const rejected = rejection(record(json));
  if (rejected) return rejected;
  return { kind: 'unknown', message: CONFIG_ROLLBACK_UNKNOWN };
}

export function interpretAssetInit(
  status: number,
  json: unknown,
  networkError: boolean,
): AssetInitView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: CONFIG_ASSET_UNKNOWN };
  }
  if (status === 200 || status === 201) {
    const body = record(json);
    if (
      body &&
      typeof body.assetId === 'string' &&
      typeof body.uploadUrl === 'string' &&
      typeof body.expiresAt === 'string'
    ) {
      return {
        kind: 'init',
        result: {
          assetId: body.assetId,
          uploadUrl: body.uploadUrl,
          expiresAt: body.expiresAt,
        },
      };
    }
  }
  const rejected = rejection(record(json));
  if (rejected) return rejected;
  return { kind: 'unknown', message: CONFIG_ASSET_UNKNOWN };
}

export function interpretAssetFinalize(
  status: number,
  json: unknown,
  networkError: boolean,
): AssetFinalizeView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: CONFIG_ASSET_UNKNOWN };
  }
  if (status === 200 || status === 201) {
    const body = record(json);
    if (
      body &&
      typeof body.assetId === 'string' &&
      (body.status === 'READY' ||
        body.status === 'QUARANTINE' ||
        body.status === 'REJECTED') &&
      typeof body.widthPx === 'number' &&
      typeof body.heightPx === 'number' &&
      typeof body.byteLength === 'number' &&
      typeof body.contentType === 'string'
    ) {
      if (body.status !== 'READY') {
        return {
          kind: 'rejected',
          code: CONFIG_FEATURE_ERROR_CODES.ASSET_NOT_READY,
          message: `Asset status ${body.status}.`,
        };
      }
      return {
        kind: 'ready',
        result: {
          assetId: body.assetId,
          status: 'READY',
          widthPx: body.widthPx,
          heightPx: body.heightPx,
          byteLength: body.byteLength,
          contentType: body.contentType as AssetFinalizeResponse['contentType'],
        },
      };
    }
  }
  const rejected = rejection(record(json));
  if (rejected) return rejected;
  return { kind: 'unknown', message: CONFIG_ASSET_UNKNOWN };
}

export function configPreviewLabel(view: ConfigPreviewView): string {
  if (view.kind === 'preview') {
    return `Xem trước phiên bản ${view.preview.version} (no-store).`;
  }
  if (view.kind === 'rejected') return `${view.code}: ${view.message}`;
  return view.message;
}

export function configHistoryLabel(view: ConfigHistoryView): string {
  if (view.kind === 'list') {
    return `Lịch sử: ${view.page.items.length} phiên bản.`;
  }
  if (view.kind === 'rejected') return `${view.code}: ${view.message}`;
  return view.message;
}

export function configRollbackLabel(view: ConfigRollbackView): string {
  if (view.kind === 'rolled_back') {
    const replay = view.result.replayed ? ' (replay)' : '';
    return `Đã rollback → phiên bản mới ${view.result.newVersion} từ nguồn ${view.result.sourceVersion}.${replay}`;
  }
  if (view.kind === 'rejected') return `${view.code}: ${view.message}`;
  return view.message;
}

/** Local rendered preview model (does not call network). */
export type LocalRenderedPreview = {
  source: 'draft' | 'version';
  version: number | null;
  payload: EventConfigPayload;
  cacheControl: 'no-store';
};

export function localDraftPreview(
  payload: EventConfigPayload,
): LocalRenderedPreview {
  return {
    source: 'draft',
    version: null,
    payload,
    cacheControl: 'no-store',
  };
}

export function localVersionPreview(
  version: number,
  payload: EventConfigPayload,
): LocalRenderedPreview {
  return {
    source: 'version',
    version,
    payload,
    cacheControl: 'no-store',
  };
}
