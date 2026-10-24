import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MANUAL_PREVIEW_DISCLAIMER,
  MANUAL_PREVIEW_HEADER,
  MANUAL_SUBMIT_TO_GATE_LABEL,
} from './staff-manual-confirm-copy.ts';

test('manual preview copy does not claim server-valid ticket', () => {
  assert.match(MANUAL_PREVIEW_HEADER, /chưa xác minh/i);
  assert.doesNotMatch(MANUAL_PREVIEW_HEADER, /hợp lệ/i);
  assert.match(MANUAL_PREVIEW_DISCLAIMER, /APPLIED/i);
  assert.doesNotMatch(MANUAL_SUBMIT_TO_GATE_LABEL, /Xác nhận vào cổng/);
});
