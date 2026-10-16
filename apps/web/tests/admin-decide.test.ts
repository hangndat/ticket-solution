import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ADMIN_UNKNOWN,
  adminDecisionLabel,
  decideAdmin,
} from '../src/admin/decide';
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

  it('treats 503 as unknown and 200 approve as approved', () => {
    const plaintext = 'INVITE-PLAINTEXT-9';
    const approved = decideAdmin(
      'approve',
      200,
      {
        decision: 'approve',
        status: 'ISSUED',
        requestId: '33333333-3333-4333-8333-333333333333',
        ticketId: '44444444-4444-4444-8444-444444444444',
        operationId: 'op-1',
        ownerUserId: 'user-1',
        replayed: false,
        code: plaintext,
        redemptionCode: plaintext,
      },
      false,
    );
    assert.deepEqual(approved, {
      kind: 'approved',
      requestId: '33333333-3333-4333-8333-333333333333',
      replayed: false,
    });
    const statusText = adminDecisionLabel(approved);
    assert.match(statusText, /Đã duyệt/);
    assert.equal(statusText.includes(plaintext), false);
    assert.equal(JSON.stringify(approved).includes(plaintext), false);

    const unavailable = decideAdmin(
      'approve',
      503,
      {
        decision: 'approve',
        status: 'ISSUED',
        requestId: '33333333-3333-4333-8333-333333333333',
        code: plaintext,
      },
      false,
    );
    assert.deepEqual(unavailable, { kind: 'unknown', message: ADMIN_UNKNOWN });
    assert.equal(adminDecisionLabel(unavailable).includes('Đã duyệt'), false);
    assert.equal(adminDecisionLabel(unavailable).includes(plaintext), false);
    assert.equal(decideAdmin('approve', 0, null, true).kind, 'unknown');
    assert.equal(
      decideAdmin('deny', 500, { decision: 'deny', status: 'REJECTED' }, false)
        .kind,
      'unknown',
    );
  });

  it('treats a deny 4xx as a known rejection and a 200 deny as denied', () => {
    assert.deepEqual(
      decideAdmin(
        'deny',
        422,
        { code: 'REASON_REQUIRED', message: 'Denial reason is required' },
        false,
      ),
      {
        kind: 'rejected',
        code: 'REASON_REQUIRED',
        message: 'Denial reason is required',
      },
    );
    const denied = decideAdmin(
      'deny',
      200,
      {
        decision: 'deny',
        status: 'REJECTED',
        requestId: '33333333-3333-4333-8333-333333333333',
        ticketId: null,
        replayed: true,
        redemptionCode: 'SECRET-CODE',
      },
      false,
    );
    assert.equal(denied.kind, 'denied');
    assert.equal(adminDecisionLabel(denied).includes('SECRET-CODE'), false);
    assert.match(adminDecisionLabel(denied), /Đã từ chối/);
  });

  it('treats a 503 with a business code as unknown', () => {
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
      { kind: 'unknown', message: ADMIN_UNKNOWN },
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
