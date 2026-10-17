/**
 * VI copy for Gate offline / degraded / unreachable (D7-S3 #113/#114).
 * Aligns operator messaging with ADR-18 / contract #105 (CHECKIN_OFFLINE on iOS).
 */

import type { GateLinkState } from './connectivity';

/** Guide staff to iOS offline queue — web Gate does not enqueue CHECKIN_OFFLINE. */
export const IOS_OFFLINE_QUEUE_GUIDE =
  'Cổng web không xếp hàng check-in offline. Dùng app iOS staff để queue CHECKIN_OFFLINE (ADR-18 / contract #105), rồi sync khi có mạng. Không cho khách qua nếu API chưa xác nhận.';

export const OFFLINE_BANNER = {
  title: 'Mất mạng — cổng offline',
  body: `Trình duyệt không có mạng. Không giữ chỗ / xác nhận trên cổng web. ${IOS_OFFLINE_QUEUE_GUIDE}`,
} as const;

export const DEGRADED_BANNER = {
  title: 'API không tới được — cổng suy giảm',
  body: `Máy có mạng nhưng API Gate không phản hồi (timeout / mất kết nối / 5xx). Kết quả check-in chưa biết — không cho khách qua, không giả nhận đã vào. ${IOS_OFFLINE_QUEUE_GUIDE}`,
} as const;

export const BLOCKED_OFFLINE_DECISION = {
  kind: 'deny' as const,
  code: 'GATE_OFFLINE',
  message: `Cổng đang offline. Không gửi check-in. ${IOS_OFFLINE_QUEUE_GUIDE}`,
};

export const BLOCKED_DEGRADED_DECISION = {
  kind: 'unknown' as const,
  message: `API Gate không tới được. Không cho khách qua. ${IOS_OFFLINE_QUEUE_GUIDE}`,
};

/** Confirm dialog when staff retries while API still unreachable (fail-closed default = Cancel). */
export const UNREACHABLE_CONFIRM =
  'API Gate vẫn không tới được. Nếu tiếp tục, kết quả có thể chưa biết và khách sẽ KHÔNG được cho qua. Huỷ để dùng queue iOS (CHECKIN_OFFLINE / #105), hoặc OK để thử lại một lần.';

export function bannerCopyForLink(link: GateLinkState): {
  title: string;
  body: string;
} | null {
  if (link === 'offline') return { title: OFFLINE_BANNER.title, body: OFFLINE_BANNER.body };
  if (link === 'degraded') return { title: DEGRADED_BANNER.title, body: DEGRADED_BANNER.body };
  return null;
}
