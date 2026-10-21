import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { reuseUnclearKey } from '../src/admin/idempotent-action';

describe('reuseUnclearKey', () => {
  it('returns a new key when there is no prior attempt', () => {
    const key = reuseUnclearKey(null, '{"a":1}');
    assert.match(key, /^[0-9a-f-]{36}$/i);
  });

  it('reuses key when prior attempt was unclear with same fingerprint', () => {
    const existing = {
      key: 'stable-key',
      fingerprint: '{"a":1}',
      unclear: true,
    };
    assert.equal(reuseUnclearKey(existing, '{"a":1}'), 'stable-key');
  });

  it('issues a new key when fingerprint changed', () => {
    const existing = {
      key: 'stable-key',
      fingerprint: '{"a":1}',
      unclear: true,
    };
    const key = reuseUnclearKey(existing, '{"a":2}');
    assert.notEqual(key, 'stable-key');
  });

  it('issues a new key when prior outcome was clear', () => {
    const existing = {
      key: 'stable-key',
      fingerprint: '{"a":1}',
      unclear: false,
    };
    const key = reuseUnclearKey(existing, '{"a":1}');
    assert.notEqual(key, 'stable-key');
  });
});
