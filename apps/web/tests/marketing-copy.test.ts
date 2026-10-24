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

  it('R-02 / AC-2: interest form labels and validation copy are English on en locale', () => {
    assert.equal(t('en', 'interest.name'), 'Full name');
    assert.equal(t('en', 'interest.email'), 'Work email');
    assert.equal(t('en', 'interest.org'), 'Organization');
    assert.equal(t('en', 'interest.submit'), 'Submit');
    assert.equal(t('en', 'interest.error.name'), 'Enter your name');
    assert.equal(t('en', 'interest.error.consent'), 'Consent required to contact you');
    assert.notEqual(t('vi', 'interest.name'), t('en', 'interest.name'));
  });

  it('O23 VD-02: marketing copy does not advertise live web gate URL', () => {
    for (const locale of ['vi', 'en'] as const) {
      const blob = allCopyValues(locale).join('\n');
      assert.doesNotMatch(blob, /app\.vemoki\.com\/gate/i);
      assert.doesNotMatch(blob, /web fallback/i);
    }
  });

  it('AC-6: no forbidden product claims in copy bundles', () => {
    for (const locale of ['vi', 'en'] as const) {
      const blob = allCopyValues(locale).join('\n');
      for (const re of FORBIDDEN_COPY_PATTERNS) {
        assert.equal(re.test(blob), false, `${locale} matched ${re}`);
      }
    }
  });

  it('D13 privacy disclosures: camera on-device, deletion path, ≤30d', () => {
    for (const locale of ['vi', 'en'] as const) {
      const camera = t(locale, 'privacy.s3.body');
      const deletion = t(locale, 'privacy.s5.body');
      const retention = t(locale, 'privacy.s4.body');
      assert.match(camera, /on-device|trên thiết bị/i);
      assert.match(camera, /do not upload|không tải ảnh/i);
      assert.match(retention, /30/);
      assert.match(deletion, /\/account/);
      assert.match(deletion, /30/);
      assert.doesNotMatch(deletion, /\bjob\b|NO_JOB|scheduler/i);
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
