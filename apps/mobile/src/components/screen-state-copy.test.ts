import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  eventsCopy,
  scanCopy,
  walletCopy,
} from './screen-state-copy.ts';

test('wallet copy covers loading empty error without jargon', () => {
  assert.match(walletCopy.loading.title, /vé/i);
  assert.equal(walletCopy.emptyOnline.title, 'Chưa có vé trong ví');
  assert.match(walletCopy.emptyOnline.body, /Đổi mã|kéo để làm mới/i);
  assert.doesNotMatch(walletCopy.emptyOnline.body, /POC|W0|F-WEB|Keycloak|Nest|BFF/i);
  assert.doesNotMatch(walletCopy.signInLoading.body, /Keycloak/i);
  assert.equal(walletCopy.errorTitle, 'Không tải được vé');
});

test('scan copy idle and checking are fail-closed Vietnamese', () => {
  assert.match(scanCopy.idle.body, /API/);
  assert.match(scanCopy.checking.body, /Không cho vào/);
  assert.doesNotMatch(scanCopy.idle.title, /POC/i);
});

test('events copy separates published empty from demo empty', () => {
  assert.notEqual(
    eventsCopy.emptyPublished.title,
    eventsCopy.emptyDemo.title,
  );
  assert.equal(eventsCopy.emptyPublished.title, 'Chưa có sự kiện đang mở');
  assert.equal(eventsCopy.errorList.title, 'Không tải được danh sách');
  assert.match(eventsCopy.loadingList.body, /đã xuất bản|máy chủ/i);
  assert.doesNotMatch(eventsCopy.loadingList.body, /Demo bên dưới/i);
  assert.match(eventsCopy.emptyPublished.body, /Không thay bằng/);
});
