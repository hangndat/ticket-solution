import type { ConnectivityState } from './offline-queue.ts';

export type StatusIconId = 'network' | 'session' | 'sync';

export type StatusIconSymbol =
  | 'wifi'
  | 'wifi.slash'
  | 'wifi.exclamationmark'
  | 'door.left.hand.open'
  | 'door.left.hand.closed'
  | 'icloud.and.arrow.up';

export type StatusIconInfo = {
  id: StatusIconId;
  symbol: StatusIconSymbol;
  tone: 'ok' | 'muted' | 'attention';
  /** Alert title. */
  title: string;
  /** Alert body: current value + one-line meaning. */
  message: string;
  accessibilityLabel: string;
  accessibilityHint: string;
};

/**
 * Glyphs are deliberately distinct from each other and from every other symbol
 * on the staff screens (header: person.circle, arrow.triangle.2.circlepath,
 * ellipsis.circle, arrow.clockwise; tabs: qrcode.viewfinder, keyboard,
 * clock.arrow.circlepath; panels: *.circle.fill, tray.full.fill).
 */
export function statusIconInfo(
  id: StatusIconId,
  input: {
    connectivity: ConnectivityState;
    hasSession: boolean;
    gateName?: string | null;
    pendingCount: number;
    conflictCount: number;
    syncing: boolean;
  },
): StatusIconInfo {
  const hint = 'Chạm để xem giải thích.';
  if (id === 'network') {
    const online = input.connectivity === 'online';
    const offline = input.connectivity === 'offline';
    const value = online
      ? 'đang online'
      : offline
        ? 'mất kết nối'
        : 'chưa xác định';
    const meaning = online
      ? 'Lượt quét được gửi thẳng lên máy chủ.'
      : offline
        ? 'Vé quét sẽ lưu trên máy và đồng bộ khi có mạng.'
        : 'Chưa kiểm tra được kết nối tới máy chủ.';
    return {
      id,
      symbol: online ? 'wifi' : offline ? 'wifi.slash' : 'wifi.exclamationmark',
      tone: online ? 'ok' : 'muted',
      title: 'Mạng',
      message: `Mạng: ${value}. ${meaning}`,
      accessibilityLabel: `Mạng: ${value}`,
      accessibilityHint: hint,
    };
  }
  if (id === 'session') {
    const gate = input.gateName?.trim();
    const value = input.hasSession
      ? gate
        ? `đang mở · ${gate}`
        : 'đang mở'
      : 'chưa mở';
    return {
      id,
      symbol: input.hasSession ? 'door.left.hand.open' : 'door.left.hand.closed',
      tone: input.hasSession ? 'ok' : 'muted',
      title: 'Phiên cổng',
      message: input.hasSession
        ? `Phiên cổng: ${value}. Mọi lượt quét được ghi vào phiên này.`
        : 'Phiên cổng: chưa mở. Mở phiên cổng để bắt đầu quét vé.',
      accessibilityLabel: `Phiên cổng: ${value}`,
      accessibilityHint: hint,
    };
  }
  const parts: string[] = [];
  if (input.pendingCount > 0) {
    parts.push(`${input.pendingCount} lượt quét chưa gửi lên máy chủ`);
  }
  if (input.conflictCount > 0) {
    parts.push(`${input.conflictCount} lượt cần đối soát`);
  }
  const value = parts.length > 0 ? parts.join(', ') : 'không có lượt chờ';
  return {
    id: 'sync',
    symbol: 'icloud.and.arrow.up',
    tone: 'attention',
    title: 'Chờ đồng bộ',
    message: `Chờ đồng bộ: ${value}.${input.syncing ? ' Đang đồng bộ…' : ''} Lượt quét offline chưa được tính là vào cổng cho đến khi đồng bộ.`,
    accessibilityLabel: `Chờ đồng bộ: ${value}`,
    accessibilityHint: 'Chạm để xem giải thích và đồng bộ ngay.',
  };
}

/** Icons shown on the single status line; sync only when something is queued. */
export function visibleStatusIcons(input: {
  pendingCount: number;
  conflictCount: number;
}): StatusIconId[] {
  const ids: StatusIconId[] = ['network', 'session'];
  if (input.pendingCount > 0 || input.conflictCount > 0) ids.push('sync');
  return ids;
}
