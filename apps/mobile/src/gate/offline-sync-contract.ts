/**
 * Client mirror of `@ticket/contracts` offline-sync (Issue #105 / ADR-18).
 * Keep in sync until that contract lands on main; do not invent extra codes.
 */

export const OFFLINE_SYNC_MAX_BATCH = 50 as const;
export const OFFLINE_SYNC_MAX_CLOCK_SKEW_SECONDS = 300 as const;
export const OFFLINE_SYNC_PAYLOAD_VERSION = 1 as const;

export const OFFLINE_SYNC_ENDPOINTS = {
  sync: '/v1/gate/events/{eventId}/offline-sync',
} as const;

export const OFFLINE_SYNC_EVENT_TYPES = ['CHECKIN_OFFLINE'] as const;
export type OfflineSyncEventType = (typeof OFFLINE_SYNC_EVENT_TYPES)[number];

export const OFFLINE_SYNC_ERROR_CODES = {
  BATCH_TOO_LARGE: 'OFFLINE_SYNC_BATCH_TOO_LARGE',
  CLOCK_SKEW_EXCEEDED: 'OFFLINE_SYNC_CLOCK_SKEW_EXCEEDED',
  IDEMPOTENCY_CONFLICT: 'OFFLINE_SYNC_IDEMPOTENCY_CONFLICT',
  CONFLICT_LOST: 'OFFLINE_SYNC_CONFLICT_LOST',
  ALREADY_CHECKED_IN: 'ALREADY_CHECKED_IN',
  EVENT_TYPE_UNSUPPORTED: 'OFFLINE_SYNC_EVENT_TYPE_UNSUPPORTED',
  PAYLOAD_VERSION_UNSUPPORTED: 'OFFLINE_SYNC_PAYLOAD_VERSION_UNSUPPORTED',
  SESSION_NOT_ACTIVE: 'SESSION_NOT_ACTIVE',
  TICKET_NOT_FOUND: 'TICKET_NOT_FOUND',
  CHECKIN_WINDOW_CLOSED: 'CHECKIN_WINDOW_CLOSED',
  EVENT_CANCELLED: 'EVENT_CANCELLED',
  REPLAY_ORDER_INVALID: 'OFFLINE_SYNC_REPLAY_ORDER_INVALID',
  NOT_IMPLEMENTED: 'OFFLINE_SYNC_NOT_IMPLEMENTED',
} as const;

export type OfflineSyncErrorCode =
  (typeof OFFLINE_SYNC_ERROR_CODES)[keyof typeof OFFLINE_SYNC_ERROR_CODES];

export type OfflineSyncItemStatus =
  | 'APPLIED'
  | 'DUPLICATE'
  | 'REJECTED'
  | 'CONFLICT';

export type OfflineSyncEvent = {
  clientEventId: string;
  type: OfflineSyncEventType;
  eventId: string;
  ticketId: string;
  clientOccurredAt: string;
  clientSeq: number;
  payloadVersion: typeof OFFLINE_SYNC_PAYLOAD_VERSION;
};

export type OfflineSyncRequestBody = {
  tenantId: string;
  staffSessionId: string;
  deviceId: string;
  clientClockAt: string;
  events: OfflineSyncEvent[];
};

export type OfflineSyncItemResult = {
  clientEventId: string;
  status: OfflineSyncItemStatus;
  checkinId?: string;
  code?: OfflineSyncErrorCode | string;
  message?: string;
  winningCheckinId?: string;
  winningDeviceId?: string;
};

export type OfflineSyncResponse = {
  serverTime: string;
  maxClockSkewSeconds: number;
  results: OfflineSyncItemResult[];
};

/** Stable Vietnamese copy for staff — key off `code`, not free-text API message. */
export function offlineConflictMessageVi(
  code: string | undefined,
  fallback?: string,
): string {
  switch (code) {
    case OFFLINE_SYNC_ERROR_CODES.ALREADY_CHECKED_IN:
      return 'Vé đã check-in trước đó. Không đồng bộ thêm lượt vào từ hàng đợi offline.';
    case OFFLINE_SYNC_ERROR_CODES.CONFLICT_LOST:
      return 'Xung đột đồng bộ: thiết bị khác đã ghi nhận check-in trước. Không cho vào theo bản offline này.';
    case OFFLINE_SYNC_ERROR_CODES.IDEMPOTENCY_CONFLICT:
      return 'Xung đột idempotency: cùng mã sự kiện nhưng payload khác. Giữ vé và đối soát thủ công.';
    case OFFLINE_SYNC_ERROR_CODES.CLOCK_SKEW_EXCEEDED:
      return 'Đồng hồ thiết bị lệch quá ±300 giây so với máy chủ. Chỉnh giờ rồi thử đồng bộ lại.';
    case OFFLINE_SYNC_ERROR_CODES.BATCH_TOO_LARGE:
      return 'Lô đồng bộ quá lớn. Thử lại — ứng dụng sẽ chia nhỏ hàng đợi.';
    case OFFLINE_SYNC_ERROR_CODES.SESSION_NOT_ACTIVE:
      return 'Phiên nhân viên không còn hiệu lực. Mở phiên mới khi online rồi đồng bộ lại.';
    case OFFLINE_SYNC_ERROR_CODES.TICKET_NOT_FOUND:
      return 'Không tìm thấy vé trong phạm vi tenant. Không cho vào.';
    case OFFLINE_SYNC_ERROR_CODES.CHECKIN_WINDOW_CLOSED:
      return 'Cửa sổ check-in đã đóng. Không cho vào.';
    case OFFLINE_SYNC_ERROR_CODES.EVENT_CANCELLED:
      return 'Sự kiện đã hủy. Không cho vào.';
    case OFFLINE_SYNC_ERROR_CODES.REPLAY_ORDER_INVALID:
      return 'Thứ tự hàng đợi không hợp lệ. Giữ vé và đối soát thủ công.';
    case OFFLINE_SYNC_ERROR_CODES.EVENT_TYPE_UNSUPPORTED:
    case OFFLINE_SYNC_ERROR_CODES.PAYLOAD_VERSION_UNSUPPORTED:
      return 'Phiên bản payload offline không được hỗ trợ. Cập nhật ứng dụng.';
    case OFFLINE_SYNC_ERROR_CODES.NOT_IMPLEMENTED:
      return 'Máy chủ chưa bật apply offline-sync (đang stub). Hàng đợi vẫn được giữ trên máy.';
    default:
      return (
        (fallback && fallback.trim()) ||
        'Đồng bộ offline bị từ chối. Không cho vào cho đến khi đối soát xong.'
      );
  }
}

export function compareOfflineReplayOrder(
  a: Pick<OfflineSyncEvent, 'clientOccurredAt' | 'clientSeq' | 'clientEventId'>,
  b: Pick<OfflineSyncEvent, 'clientOccurredAt' | 'clientSeq' | 'clientEventId'>,
): number {
  if (a.clientOccurredAt < b.clientOccurredAt) return -1;
  if (a.clientOccurredAt > b.clientOccurredAt) return 1;
  if (a.clientSeq !== b.clientSeq) return a.clientSeq - b.clientSeq;
  if (a.clientEventId < b.clientEventId) return -1;
  if (a.clientEventId > b.clientEventId) return 1;
  return 0;
}

export function offlineSyncPath(eventId: string): string {
  return `/v1/gate/events/${eventId}/offline-sync`;
}
