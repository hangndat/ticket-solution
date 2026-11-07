import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scanDecisionCopy } from './gate-scan-decision-copy.ts';

test('Gate decision copy remains fail closed for pending and unknown states', () => {
  for (const kind of [
    'processing',
    'holding',
    'confirming',
    'queued',
    'unknown',
    'recorded',
  ] as const) {
    const copy = scanDecisionCopy(kind);
    assert.notEqual(copy.eyebrow, 'ĐÃ GHI NHẬN CHECK-IN');
    assert.match(copy.guidance, /Không nhận|Chưa xác nhận|Không cho/);
  }
  assert.match(scanDecisionCopy('admitted').guidance, /cho phép khách qua/);
  assert.match(scanDecisionCopy('already-checked-in').guidance, /Không cho/);
});
