import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatWalletLastSyncedVi,
  parseWalletSyncedAt,
  walletOfflineNoticeBody,
} from './wallet-sync-display.ts';
import { attendeeWalletCopy } from '../attendee/attendee-outcome-copy.ts';

test('parseWalletSyncedAt rejects invalid values', () => {
  assert.equal(parseWalletSyncedAt(null), null);
  assert.equal(parseWalletSyncedAt(''), null);
  assert.equal(parseWalletSyncedAt('not-a-date'), null);
});

test('formatWalletLastSyncedVi uses vi-VN for known instant', () => {
  const formatted = formatWalletLastSyncedVi('2026-10-16T12:00:00.000Z');
  assert.ok(formatted);
  assert.match(formatted!, /2026/);
  assert.match(formatted!, /16.*10/);
});

test('walletOfflineNoticeBody appends last sync only when parseable', () => {
  const base = attendeeWalletCopy.offlineBannerBody;
  assert.equal(walletOfflineNoticeBody(base, null), base);
  const withSync = walletOfflineNoticeBody(base, '2026-10-16T12:00:00.000Z');
  assert.match(withSync, /Lần đồng bộ gần nhất:/);
  assert.match(withSync, /có thể đã thay đổi/);
});
