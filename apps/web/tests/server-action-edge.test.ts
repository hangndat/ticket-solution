import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isServerActionPost } from '../src/security/server-action-edge';

describe('isServerActionPost', () => {
  it('ignores GET and POST without next-action', () => {
    assert.equal(
      isServerActionPost({ method: 'GET', nextActionHeader: null }),
      false,
    );
    assert.equal(
      isServerActionPost({ method: 'POST', nextActionHeader: null }),
      false,
    );
    assert.equal(
      isServerActionPost({ method: 'POST', nextActionHeader: '   ' }),
      false,
    );
  });

  it('detects probe POSTs with next-action (Issue #1021 samples)', () => {
    for (const id of ['x', 'action', '0', '1', 'test']) {
      assert.equal(
        isServerActionPost({ method: 'POST', nextActionHeader: id }),
        true,
        id,
      );
    }
  });

  it('detects long hex ids (no server actions in this app)', () => {
    const hex42 = 'a'.repeat(42);
    assert.equal(
      isServerActionPost({ method: 'POST', nextActionHeader: hex42 }),
      true,
    );
  });
});
