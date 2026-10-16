import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ADMIN_UNKNOWN, decideAdmin } from '../src/admin/decide';

describe('decideAdmin', () => {
  it('accepts a saved version and a published version', () => {
    assert.deepEqual(decideAdmin('save', 201, { version: 3 }, false), {
      kind: 'saved',
      version: 3,
    });
    assert.deepEqual(
      decideAdmin('publish', 201, { status: 'PUBLISHED', publishedConfigVersion: 3 }, false),
      { kind: 'published', version: 3 },
    );
  });

  it('treats timeout and 5xx as unknown for import', () => {
    assert.deepEqual(decideAdmin('import', 0, null, true), {
      kind: 'unknown',
      message: ADMIN_UNKNOWN,
    });
    assert.equal(decideAdmin('import', 503, { imported: 2 }, false).kind, 'unknown');
  });

  it('shows a business rejection and a quota reading', () => {
    assert.deepEqual(decideAdmin('import', 409, { code: 'CODE_DUPLICATE', message: 'dup' }, false), {
      kind: 'rejected',
      code: 'CODE_DUPLICATE',
      message: 'dup',
    });
    assert.deepEqual(decideAdmin('quota', 200, { capacity: 10, allocated: 2 }, false), {
      kind: 'quota',
      capacity: 10,
      allocated: 2,
    });
  });
});
