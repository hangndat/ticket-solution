import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  accountCopy,
  eventsCopy,
  redeemCopy,
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

test('account copy avoids session jargon and matches PD sections', () => {
  assert.equal(accountCopy.sections.you, 'Bạn');
  assert.equal(accountCopy.sections.notifications, 'Thông báo');
  assert.match(accountCopy.sections.privacy, /Quyền riêng tư/);
  assert.equal(accountCopy.logoutCta, 'Đăng xuất');
  assert.doesNotMatch(accountCopy.guest.body, /phiên|token|verified/i);
  assert.doesNotMatch(accountCopy.guest.title, /RBAC|nhân viên/i);
});

test('wallet first-ticket push card copy has dismiss', () => {
  assert.equal(walletCopy.firstTicketPush.dismissCta, 'Để sau');
  assert.match(walletCopy.firstTicketPush.title, /nhắc/i);
});

test('redeem global guest copy avoids internal session/memory jargon', () => {
  assert.match(redeemCopy.globalGuestBody, /mã/i);
  assert.doesNotMatch(redeemCopy.globalGuestBody, /bộ nhớ|URL|phiên|slug|UUID/i);
  assert.doesNotMatch(redeemCopy.authRequiredBody, /phiên/i);
});

test('events copy is production-facing without demo fallback language', () => {
  assert.equal(eventsCopy.emptyPublished.title, 'Chưa có sự kiện đang mở');
  assert.equal(eventsCopy.errorList.title, 'Không tải được danh sách');
  assert.match(eventsCopy.loadingList.body, /đã xuất bản|máy chủ/i);
  assert.doesNotMatch(eventsCopy.emptyPublished.body, /demo/i);
  assert.match(eventsCopy.misconfiguredTitle, /sẵn sàng/i);
});
