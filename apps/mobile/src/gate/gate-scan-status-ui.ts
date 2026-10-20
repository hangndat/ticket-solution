import type { GateOp } from './gate-scan.ts';
import {
  presentGateOutcome,
  type GateOutcomeKind,
  type OutcomeTone,
} from './gate-outcome-copy.ts';

export type GateScanStatusKind =
  | 'idle'
  | 'processing'
  | 'holding'
  | 'confirming'
  | 'admitted'
  | 'already-checked-in'
  | 'denied'
  | 'unknown'
  | 'queued';

export type GateScanStatusView = {
  kind: GateScanStatusKind;
  label: string;
  hint: string;
  tone: OutcomeTone;
  /** SF Symbol — success check only for fresh admission. */
  symbol:
    | 'checkmark.circle.fill'
    | 'checkmark.circle'
    | 'xmark.circle.fill'
    | 'questionmark.circle.fill'
    | 'hourglass.circle.fill'
    | 'tray.full.fill'
    | 'wifi.exclamationmark'
    | 'qrcode.viewfinder';
  assertive: boolean;
};

export function presentGateScanStatus(input: {
  busy: boolean;
  op: GateOp | null;
  canReconcile: boolean;
}): GateScanStatusView {
  if (input.busy) {
    return {
      kind: 'processing',
      label: 'Đang kiểm tra',
      hint: 'Chờ phản hồi máy chủ — chưa cho khách qua.',
      tone: 'default',
      symbol: 'hourglass.circle.fill',
      assertive: false,
    };
  }

  const outcome = presentGateOutcome(input.op);
  const phase = input.op?.phase;

  if (!input.op || outcome.kind === 'idle') {
    return {
      kind: 'idle',
      label: 'Sẵn sàng quét',
      hint: 'Đưa QR vào khung hoặc nhập mã thủ công.',
      tone: 'default',
      symbol: 'qrcode.viewfinder',
      assertive: false,
    };
  }

  if (phase === 'holding') {
    return {
      kind: 'holding',
      label: 'Đang giữ chỗ',
      hint: 'Chờ xác nhận — chưa cho vào.',
      tone: 'unknown',
      symbol: 'hourglass.circle.fill',
      assertive: true,
    };
  }

  if (phase === 'confirming') {
    return {
      kind: 'confirming',
      label: 'Đang xác nhận',
      hint: 'Chờ máy chủ — chưa cho khách qua.',
      tone: 'unknown',
      symbol: 'hourglass.circle.fill',
      assertive: true,
    };
  }

  const mapped = mapOutcomeKind(
    outcome.kind,
    input.canReconcile,
    outcome,
    input.op,
  );
  return {
    ...mapped,
    assertive: outcome.assertive,
  };
}

function mapOutcomeKind(
  kind: GateOutcomeKind,
  canReconcile: boolean,
  outcome: ReturnType<typeof presentGateOutcome>,
  op: GateOp | null,
): Omit<GateScanStatusView, 'assertive'> {
  switch (kind) {
    case 'admitted':
      return {
        kind: 'admitted',
        label: 'Đã vào cổng',
        hint: 'Máy chủ đã ghi nhận check-in — có thể cho khách qua.',
        tone: 'admit',
        symbol: 'checkmark.circle.fill',
      };
    case 'already-checked-in':
      return {
        kind: 'already-checked-in',
        label: 'Vé đã dùng',
        hint: 'Cho qua theo lần check-in trước — không tạo lượt mới.',
        tone: 'admit',
        symbol: 'checkmark.circle',
      };
    case 'denied':
      return {
        kind: 'denied',
        label: outcome.title,
        hint: outcome.detail || op?.message || 'Không cho khách qua.',
        tone: 'deny',
        symbol: 'xmark.circle.fill',
      };
    case 'queued':
      return {
        kind: 'queued',
        label: 'Offline — chờ đồng bộ',
        hint: 'Đã lưu trên máy. Đồng bộ khi có mạng — chưa cho vào.',
        tone: 'unknown',
        symbol: 'tray.full.fill',
      };
    case 'unknown':
    case 'holding':
    case 'confirming':
      return {
        kind: 'unknown',
        label: outcome.title,
        hint:
          outcome.detail ||
          (canReconcile
            ? 'Bấm đối soát hoặc kiểm tra lại trước khi cho qua.'
            : 'Đối soát trước khi cho khách qua.'),
        tone: 'unknown',
        symbol: 'questionmark.circle.fill',
      };
    default:
      return {
        kind: 'idle',
        label: 'Sẵn sàng quét',
        hint: 'Đưa QR vào khung hoặc nhập mã thủ công.',
        tone: 'default',
        symbol: 'qrcode.viewfinder',
      };
  }
}

/** Stamp or preserve device-local history time on gate ops. */
export function stampGateOpsRecordedAt(
  next: readonly GateOp[],
  prev: readonly GateOp[],
  nowIso: () => string = () => new Date().toISOString(),
): GateOp[] {
  return next.map((op) => {
    const old = prev.find((row) => row.id === op.id);
    if (
      old &&
      old.phase === op.phase &&
      old.checkinId === op.checkinId &&
      old.message === op.message
    ) {
      return { ...op, recordedAt: old.recordedAt ?? nowIso() };
    }
    return { ...op, recordedAt: nowIso() };
  });
}
