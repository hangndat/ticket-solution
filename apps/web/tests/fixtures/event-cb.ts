/**
 * Explicit C-B fixtures mirrored from packages/contracts fixtures/examples.ts.
 * Typed against @ticket/contracts — not live acceptance evidence.
 */

import type {
  AssetFinalizeResponse,
  ConfigPreviewResponse,
  ConfigRollbackBody,
  ConfigRollbackResponse,
  ConfigVersionListPage,
  EventConfigPayload,
} from '@ticket/contracts';
import {
  ASSET_LIMITS,
  CONFIG_ENDPOINTS,
  CONFIG_ROLLBACK_COMMAND,
  EVENT_CONTENT_SECTION_KINDS,
} from '@ticket/contracts';

export const fixtureCbCommands = {
  rollback: CONFIG_ROLLBACK_COMMAND,
} as const;

export const fixtureCbEndpoints = CONFIG_ENDPOINTS;

export const fixtureCbAssetLimits = ASSET_LIMITS;

export const fixtureConfigPayload: EventConfigPayload = {
  schemaVersion: 1,
  brand: {
    primaryColor: '#0B3D2E',
    organizationName: 'Example Org',
  },
  sections: [
    {
      kind: 'hero',
      id: 'hero-1',
      visible: true,
      order: 0,
      body: { title: 'Welcome', text: 'Hello guests' },
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
      body: { title: 'Redeem', text: 'Use your code' },
    },
    {
      kind: 'guide',
      id: 'guide-1',
      visible: false,
      order: 3,
      body: { title: 'Guide', text: '' },
    },
    {
      kind: 'faq',
      id: 'faq-1',
      visible: true,
      order: 4,
      body: {
        title: 'FAQ',
        items: [{ question: 'When?', answer: 'Saturday' }],
      },
    },
    {
      kind: 'terms',
      id: 'terms-1',
      visible: true,
      order: 5,
      body: { title: 'Terms', termsVersion: 'terms-v1', text: 'Be kind' },
    },
  ],
  formDefinitionId: 'form-v1',
  termsVersion: 'terms-v1',
};

export const fixtureConfigPreview: ConfigPreviewResponse = {
  eventId: '11111111-1111-4111-8111-111111111111',
  version: 2,
  schemaVersion: 1,
  payload: fixtureConfigPayload,
  cacheControl: 'no-store',
};

export const fixtureConfigHistory: ConfigVersionListPage = {
  items: [
    {
      version: 2,
      schemaVersion: 1,
      authorUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      createdAt: '2026-10-17T08:00:00.000Z',
      published: true,
      publishedAt: '2026-10-17T08:05:00.000Z',
    },
    {
      version: 1,
      schemaVersion: 1,
      authorUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      createdAt: '2026-10-17T07:00:00.000Z',
      published: false,
      publishedAt: null,
    },
  ],
  nextCursor: null,
};

export const fixtureRollbackBody: ConfigRollbackBody = {
  targetVersion: 1,
  expectedPublishedVersion: 2,
  expectedRevision: 3,
};

export const fixtureRollbackResponse: ConfigRollbackResponse = {
  newVersion: 3,
  publishedVersion: 3,
  sourceVersion: 1,
  revision: 4,
  replayed: false,
};

export const fixtureAssetReady: AssetFinalizeResponse = {
  assetId: '33333333-3333-4333-8333-333333333333',
  status: 'READY',
  widthPx: 1200,
  heightPx: 630,
  byteLength: 102_400,
  contentType: 'image/png',
};

export const fixtureSectionKinds = EVENT_CONTENT_SECTION_KINDS;
