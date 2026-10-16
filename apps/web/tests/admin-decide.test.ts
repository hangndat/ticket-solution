import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ADMIN_UNKNOWN, decideAdmin } from '../src/admin/decide';
import {
  DEFAULT_CONFIG_PAYLOAD,
  editConfigPayload,
  initialPayloadEditor,
  lockPublishedPayload,
  payloadLocked,
  previewConfigJson,
  startNewConfigDraft,
} from '../src/admin/payload';

describe('decideAdmin', () => {
  it('accepts a saved version and a published version', () => {
    assert.deepEqual(decideAdmin('save', 201, { version: 3 }, false), {
      kind: 'saved',
      version: 3,
    });
    assert.deepEqual(
      decideAdmin(
        'publish',
        201,
        { status: 'PUBLISHED', publishedConfigVersion: 3 },
        false,
      ),
      { kind: 'published', version: 3 },
    );
  });

  it('treats timeout and 5xx as unknown for import', () => {
    assert.deepEqual(decideAdmin('import', 0, null, true), {
      kind: 'unknown',
      message: ADMIN_UNKNOWN,
    });
    assert.equal(
      decideAdmin('import', 503, { imported: 2 }, false).kind,
      'unknown',
    );
  });

  it('shows a business rejection and a quota reading', () => {
    assert.deepEqual(
      decideAdmin(
        'import',
        409,
        { code: 'CODE_DUPLICATE', message: 'dup' },
        false,
      ),
      {
        kind: 'rejected',
        code: 'CODE_DUPLICATE',
        message: 'dup',
      },
    );
    assert.deepEqual(
      decideAdmin('quota', 200, { capacity: 10, allocated: 2 }, false),
      {
        kind: 'quota',
        capacity: 10,
        allocated: 2,
      },
    );
    assert.deepEqual(
      decideAdmin('quota', 200, { capacity: null, allocated: 0 }, false),
      {
        kind: 'quota',
        capacity: null,
        allocated: 0,
      },
    );
  });

  it('shows an API error code from 503 without treating it as success', () => {
    assert.deepEqual(
      decideAdmin(
        'publish',
        503,
        {
          code: 'OIDC_MISCONFIGURED',
          message: 'OIDC chưa cấu hình',
          requestId: 'req-9',
        },
        false,
      ),
      {
        kind: 'rejected',
        code: 'OIDC_MISCONFIGURED',
        message: 'OIDC chưa cấu hình',
        requestId: 'req-9',
      },
    );
  });

  it('previews JSON and refuses edits to a published payload', () => {
    assert.equal(DEFAULT_CONFIG_PAYLOAD.includes('FUN FEST'), false);
    assert.equal(previewConfigJson(DEFAULT_CONFIG_PAYLOAD).ok, true);
    assert.equal(previewConfigJson('[]').ok, false);
    let editor = initialPayloadEditor('{"title":"Draft"}');
    editor = lockPublishedPayload(editor);
    assert.equal(payloadLocked(editor), true);
    assert.equal(
      editConfigPayload(editor, '{"title":"Tamper"}').text,
      '{"title":"Draft"}',
    );
    const next = startNewConfigDraft(editor);
    assert.equal(payloadLocked(next), false);
    assert.equal(next.publishedSnapshot, '{"title":"Draft"}');
    assert.equal(
      editConfigPayload(next, '{"title":"Next"}').text,
      '{"title":"Next"}',
    );
  });
});
