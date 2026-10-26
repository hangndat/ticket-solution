import assert from 'node:assert/strict';
import test from 'node:test';
import type { EventConfigPayload } from '@ticket/contracts';
import {
  canPublishSavedVersion,
  configFieldDifferences,
  configFields,
  configSaveNoticeKey,
  hasConfigVersionConflict,
  isConfigPreview,
  mergeConfigFields,
} from '../src/prep/config-editor';

test('revision conflict identifies changed visible fields without replacing the draft', () => {
  const edited = { organizationName: 'My draft', primaryColor: '#123456', termsText: 'Old terms' };
  const latest = { organizationName: 'Server update', primaryColor: '#123456', termsText: 'New terms' };
  assert.deepEqual(configFieldDifferences(edited, latest), [
    { key: 'organizationName', edited: 'My draft', latest: 'Server update' },
    { key: 'termsText', edited: 'Old terms', latest: 'New terms' },
  ]);
  assert.equal(edited.organizationName, 'My draft');
});

test('publish requires the current saved version to be previewed with no unsaved edits', () => {
  const ready = { latestVersion: 7, previewVersion: 7, dirty: false, conflict: false };
  assert.equal(canPublishSavedVersion(ready), true);
  assert.equal(canPublishSavedVersion({ ...ready, previewVersion: 6 }), false);
  assert.equal(canPublishSavedVersion({ ...ready, dirty: true }), false);
  assert.equal(canPublishSavedVersion({ ...ready, conflict: true }), false);
  assert.equal(canPublishSavedVersion({ ...ready, latestVersion: null, previewVersion: null }), false);
});

const previous: EventConfigPayload = {
  schemaVersion: 1,
  brand: {
    organizationName: 'Original',
    primaryColor: '#123456',
    logoAssetId: 'logo-X',
    bannerAssetId: 'banner-X',
  },
  sections: [
    {
      kind: 'hero',
      id: 'hero-X',
      visible: false,
      order: 4,
      body: { title: 'Field X' },
    },
    {
      kind: 'info',
      id: 'info-X',
      visible: true,
      order: 9,
      body: { text: 'Preserve X' },
    },
    {
      kind: 'redeem',
      id: 'redeem-X',
      visible: false,
      order: 10,
      body: { title: 'Redeem' },
    },
    {
      kind: 'guide',
      id: 'guide-X',
      visible: false,
      order: 11,
      body: { title: 'Guide' },
    },
    {
      kind: 'faq',
      id: 'faq-X',
      visible: false,
      order: 12,
      body: { title: 'FAQ', items: [] },
    },
    {
      kind: 'terms',
      id: 'terms-X',
      visible: true,
      order: 13,
      body: { title: 'Terms X', text: 'Old terms', termsVersion: 'terms-X' },
    },
  ],
  termsVersion: 'terms-X',
  formDefinitionId: 'form-X',
  form: { formVersion: 'form-X', fields: [] },
};

test('save edits only changed fields and preserves unrepresented brand, sections, and form', () => {
  const original = configFields(previous);
  const next = mergeConfigFields(previous, original, {
    ...original,
    primaryColor: '#abcdef',
    termsText: 'New terms',
  });
  assert.equal(next.brand.primaryColor, '#abcdef');
  assert.equal(next.brand.organizationName, 'Original');
  assert.equal(next.brand.logoAssetId, 'logo-X');
  assert.equal(next.brand.bannerAssetId, 'banner-X');
  assert.deepEqual(next.sections[0], previous.sections[0]);
  assert.deepEqual(next.sections[1], previous.sections[1]);
  assert.deepEqual(next.sections[2], previous.sections[2]);
  assert.deepEqual(next.sections[3], previous.sections[3]);
  assert.deepEqual(next.sections[4], previous.sections[4]);
  assert.deepEqual(next.sections[5]?.body, {
    title: 'Terms X',
    text: 'New terms',
    termsVersion: 'terms-X',
  });
  assert.equal(next.formDefinitionId, 'form-X');
  assert.deepEqual(next.form, previous.form);
  assert.equal(next.termsVersion, 'terms-X');
  assert.deepEqual(previous.sections[5]?.body, {
    title: 'Terms X',
    text: 'Old terms',
    termsVersion: 'terms-X',
  });
});

test('version change blocks save preflight and preview must match exact saved version', () => {
  assert.equal(hasConfigVersionConflict(3, 4), true);
  assert.equal(hasConfigVersionConflict(3, 3), false);
  assert.equal(hasConfigVersionConflict(null, 1), true);
  const preview = {
    eventId: 'event-X',
    version: 4,
    schemaVersion: 1,
    payload: previous,
  };
  assert.equal(isConfigPreview(preview, 4), true);
  assert.equal(isConfigPreview(preview, 3), false);
  assert.equal(
    isConfigPreview(
      {
        ...preview,
        payload: { ...previous, sections: previous.sections.slice(0, 2) },
      },
      4,
    ),
    false,
  );
});

test('save notice distinguishes confirmed save from a newer tip or missing preview', () => {
  assert.equal(configSaveNoticeKey(4, 4, true), 'config.h_1qavkda');
  assert.equal(configSaveNoticeKey(4, 5, true), 'config.savedNewerVersion');
  assert.equal(configSaveNoticeKey(4, 5, false), 'config.savedNewerVersion');
  assert.equal(
    configSaveNoticeKey(4, 4, false),
    'config.savedPreviewUnavailable',
  );
  assert.equal(
    configSaveNoticeKey(4, 3, true),
    'config.savedPreviewUnavailable',
  );
  assert.equal(
    configSaveNoticeKey(undefined, undefined, false),
    'config.savedPreviewUnavailable',
  );
});
