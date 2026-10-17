import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FORBIDDEN_COPY_PATTERNS,
  allCopyValues,
  t,
} from '../src/marketing/copy';
import { validateInterest } from '../src/marketing/interest-validate';

describe('marketing copy VI/EN', () => {
  it('hero and CTA keys differ by locale where expected', () => {
    assert.notEqual(t('vi', 'hero.headline'), t('en', 'hero.headline'));
    assert.equal(t('vi', 'nav.brand'), 'vemoki');
    assert.equal(t('en', 'badge.demo'), 'Simulated demo');
    assert.equal(t('vi', 'badge.demo'), 'Demo giả lập');
  });

  it('AC-6: no forbidden product claims in copy bundles', () => {
    for (const locale of ['vi', 'en'] as const) {
      const blob = allCopyValues(locale).join('\n');
      for (const re of FORBIDDEN_COPY_PATTERNS) {
        assert.equal(re.test(blob), false, `${locale} matched ${re}`);
      }
    }
  });
});

describe('interest validation', () => {
  it('accepts a valid payload', () => {
    const r = validateInterest({
      name: 'Ada',
      email: 'ada@example.com',
      org: 'Org',
      role: 'owner',
      consent: true,
    });
    assert.equal(r.ok, true);
  });

  it('rejects missing fields and honeypot', () => {
    const empty = validateInterest({});
    assert.equal(empty.ok, false);
    if (!empty.ok) {
      assert.ok(empty.fields.includes('name'));
      assert.ok(empty.fields.includes('email'));
    }
    const hp = validateInterest({
      name: 'Ada',
      email: 'ada@example.com',
      org: 'Org',
      role: 'agency',
      consent: true,
      website: 'http://spam.example',
    });
    assert.equal(hp.ok, false);
    if (!hp.ok) assert.equal(hp.honeypot, true);
  });
});
