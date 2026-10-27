import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TENANT_LIMIT_ERROR_CODES,
  formatLimitGuidance,
  limitGuidance,
  limitGuidanceHref,
} from '../src/ops/limit-guidance';
import { t } from '../src/i18n/t';

test('every required limit code has copy, action, and never locks tickets/check-in', () => {
  for (const code of TENANT_LIMIT_ERROR_CODES) {
    const guidance = limitGuidance(code);
    assert.ok(guidance);
    assert.equal(guidance.locksTicketOrCheckIn, false);
    const vi = formatLimitGuidance(code, 'vi');
    const en = formatLimitGuidance(code, 'en');
    assert.ok(vi);
    assert.ok(en);
    assert.notEqual(vi.title, en.title);
    assert.doesNotMatch(vi.body, /TENANT_LIMIT_REACHED|RATE_LIMITED|RESEND_LIMIT|PENDING_LIMIT|ATTENDEE_LIMIT/);
    assert.doesNotMatch(en.body, /TENANT_LIMIT_REACHED|RATE_LIMITED|RESEND_LIMIT|PENDING_LIMIT|ATTENDEE_LIMIT/);
    assert.doesNotMatch(vi.body, /unlimited|trọn đời|SLA/i);
    const href = limitGuidanceHref(guidance, {
      tenantId: 't1',
      eventId: 'e1',
    });
    if (guidance.action === 'retry') {
      assert.equal(href, null);
    } else {
      assert.ok(href);
      assert.doesNotMatch(href, /\/gate$/);
    }
  }
});

test('unknown codes do not invent guidance', () => {
  assert.equal(limitGuidance('QUOTA_EXHAUSTED'), null);
  assert.equal(formatLimitGuidance(null), null);
});

test('guidance copy matches catalogs', () => {
  const formatted = formatLimitGuidance('ATTENDEE_LIMIT', 'vi');
  assert.equal(formatted?.title, t('vi', 'limits.guidance.attendeeLimitTitle'));
});
