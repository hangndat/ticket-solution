import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildEventDetailModel,
  formatEventWhen,
  isLongEventText,
} from './event-detail-model.ts';
import type { PublishedEventDetail } from './types.ts';

function base(over: Partial<PublishedEventDetail> = {}): PublishedEventDetail {
  return {
    id: 'e1',
    tenantId: 't1',
    tenantSlug: 'acme',
    slug: 'show',
    name: 'Show',
    timezone: 'Asia/Ho_Chi_Minh',
    startsAt: '2027-03-20T03:00:00Z',
    location: ' Nhà hát ',
    publishedConfigVersion: 1,
    schemaVersion: 1,
    sections: [],
    faq: [],
    terms: null,
    brand: { primaryColor: '#245B47', organizationName: 'Acme' },
    ...over,
  };
}

test('when line includes date, time and timezone; null when missing', () => {
  const line = formatEventWhen('2027-03-20T03:00:00Z', 'Asia/Ho_Chi_Minh');
  assert.match(line ?? '', /2027/);
  assert.match(line ?? '', /10:00/);
  assert.match(line ?? '', /GMT\+7/);
  assert.equal(formatEventWhen(null, 'Asia/Ho_Chi_Minh'), null);
});

test('model omits empty fields and hidden/empty sections', () => {
  const m = buildEventDetailModel(
    base({
      location: null,
      brand: { primaryColor: '#000', organizationName: 'show' },
      sections: [
        { id: 'a', kind: 'info', visible: true, order: 2, bodyMarkdown: 'B' },
        { id: 'b', kind: 'hero', visible: true, order: 1, bodyMarkdown: 'A' },
        { id: 'c', kind: 'guide', visible: false, order: 3, bodyMarkdown: 'x' },
        { id: 'd', kind: 'redeem', visible: true, order: 4, bodyMarkdown: ' ' },
      ],
    }),
  );
  assert.equal(m.venue, null);
  assert.equal(m.organizer, null, 'organizer equal to name is dropped');
  assert.equal(m.about, 'A\n\nB');
  assert.equal(m.guide, null);
  assert.equal(m.redeemHint, null);
  assert.equal(m.terms, null);
});

test('model keeps organizer, terms and faq when present', () => {
  const m = buildEventDetailModel(
    base({
      faq: [
        { q: 'Q', a: 'A' },
        { q: '', a: 'x' },
      ],
      terms: { version: 'v2', bodyMarkdown: 'Điều khoản' },
    }),
  );
  assert.equal(m.organizer, 'Acme');
  assert.equal(m.venue, 'Nhà hát');
  assert.equal(m.faq.length, 1);
  assert.deepEqual(m.terms, { version: 'v2', body: 'Điều khoản' });
});

test('long text detection', () => {
  assert.equal(isLongEventText('a'.repeat(100)), false);
  assert.equal(isLongEventText('a'.repeat(400)), true);
});
