import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accountCopy } from '../components/screen-state-copy.ts';
import {
  ATTENDEE_PROFILE_ICON_GUEST,
  ATTENDEE_PROFILE_ICON_SIGNED_IN,
  attendeeProfileHeaderIcon,
} from './attendee-profile-header.ts';

test('header profile icon is outline for guest and filled when signed in', () => {
  assert.equal(attendeeProfileHeaderIcon(false), 'person.circle');
  assert.equal(attendeeProfileHeaderIcon(true), 'person.circle.fill');
  assert.equal(ATTENDEE_PROFILE_ICON_GUEST, 'person.circle');
  assert.equal(ATTENDEE_PROFILE_ICON_SIGNED_IN, 'person.circle.fill');
  assert.equal(accountCopy.guest.signInCta, 'Đăng nhập');
  assert.equal(accountCopy.screenTitle, 'Tài khoản');
});
