import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PRIVACY_POLICY_INTRO,
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_TITLE,
} from './privacy-policy-copy.ts';

test('native privacy copy is Vietnamese product text (marketing source)', () => {
  assert.equal(PRIVACY_POLICY_TITLE, 'Chính sách quyền riêng tư');
  assert.match(PRIVACY_POLICY_INTRO, /Vemoki/);
  assert.equal(PRIVACY_POLICY_SECTIONS.length, 7);
  assert.equal(PRIVACY_POLICY_SECTIONS[0]?.title, 'Dữ liệu chúng tôi thu');
});
