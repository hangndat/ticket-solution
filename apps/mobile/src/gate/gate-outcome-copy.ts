/**
 * Pure UX presentation for Gate staff scan / offline queue (PD §2.4 · ADR-18).
 * Does not change race protocol, classifyScan, or reconcile behavior.
 */

import type { GateOp, GatePhase } from './gate-scan.ts';
import type { OfflineLocalStatus } from './offline-queue.ts';

export type OutcomeTone = 'admit' | 'deny' | 'unknown' | 'default';

export type GateOutcomeKind =
  | 'idle'
  | 'holding'
  | 'confirming'
  | 'admitted'
  | 'already-checked-in'
  | 'denied'
  | 'unknown'
  | 'queued';

export type GateOutcomeView = {
  kind: GateOutcomeKind;
  title: string;
  detail: string;
  tone: OutcomeTone;
  /** Assertive live region for unknown / queued / conflict-class outcomes. */
  assertive: boolean;
};

export type QueueStatusView = {
  status: OfflineLocalStatus;
  /** Short chip label (VI, user-facing). */
  label: string;
  /** One-line explanation — never treat duplicate/conflict as new admit. */
  detail: string;
  tone: OutcomeTone;
  /** Server status token for secondary selectable text (APPLIED / …). */
  serverToken: string;
};

const ALREADY_MESSAGE = /đã check-in/i;

/**
 * Map GateOp → large outcome canvas copy.
 * unknown / queued never use admit (green).
 * ALREADY_CHECKED_IN stays phase=admitted for protocol but distinct title/kind.
 */
export function presentGateOutcome(op: GateOp | null): GateOutcomeView {
  if (!op) {
    return {
      kind: 'idle',
      title: 'Chờ mã quét',
      detail:
        'Đưa QR trên vé vào khung hoặc dán mã. Chỉ cho vào sau khi hệ thống ghi nhận check-in.',
      tone: 'default',
      assertive: false,
    };
  }

  if (op.phase === 'queued') {
    return {
      kind: 'queued',
      title: 'Đã xếp hàng — chưa cho vào',
      detail:
        op.message ||
        'Lưu trên máy. Đồng bộ khi có mạng — không cho khách qua sớm. Không chống trùng đa thiết bị khi còn offline.',
      tone: 'unknown',
      assertive: true,
    };
  }

  if (op.phase === 'unknown' || op.phase === 'holding' || op.phase === 'confirming') {
    const kind: GateOutcomeKind =
      op.phase === 'unknown' ? 'unknown' : op.phase;
    return {
      kind,
      title: 'Chưa rõ — không cho vào',
      detail:
        op.message ||
        'Kết quả chưa rõ. Đối soát trước khi cho bất kỳ ai qua.',
      tone: 'unknown',
      assertive: true,
    };
  }

  if (op.phase === 'denied') {
    return {
      kind: 'denied',
      title: 'Không cho vào',
      detail: op.message || 'Vé không hợp lệ hoặc bị từ chối.',
      tone: 'deny',
      assertive: false,
    };
  }

  if (op.phase === 'admitted') {
    const already =
      op.admissionKind === 'already' || ALREADY_MESSAGE.test(op.message);
    if (already) {
      return {
        kind: 'already-checked-in',
        title: 'Vé đã được sử dụng',
        detail:
          op.message ||
          'Vé này đã được ghi nhận vào cổng. Cho qua theo kết quả đã có — không tạo lượt mới.',
        tone: 'admit',
        assertive: false,
      };
    }
    return {
      kind: 'admitted',
      title: 'Được vào',
      detail: op.message || 'Đã ghi nhận check-in.',
      tone: 'admit',
      assertive: false,
    };
  }

  return {
    kind: 'unknown',
    title: 'Chưa rõ — không cho vào',
    detail: op.message || 'Không xác định kết quả. Không cho vào.',
    tone: 'unknown',
    assertive: true,
  };
}

/** Announcement phase for a11y — queued maps to unknown (never admission). */
export function announcementPhaseFor(
  phase: GatePhase | undefined,
): 'admitted' | 'unknown' | 'denied' | 'confirming' | 'holding' | string {
  if (!phase) return 'idle';
  if (phase === 'queued') return 'unknown';
  return phase;
}

export function presentQueueStatus(status: OfflineLocalStatus): QueueStatusView {
  switch (status) {
    case 'pending':
      return {
        status,
        label: 'Chờ đồng bộ',
        detail: 'Đang xếp hàng trên máy — chưa cho vào.',
        tone: 'unknown',
        serverToken: 'pending',
      };
    case 'syncing':
      return {
        status,
        label: 'Đang đồng bộ',
        detail: 'Đang gửi lên máy chủ — chưa cho vào.',
        tone: 'unknown',
        serverToken: 'syncing',
      };
    case 'applied':
      return {
        status,
        label: 'Đã áp dụng',
        detail: 'Máy chủ đã ghi nhận check-in sau đồng bộ.',
        tone: 'admit',
        serverToken: 'APPLIED',
      };
    case 'duplicate':
      return {
        status,
        label: 'Trùng thao tác',
        detail: 'Máy chủ đã áp dụng sự kiện này trước — không phải lượt vào mới.',
        tone: 'unknown',
        serverToken: 'DUPLICATE',
      };
    case 'conflict':
      return {
        status,
        label: 'Xung đột',
        detail: 'Xung đột đồng bộ — không phải lượt vào mới. Cần đối soát.',
        tone: 'unknown',
        serverToken: 'CONFLICT',
      };
    case 'rejected':
      return {
        status,
        label: 'Từ chối',
        detail: 'Máy chủ từ chối mục offline — không cho vào.',
        tone: 'deny',
        serverToken: 'REJECTED',
      };
  }
}

/** Short hex / UUID for context strip — never primary staff chrome. */
export function shortId(value: string | null | undefined, keep = 8): string {
  const v = value?.trim() ?? '';
  if (!v) return '—';
  if (v.length <= keep) return v;
  return `${v.slice(0, keep)}…`;
}

export function connectivityLabel(
  state: 'online' | 'offline' | 'unknown',
): string {
  if (state === 'online') return 'Trực tuyến';
  if (state === 'offline') return 'Ngoại tuyến';
  return 'Mạng chưa rõ';
}

export function sessionLabel(status: string): string {
  switch (status) {
    case 'verified':
      return 'Phiên staff đã xác minh';
    case 'anonymous':
    case 'signed-out':
      return 'Chưa đăng nhập staff';
    case 'unreachable':
      return 'Phiên chưa xác minh được';
    default:
      return `Phiên: ${status}`;
  }
}
