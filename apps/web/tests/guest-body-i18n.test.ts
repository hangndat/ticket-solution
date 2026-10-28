import assert from 'node:assert/strict';
import test from 'node:test';
import { FORM_ERROR_CODES, IDENTITY_ERROR_CODES } from '@ticket/contracts';
import { PLATFORM_ERROR_CODES } from '../src/bff/platform-contracts';
import { ATTENDEE_COPY, ATTENDEE_COPY_CATALOG, attendeeCopy } from '../src/attendee-copy';
import { DEFAULT_ATTENDEE_LOCALE } from '../src/i18n';
import { invitePageCopy } from '../src/invite/invite-copy';
import {
  messageForInviteError,
  messageForInviteView,
} from '../src/invite/platform-messages';
import { redeemFormCopy } from '../src/redeem/form-copy';
import { messageForApiError, unknownMessage } from '../src/redeem/messages';
import { WALLET_COPY, walletCopy } from '../src/owner-ticket/types';
import { interpretAcceptInvite } from '../src/bff/me-shape';

test('O04 default remains VI for guest body catalogs', () => {
  assert.equal(DEFAULT_ATTENDEE_LOCALE, 'vi');
  assert.equal(ATTENDEE_COPY.redeemTitle, 'Đổi mã lấy vé');
  assert.equal(attendeeCopy('vi').redeemTitle, ATTENDEE_COPY.redeemTitle);
  assert.equal(WALLET_COPY.title, 'Vé của tôi');
  assert.equal(walletCopy('vi').title, WALLET_COPY.title);
  assert.equal(invitePageCopy('vi').title, 'Nhận lời mời thành viên');
  assert.equal(redeemFormCopy('vi').pageTitle, 'Đổi mã lấy vé');
});

test('EN toggle copy differs from VI for redeem/invite/wallet body', () => {
  assert.equal(attendeeCopy('en').redeemTitle, 'Redeem a code');
  assert.notEqual(attendeeCopy('en').redeemTitle, attendeeCopy('vi').redeemTitle);
  assert.equal(walletCopy('en').title, 'My tickets');
  assert.notEqual(walletCopy('en').empty.title, walletCopy('vi').empty.title);
  assert.equal(invitePageCopy('en').submit, 'Accept invite');
  assert.notEqual(invitePageCopy('en').intro, invitePageCopy('vi').intro);
  assert.equal(redeemFormCopy('en').submit, 'Redeem code');
  assert.notEqual(redeemFormCopy('en').codeLabel, redeemFormCopy('vi').codeLabel);
  assert.equal(ATTENDEE_COPY_CATALOG.redeemTitle.vi, ATTENDEE_COPY.redeemTitle);
});

test('redeem UX catalogs switch language without English error codes as titles', () => {
  const vi = messageForApiError(IDENTITY_ERROR_CODES.UNAUTHENTICATED);
  const en = messageForApiError(
    IDENTITY_ERROR_CODES.UNAUTHENTICATED,
    undefined,
    undefined,
    'en',
  );
  assert.equal(vi.title, 'Cần đăng nhập');
  assert.equal(en.title, 'Sign in required');
  const staleEn = messageForApiError(
    FORM_ERROR_CODES.FORM_VERSION_STALE,
    undefined,
    undefined,
    'en',
  );
  assert.match(staleEn.title, /form changed/i);
  assert.equal(/FORM_VERSION_STALE/.test(`${staleEn.title} ${staleEn.detail}`), false);
  const unknownEn = unknownMessage('key', 'en');
  assert.match(unknownEn.detail, /not confirmed/i);
  assert.equal(/đã cấp vé/i.test(unknownEn.title), false);
});

test('invite UX catalogs switch language and keep fail-closed meaning', () => {
  const usedEn = messageForInviteError(
    PLATFORM_ERROR_CODES.INVITE_ALREADY_USED,
    undefined,
    undefined,
    'en',
  );
  assert.match(usedEn.title, /already used/i);
  assert.equal(/INVITE_ALREADY_USED/.test(`${usedEn.title} ${usedEn.detail}`), false);
  const view = interpretAcceptInvite(
    200,
    {
      tenantId: '11111111-1111-4111-8111-111111111111',
      membershipId: '22222222-2222-4222-8222-222222222222',
      status: 'ACTIVE',
    },
    false,
  );
  const okEn = messageForInviteView(view, 'en');
  assert.equal(okEn.title, 'Invite accepted');
  assert.match(okEn.detail, /does not grant Owner/i);
});
