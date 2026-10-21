import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scanStickyStatusFromMachineLabel } from './staff-gate-scan-sticky-status.ts';

test('scanStickyStatusFromMachineLabel maps ready state', () => {
  const ready = scanStickyStatusFromMachineLabel('Sẵn sàng quét');
  assert.equal(ready.ready, true);
  assert.equal(ready.statusText, 'Sẵn sàng');

  const busy = scanStickyStatusFromMachineLabel('Đang xử lý quét');
  assert.equal(busy.ready, false);
  assert.match(busy.statusText, /Đang xử lý/);
});
