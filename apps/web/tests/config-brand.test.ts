import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assetFinalizeUpstreamPath,
  assetUploadInitUpstreamPath,
  buildRollbackBody,
  configEndpointTemplates,
  configPreviewUpstreamPath,
  configRollbackCommand,
  configRollbackUpstreamPath,
  configVersionsUpstreamPath,
  interpretAssetFinalize,
  interpretAssetInit,
  interpretConfigHistory,
  interpretConfigPreview,
  interpretConfigRollback,
  localDraftPreview,
  localVersionPreview,
} from '../src/admin/config-api';
import {
  validateAssetFile,
  validateImageDimensions,
} from '../src/admin/config-assets';
import {
  parseAssetInitBody,
  parseRollbackBody,
  parseTypedConfigPayload,
} from '../src/admin/config-bff-body';
import {
  configEditorLocked,
  draftIsolatedFromPublished,
  initialConfigEditor,
  lockPublishedConfig,
  moveSection,
  setSectionBody,
  setSectionVisible,
  startNewConfigDraftFromPublished,
  updateBrand,
  validateEditor,
} from '../src/admin/config-editor';
import {
  assertSafePlainText,
  defaultConfigPayload,
  escapeText,
  parseConfigPayload,
  visibleSectionsInOrder,
} from '../src/admin/config-schema';
import { serializePreviewText } from '../src/content/config-renderer';
import {
  previewConfigJson,
  DEFAULT_CONFIG_PAYLOAD,
} from '../src/admin/payload';
import {
  fixtureAssetReady,
  fixtureCbAssetLimits,
  fixtureCbCommands,
  fixtureCbEndpoints,
  fixtureConfigHistory,
  fixtureConfigPayload,
  fixtureConfigPreview,
  fixtureRollbackBody,
  fixtureRollbackResponse,
  fixtureSectionKinds,
} from './fixtures/event-cb';

const scope = {
  tenantId: '22222222-2222-4222-8222-222222222222',
  eventId: '11111111-1111-4111-8111-111111111111',
};

describe('C-B paths and commands', () => {
  it('builds upstream paths matching CONFIG_ENDPOINTS', () => {
    const templates = configEndpointTemplates();
    assert.equal(templates, fixtureCbEndpoints);
    assert.equal(
      configVersionsUpstreamPath(scope),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/config-versions`,
    );
    assert.equal(
      configPreviewUpstreamPath(scope, 2),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/config-versions/2/preview`,
    );
    assert.equal(
      configRollbackUpstreamPath(scope),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/config/rollback`,
    );
    assert.equal(
      assetUploadInitUpstreamPath(scope),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/assets/upload-init`,
    );
    assert.equal(
      assetFinalizeUpstreamPath(scope),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/assets/finalize`,
    );
    assert.equal(configRollbackCommand(), fixtureCbCommands.rollback);
  });
});

describe('C-B typed schema validation', () => {
  it('accepts contract fixture payload with six fixed kinds', () => {
    const parsed = parseConfigPayload(fixtureConfigPayload);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.payload.sections.length, 6);
    assert.deepEqual(
      parsed.payload.sections.map((s) => s.kind).sort(),
      [...fixtureSectionKinds].sort(),
    );
  });

  it('rejects arbitrary section kinds and unknown body keys / markup', () => {
    const badKind = parseConfigPayload({
      ...fixtureConfigPayload,
      sections: [
        ...fixtureConfigPayload.sections.slice(0, 5),
        {
          kind: 'customHtml',
          id: 'x',
          visible: true,
          order: 5,
          body: { html: '<b>x</b>' },
        },
      ],
    });
    assert.equal(badKind.ok, false);
    assert.ok(badKind.issues.some((i) => i.code === 'CONFIG_SECTION_KIND'));

    const xss = assertSafePlainText(
      'hero.text',
      'Hello <script>alert(1)</script>',
      4000,
    );
    assert.ok(xss);
    assert.equal(xss?.code, 'CONFIG_UNSAFE_MARKUP');

    const css = assertSafePlainText('t', 'color: expression(alert(1))', 200);
    assert.ok(css);
  });

  it('rejects SVG/HTML/oversize assets client-side', () => {
    assert.equal(
      validateAssetFile({
        name: 'logo.svg',
        type: 'image/svg+xml',
        size: 100,
      }).ok,
      false,
    );
    assert.equal(
      validateAssetFile({
        name: 'x.html',
        type: 'text/html',
        size: 100,
      }).ok,
      false,
    );
    assert.equal(
      validateAssetFile({
        name: 'big.png',
        type: 'image/png',
        size: fixtureCbAssetLimits.maxBytes + 1,
      }).ok,
      false,
    );
    assert.equal(
      validateAssetFile({
        name: 'ok.png',
        type: 'image/png',
        size: 1024,
      }).ok,
      true,
    );
    assert.ok(
      validateImageDimensions({
        widthPx: fixtureCbAssetLimits.maxWidthPx + 1,
        heightPx: 10,
      }),
    );
  });
});

describe('C-B editor version isolation', () => {
  it('locks published snapshot and draft edits do not mutate it', () => {
    let editor = initialConfigEditor(structuredClone(fixtureConfigPayload));
    editor = lockPublishedConfig(editor);
    assert.equal(configEditorLocked(editor), true);
    const publishedRef = editor.publishedSnapshot;
    assert.ok(publishedRef);

    editor = startNewConfigDraftFromPublished(editor);
    assert.equal(configEditorLocked(editor), false);
    assert.equal(draftIsolatedFromPublished(editor), true);

    editor = updateBrand(editor, { organizationName: 'Draft Org' });
    assert.equal(editor.payload.brand.organizationName, 'Draft Org');
    assert.equal(publishedRef?.brand.organizationName, 'Example Org');
    assert.notEqual(
      editor.payload.brand.organizationName,
      editor.publishedSnapshot?.brand.organizationName,
    );
  });

  it('reorder / visibility keep all kinds and local version preview skips draft mutation', () => {
    let editor = initialConfigEditor(structuredClone(fixtureConfigPayload));
    editor = moveSection(editor, 'faq', -1);
    editor = setSectionVisible(editor, 'guide', true);
    const kinds = editor.payload.sections.map((s) => s.kind).sort();
    assert.deepEqual(kinds, [...fixtureSectionKinds].sort());

    const draft = localDraftPreview(editor.payload);
    const version = localVersionPreview(2, fixtureConfigPayload);
    assert.equal(draft.cacheControl, 'no-store');
    assert.equal(version.cacheControl, 'no-store');
    assert.equal(version.version, 2);
    assert.notEqual(draft.payload.brand.organizationName, undefined);
    // Loading version preview data must not require changing editor draft.
    assert.equal(editor.payload.sections.length, 6);
  });

  it('rejects locked edits', () => {
    let editor = lockPublishedConfig(
      initialConfigEditor(structuredClone(fixtureConfigPayload)),
    );
    const before = editor.payload.brand.organizationName;
    editor = updateBrand(editor, { organizationName: 'Nope' });
    editor = setSectionBody(editor, 'hero', { title: 'Nope' });
    assert.equal(editor.payload.brand.organizationName, before);
  });
});

describe('C-B XSS / sanitized render text', () => {
  it('escapeText neutralizes tags and serializePreview never emits raw script', () => {
    const raw = '<script>alert("xss")</script>';
    const escaped = escapeText(raw);
    assert.equal(escaped.includes('<script'), false);
    assert.ok(escaped.includes('&lt;script'));

    const payload = structuredClone(fixtureConfigPayload);
    payload.brand.organizationName = 'Org & Co <b>';
    payload.sections[0]!.body = {
      title: 'Hi',
      text: 'A <img src=x onerror=alert(1)>',
    };
    // Bypass validator for renderer defense-in-depth check.
    const serialized = serializePreviewText(payload);
    assert.equal(serialized.includes('<img'), false);
    assert.equal(serialized.includes('<script'), false);
    assert.ok(serialized.includes('&lt;img'));
    assert.ok(serialized.includes('&amp;'));
    // Substring onerror= may remain as plain text after escaping — not executable HTML.
    assert.ok(serialized.includes('onerror='));
  });

  it('visible sections honor order and hide flag', () => {
    const visible = visibleSectionsInOrder(fixtureConfigPayload);
    assert.ok(visible.every((s) => s.visible));
    assert.equal(
      visible.some((s) => s.kind === 'guide'),
      false,
    );
    const orders = visible.map((s) => s.order);
    assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
  });
});

describe('C-B keyboard / a11y contracts (helpers)', () => {
  it('validation focuses fieldId messages and default payload validates', () => {
    const validated = validateEditor(initialConfigEditor(defaultConfigPayload()));
    assert.equal(validated.ok, true);

    const bad = validateEditor(
      initialConfigEditor({
        ...defaultConfigPayload(),
        brand: {
          primaryColor: 'red',
          organizationName: 'x',
        },
      }),
    );
    assert.equal(bad.ok, false);
    if (!bad.ok) {
      assert.ok(bad.issues[0]?.fieldId.includes('primaryColor'));
    }

    // DEFAULT JSON path still typed — not prettyJSON-only acceptance.
    assert.equal(previewConfigJson(DEFAULT_CONFIG_PAYLOAD).ok, true);
    assert.equal(DEFAULT_CONFIG_PAYLOAD.includes('FUN FEST'), false);
    assert.equal(previewConfigJson('{"title":"only"}').ok, false);
  });
});

describe('C-B response interpreters', () => {
  it('accepts preview with no-store and rejects missing cacheControl', () => {
    const ok = interpretConfigPreview(200, fixtureConfigPreview, false);
    assert.equal(ok.kind, 'preview');

    const bad = interpretConfigPreview(
      200,
      { ...fixtureConfigPreview, cacheControl: 'public' },
      false,
    );
    assert.equal(bad.kind, 'unknown');
  });

  it('lists history, rollback, and asset finalize READY only', () => {
    const history = interpretConfigHistory(200, fixtureConfigHistory, false);
    assert.equal(history.kind, 'list');

    const rollback = interpretConfigRollback(
      201,
      fixtureRollbackResponse,
      false,
    );
    assert.equal(rollback.kind, 'rolled_back');

    const ready = interpretAssetFinalize(200, fixtureAssetReady, false);
    assert.equal(ready.kind, 'ready');

    const quarantine = interpretAssetFinalize(
      200,
      { ...fixtureAssetReady, status: 'QUARANTINE' },
      false,
    );
    assert.equal(quarantine.kind, 'rejected');

    const init = interpretAssetInit(
      201,
      {
        assetId: fixtureAssetReady.assetId,
        uploadUrl: 'https://example.test/upload',
        expiresAt: '2026-10-17T09:00:00.000Z',
      },
      false,
    );
    assert.equal(init.kind, 'init');
  });

  it('builds rollback body and BFF parsers reject bad assets', () => {
    assert.deepEqual(buildRollbackBody(fixtureRollbackBody), fixtureRollbackBody);
    const parsed = parseTypedConfigPayload(fixtureConfigPayload);
    assert.ok(!(parsed instanceof Response));

    const rollback = parseRollbackBody({
      ...fixtureRollbackBody,
    } as unknown as Record<string, unknown>);
    assert.ok(!(rollback instanceof Response));

    const badAsset = parseAssetInitBody({
      filename: 'x.svg',
      contentType: 'image/svg+xml',
      byteLength: 10,
    });
    assert.ok(badAsset instanceof Response);
  });
});
