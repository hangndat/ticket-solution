/**
 * C-B — Typed event content / config / assets / rollback.
 * Reuses PublicEvent brand shape; does not fork a second public catalog schema.
 */

import type { CursorPage } from './common';
import type { FormDefinition } from './redemption-forms';

/** Fixed section kinds (MVP allowlist — no arbitrary HTML/CSS/JS). */
export const EVENT_CONTENT_SECTION_KINDS = [
  'hero',
  'info',
  'redeem',
  'guide',
  'faq',
  'terms',
] as const;

export type EventContentSectionKind =
  (typeof EVENT_CONTENT_SECTION_KINDS)[number];

export const ASSET_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  maxWidthPx: 4096,
  maxHeightPx: 4096,
  maxPixels: 16_000_000,
  maxAssetsPerEvent: 20,
  allowedMime: ['image/png', 'image/jpeg', 'image/webp'] as const,
} as const;

export type AssetMime = (typeof ASSET_LIMITS.allowedMime)[number];
export type AssetStatus = 'QUARANTINE' | 'READY' | 'REJECTED';

export interface EventBrandSnapshot {
  primaryColor: string;
  organizationName: string;
  logoAssetId?: string;
  bannerAssetId?: string;
}

export interface EventContentSection {
  kind: EventContentSectionKind;
  /** Stable id within the version payload. */
  id: string;
  visible: boolean;
  /** Order among visible+hidden sections (lower first). */
  order: number;
  /** Plain / allowlisted rich-text payload keyed by section kind. */
  body: Record<string, unknown>;
}

/** Immutable typed config payload (schemaVersion allowlisted by server). */
export interface EventConfigPayload {
  schemaVersion: number;
  brand: EventBrandSnapshot;
  sections: EventContentSection[];
  formDefinitionId?: string;
  /** Optional redeem form snapshot (C-F); stored in published config JSON. */
  form?: FormDefinition;
  termsVersion?: string;
}

export interface ConfigVersionSummary {
  version: number;
  schemaVersion: number;
  authorUserId: string;
  createdAt: string;
  published: boolean;
  publishedAt: string | null;
}

export interface ConfigVersionListPage extends CursorPage<ConfigVersionSummary> {}

export interface ConfigPreviewResponse {
  eventId: string;
  version: number;
  schemaVersion: number;
  payload: EventConfigPayload;
  /** Always no-store; authenticated event.config. */
  cacheControl: 'no-store';
}

export interface ConfigRollbackBody {
  targetVersion: number;
  expectedPublishedVersion: number;
  expectedRevision: number;
}

/**
 * Semantic rollback: creates a NEW append-only version copying validated
 * payload from target, then publishes atomically. Does not rewind history.
 */
export interface ConfigRollbackResponse {
  newVersion: number;
  publishedVersion: number;
  sourceVersion: number;
  revision: number;
  replayed: boolean;
}

export interface AssetUploadInitBody {
  filename: string;
  contentType: AssetMime;
  byteLength: number;
}

export interface AssetUploadInitResponse {
  assetId: string;
  /** Server-minted private quarantine object key — client uploads via returned URL. */
  uploadUrl: string;
  expiresAt: string;
}

export interface AssetFinalizeBody {
  assetId: string;
}

export interface AssetFinalizeResponse {
  assetId: string;
  status: AssetStatus;
  widthPx: number;
  heightPx: number;
  byteLength: number;
  contentType: AssetMime;
}

export const CONFIG_FEATURE_ERROR_CODES = {
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  EVENT_CLOSED: 'EVENT_CLOSED',
  CONFIG_PAYLOAD_REQUIRED: 'CONFIG_PAYLOAD_REQUIRED',
  CONFIG_VERSION_NOT_FOUND: 'CONFIG_VERSION_NOT_FOUND',
  CONFIG_VERSION_MISMATCH: 'CONFIG_VERSION_MISMATCH',
  CONFIG_SCHEMA_UNSUPPORTED: 'CONFIG_SCHEMA_UNSUPPORTED',
  CONFIG_INCOMPATIBLE: 'CONFIG_INCOMPATIBLE',
  ALREADY_PUBLISHED: 'ALREADY_PUBLISHED',
  REVISION_CONFLICT: 'REVISION_CONFLICT',
  ASSET_NOT_FOUND: 'ASSET_NOT_FOUND',
  ASSET_NOT_READY: 'ASSET_NOT_READY',
  ASSET_INVALID: 'ASSET_INVALID',
  ASSET_LIMIT: 'ASSET_LIMIT',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
} as const;

export type ConfigFeatureErrorCode =
  (typeof CONFIG_FEATURE_ERROR_CODES)[keyof typeof CONFIG_FEATURE_ERROR_CODES];

export const CONFIG_ENDPOINTS = {
  saveVersion: 'POST /tenants/:tenantId/events/:eventId/config-versions',
  listVersions: 'GET /tenants/:tenantId/events/:eventId/config-versions',
  preview: 'GET /tenants/:tenantId/events/:eventId/config-versions/:version/preview',
  publish: 'POST /tenants/:tenantId/events/:eventId/publish',
  rollback: 'POST /tenants/:tenantId/events/:eventId/config/rollback',
  assetInit: 'POST /tenants/:tenantId/events/:eventId/assets/upload-init',
  assetFinalize: 'POST /tenants/:tenantId/events/:eventId/assets/finalize',
} as const;
