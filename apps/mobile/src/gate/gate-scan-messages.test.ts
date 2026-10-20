import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  messageFromGateApi,
  messageFromParseFailure,
} from './gate-scan-messages.ts';

test('messageFromParseFailure distinguishes unsupported kind', () => {
  assert.match(
    messageFromParseFailure('unsupported_kind', 'ticket.legacy'),
    /không hỗ trợ/i,
  );
  assert.match(messageFromParseFailure('missing_gate_scope'), /chọn sự kiện/i);
});

test('messageFromGateApi maps stable codes', () => {
  assert.match(
    messageFromGateApi(409, { code: 'ALREADY_CHECKED_IN' }, false),
    /đã check-in/i,
  );
  assert.match(
    messageFromGateApi(404, { code: 'TICKET_NOT_FOUND' }, false),
    /không tìm thấy vé/i,
  );
  assert.match(messageFromGateApi(0, null, true), /mất kết nối/i);
});
