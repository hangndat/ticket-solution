import type { GateOp } from './gate-scan.ts';
import {
  fetchOfflineSyncReceipt,
  gateOpFromHistoricalReceipt,
  type ParsedOfflineSyncReceipt,
  receiptMatchesGateOp,
} from './offline-sync-receipt.ts';
import type { StaffGateScope } from './staff-gate-events.ts';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ImportKnownOperationErrorCode =
  | 'invalid_id'
  | 'not_found'
  | 'auth'
  | 'malformed'
  | 'network'
  | 'stale'
  | 'no_scope'
  | 'no_session';

export type ImportKnownOperationOutcome =
  | { kind: 'imported'; op: GateOp }
  | { kind: 'noop'; op: GateOp; reason: 'already_recorded' }
  | { kind: 'error'; code: ImportKnownOperationErrorCode; message: string };

export function parseKnownClientEventIdInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!UUID.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function findScopedGateOpByClientEventId(
  ops: readonly GateOp[],
  scope: Pick<StaffGateScope, 'tenantId' | 'eventId'>,
  clientEventId: string,
): GateOp | undefined {
  return ops.find(
    (op) =>
      op.clientEventId?.toLowerCase() === clientEventId.toLowerCase() &&
      op.tenantId === scope.tenantId &&
      op.eventId === scope.eventId,
  );
}

/** Seed a recorded GateOp from an authenticated GET receipt when no local op exists. */
export function gateOpFromOrphanHistoricalReceipt(
  receipt: ParsedOfflineSyncReceipt,
): GateOp {
  const seed: GateOp = {
    id: receipt.clientEventId,
    ticketId: receipt.ticketId,
    tenantId: receipt.tenantId,
    eventId: receipt.eventId,
    staffSessionId: receipt.staffSessionId,
    clientEventId: receipt.clientEventId,
    phase: 'unknown',
    message: '',
  };
  return gateOpFromHistoricalReceipt(seed, receipt);
}

export function isRecordedKnownImportNoop(
  existing: GateOp | undefined,
  recorded: GateOp,
): boolean {
  if (!existing || existing.phase !== 'recorded') return false;
  return (
    existing.checkinId === recorded.checkinId &&
    existing.clientEventId === recorded.clientEventId
  );
}

export function mergeKnownOperationImport(
  ops: readonly GateOp[],
  existing: GateOp | undefined,
  recorded: GateOp,
): GateOp[] {
  if (existing) {
    const rest = ops.filter((op) => op.id !== existing.id);
    return [recorded, ...rest];
  }
  const duplicateIndex = ops.findIndex(
    (op) => op.clientEventId === recorded.clientEventId,
  );
  if (duplicateIndex >= 0) {
    const rest = ops.filter((_, index) => index !== duplicateIndex);
    return [recorded, ...rest];
  }
  return [recorded, ...ops];
}

export function importKnownOperationErrorMessage(
  code: ImportKnownOperationErrorCode,
): string {
  switch (code) {
    case 'invalid_id':
      return 'Nhập mã lượt đúng định dạng UUID (ví dụ từ biên nhận đồng bộ).';
    case 'not_found':
      return 'Không tìm thấy biên nhận cho mã lượt này trong sự kiện hiện tại.';
    case 'auth':
      return 'Phiên không hợp lệ — đăng nhập lại trước khi đối soát.';
    case 'malformed':
      return 'Biên nhận không hợp lệ hoặc không khớp mã lượt đã nhập.';
    case 'network':
      return 'Không kết nối được máy chủ. Thử lại khi có mạng.';
    case 'stale':
      return 'Phiên hoặc sự kiện đã đổi trong lúc đối soát — thử lại.';
    case 'no_scope':
      return 'Chọn sự kiện trước khi đối soát mã lượt.';
    case 'no_session':
      return 'Chưa có phiên cổng cho sự kiện này — quay lại màn quét và thử lại.';
  }
}

export type ImportKnownOperationContext = {
  scope: StaffGateScope;
  sessionId: string;
  verifiedUserId: string;
  ops: readonly GateOp[];
  bearer: string;
  apiBase: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  shouldContinue: () => boolean;
  onAuthzDenied?: (status: 401 | 403) => void;
};

export async function importKnownOperationFromReceipt(
  rawClientEventId: string,
  ctx: ImportKnownOperationContext,
): Promise<ImportKnownOperationOutcome> {
  const clientEventId = parseKnownClientEventIdInput(rawClientEventId);
  if (!ctx.shouldContinue()) {
    return { kind: 'error', code: 'stale', message: importKnownOperationErrorMessage('stale') };
  }
  if (!clientEventId) {
    return {
      kind: 'error',
      code: 'invalid_id',
      message: importKnownOperationErrorMessage('invalid_id'),
    };
  }
  if (!ctx.scope?.tenantId || !ctx.scope?.eventId) {
    return {
      kind: 'error',
      code: 'no_scope',
      message: importKnownOperationErrorMessage('no_scope'),
    };
  }
  if (!ctx.sessionId) {
    return {
      kind: 'error',
      code: 'no_session',
      message: importKnownOperationErrorMessage('no_session'),
    };
  }

  const existing = findScopedGateOpByClientEventId(
    ctx.ops,
    ctx.scope,
    clientEventId,
  );
  if (existing?.phase === 'recorded') {
    if (!ctx.shouldContinue()) {
      return { kind: 'error', code: 'stale', message: importKnownOperationErrorMessage('stale') };
    }
    return {
      kind: 'noop',
      op: existing,
      reason: 'already_recorded',
    };
  }

  if (!ctx.shouldContinue()) {
    return { kind: 'error', code: 'stale', message: importKnownOperationErrorMessage('stale') };
  }
  const result = await fetchOfflineSyncReceipt({
    bearer: ctx.bearer,
    apiBase: ctx.apiBase,
    tenantId: ctx.scope.tenantId,
    eventId: ctx.scope.eventId,
    clientEventId,
    fetchImpl: ctx.fetchImpl,
    timeoutMs: ctx.timeoutMs,
  });

  if (!ctx.shouldContinue()) {
    return {
      kind: 'error',
      code: 'stale',
      message: importKnownOperationErrorMessage('stale'),
    };
  }

  if (result.kind === 'not_found') {
    return {
      kind: 'error',
      code: 'not_found',
      message: importKnownOperationErrorMessage('not_found'),
    };
  }
  if (result.kind === 'auth') {
    ctx.onAuthzDenied?.(result.status);
    return {
      kind: 'error',
      code: 'auth',
      message: importKnownOperationErrorMessage('auth'),
    };
  }
  if (result.kind === 'network') {
    return {
      kind: 'error',
      code: 'network',
      message: importKnownOperationErrorMessage('network'),
    };
  }
  if (result.kind !== 'ok') {
    return {
      kind: 'error',
      code: 'malformed',
      message: importKnownOperationErrorMessage('malformed'),
    };
  }

  const receipt = result.receipt;
  let recorded: GateOp;
  if (existing) {
    if (!receiptMatchesGateOp(receipt, existing)) {
      return {
        kind: 'error',
        code: 'malformed',
        message: importKnownOperationErrorMessage('malformed'),
      };
    }
    recorded = gateOpFromHistoricalReceipt(existing, receipt);
  } else {
    if (receipt.clientEventId !== clientEventId) {
      return {
        kind: 'error',
        code: 'malformed',
        message: importKnownOperationErrorMessage('malformed'),
      };
    }
    recorded = gateOpFromOrphanHistoricalReceipt(receipt);
  }

  if (!ctx.shouldContinue()) {
    return {
      kind: 'error',
      code: 'stale',
      message: importKnownOperationErrorMessage('stale'),
    };
  }

  if (isRecordedKnownImportNoop(existing, recorded)) {
    return {
      kind: 'noop',
      op: existing ?? recorded,
      reason: 'already_recorded',
    };
  }

  return { kind: 'imported', op: recorded };
}

export function applyKnownOperationImportToOps(
  ops: readonly GateOp[],
  existing: GateOp | undefined,
  recorded: GateOp,
): GateOp[] {
  return mergeKnownOperationImport(ops, existing, recorded);
}
