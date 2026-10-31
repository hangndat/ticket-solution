import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MACHINE_IDLE_LABEL,
  scanStickyStatus,
} from './staff-gate-scan-sticky-status.ts';
import {
  statusIconInfo,
  visibleStatusIcons,
} from './staff-gate-status-icons.ts';

test('sticky: no session is muted «Chưa mở phiên»', () => {
  const s = scanStickyStatus({ machineLabel: MACHINE_IDLE_LABEL, hasSession: false, gateName: 'Cổng A' });
  assert.deepEqual(s, { ready: false, tone: 'muted', statusText: 'Chưa mở phiên' });
});

test('sticky: session idle shows Sẵn sàng with optional gate', () => {
  assert.equal(
    scanStickyStatus({ machineLabel: MACHINE_IDLE_LABEL, hasSession: true }).statusText,
    'Sẵn sàng',
  );
  const withGate = scanStickyStatus({ machineLabel: MACHINE_IDLE_LABEL, hasSession: true, gateName: ' Cổng A ' });
  assert.equal(withGate.statusText, 'Sẵn sàng · Cổng A');
  assert.equal(withGate.ready, true);
});

test('sticky: busy / queue labels pass through unchanged', () => {
  const busy = scanStickyStatus({ machineLabel: 'Đang xử lý quét', hasSession: true, gateName: 'Cổng A' });
  assert.equal(busy.ready, false);
  assert.equal(busy.tone, 'busy');
  assert.equal(busy.statusText, 'Đang xử lý quét');
});

const base = { connectivity: 'online' as const, hasSession: false, gateName: null, pendingCount: 0, conflictCount: 0, syncing: false };

test('status icons: explanation copy per state', () => {
  assert.match(statusIconInfo('network', base).message, /^Mạng: đang online/);
  const off = statusIconInfo('network', { ...base, connectivity: 'offline' });
  assert.match(off.message, /mất kết nối.*lưu trên máy/);
  assert.equal(off.symbol, 'wifi.slash');
  assert.match(statusIconInfo('session', base).message, /chưa mở/);
  const open = statusIconInfo('session', { ...base, hasSession: true, gateName: 'Cổng A' });
  assert.match(open.accessibilityLabel, /đang mở · Cổng A/);
  const sync = statusIconInfo('sync', { ...base, pendingCount: 3, conflictCount: 1 });
  assert.match(sync.message, /3 lượt quét chưa gửi lên máy chủ, 1 lượt cần đối soát/);
  for (const id of ['network', 'session', 'sync'] as const) {
    const info = statusIconInfo(id, { ...base, pendingCount: 1 });
    assert.ok(info.accessibilityHint.includes('Chạm'));
  }
});

test('status icons: glyphs distinct from each other and from header symbols', () => {
  const taken = new Set([
    'person.circle.fill',
    'arrow.triangle.2.circlepath',
    'qrcode.viewfinder',
    'keyboard',
    'clock.arrow.circlepath',
    'tray.full.fill',
  ]);
  const symbols = new Set<string>();
  for (const connectivity of ['online', 'offline', 'unknown'] as const) {
    for (const hasSession of [true, false]) {
      for (const id of ['network', 'session', 'sync'] as const) {
        const { symbol } = statusIconInfo(id, { ...base, connectivity, hasSession });
        assert.ok(!taken.has(symbol), symbol);
        if (connectivity === 'online' && hasSession) symbols.add(symbol);
      }
    }
  }
  assert.equal(symbols.size, 3);
});

test('status icons: sync only when queue has work', () => {
  assert.deepEqual(visibleStatusIcons({ pendingCount: 0, conflictCount: 0 }), ['network', 'session']);
  assert.deepEqual(visibleStatusIcons({ pendingCount: 2, conflictCount: 0 }), ['network', 'session', 'sync']);
  assert.deepEqual(visibleStatusIcons({ pendingCount: 0, conflictCount: 1 }), ['network', 'session', 'sync']);
});
