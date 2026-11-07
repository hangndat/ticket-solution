import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TicketSummary } from '@ticket/contracts';
import { ownerBannerUrl, ownerEventTimezone, ownerText } from './owner-metadata.ts';

const ticket = { bannerUrl: 'https://cdn.example.test/banner.jpg', eventTimezone: 'Asia/Ho_Chi_Minh' } as TicketSummary;

test('owner metadata accepts only public HTTPS banner URLs', () => {
  assert.equal(ownerBannerUrl(ticket), 'https://cdn.example.test/banner.jpg');
  for (const bannerUrl of [null, '', 'http://cdn.example.test/a.jpg', 'javascript:alert(1)', '//cdn.example.test/a.jpg', 'https://user:pass@cdn.example.test/a.jpg', 'bad url']) {
    assert.equal(ownerBannerUrl({ ...ticket, bannerUrl }), null);
  }
});

test('owner timezone and text tolerate missing and malformed fields', () => {
  assert.equal(ownerEventTimezone(ticket), 'Asia/Ho_Chi_Minh');
  assert.equal(ownerEventTimezone({ ...ticket, eventTimezone: 'Invalid/Zone' }), null);
  assert.equal(ownerText('  Nhà hát A  '), 'Nhà hát A');
  assert.equal(ownerText(null), null);
});
