/**
 * VI copy for Gate offline / degraded / unreachable (D11 AC-G4 · PD §2.4).
 * Web Gate does not enqueue offline check-in — guide staff to iOS app.
 */

import type { GateLinkState } from './connectivity';

/** Staff guide — plain VI; no ADR / contract IDs in chrome. */
export const IOS_OFFLINE_QUEUE_GUIDE =
  'Không xếp hàng trên web. Dùng app Nhân viên để xếp hàng khi mất mạng, rồi đồng bộ khi có mạng. Không cho khách qua nếu hệ thống chưa xác nhận.';

export const OFFLINE_BANNER = {
  title: 'Cổng web offline',
  body: `Trình duyệt không có mạng. Không giữ chỗ / xác nhận trên cổng web. ${IOS_OFFLINE_QUEUE_GUIDE}`,
} as const;

export const DEGRADED_BANNER = {
  title: 'API cổng không tới được',
  body: `Máy có mạng nhưng cổng không phản hồi. Kết quả check-in chưa biết — không cho khách qua, không giả nhận đã vào. ${IOS_OFFLINE_QUEUE_GUIDE}`,
} as const;

export const BLOCKED_OFFLINE_DECISION = {
  kind: 'deny' as const,
  code: 'GATE_OFFLINE',
  message: `Cổng web offline. Không gửi check-in. ${IOS_OFFLINE_QUEUE_GUIDE}`,
};

export const BLOCKED_DEGRADED_DECISION = {
  kind: 'unknown' as const,
  message: `API cổng không tới được. Không cho khách qua. ${IOS_OFFLINE_QUEUE_GUIDE}`,
};

/** Confirm dialog when staff retries while API still unreachable (fail-closed default = Cancel). */
export const UNREACHABLE_CONFIRM =
  'API cổng vẫn không tới được. Nếu tiếp tục, kết quả có thể chưa biết và khách sẽ KHÔNG được cho qua. Huỷ để dùng app Nhân viên, hoặc OK để thử lại một lần.';

export function bannerCopyForLink(link: GateLinkState): {
  title: string;
  body: string;
} | null {
  if (link === 'offline') return { title: OFFLINE_BANNER.title, body: OFFLINE_BANNER.body };
  if (link === 'degraded') return { title: DEGRADED_BANNER.title, body: DEGRADED_BANNER.body };
  return null;
}
