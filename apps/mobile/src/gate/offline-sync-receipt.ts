import type { GateOp } from './gate-scan.ts';
import type { QueuedOfflineScan } from './offline-queue.ts';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CHECKIN_STATES = new Set([
  'CURRENT',
  'UNDONE',
  'TICKET_REVOKED',
  'NO_LONGER_CURRENT',
]);

export type OfflineSyncReceiptCheckinState =
  | 'CURRENT'
  | 'UNDONE'
  | 'TICKET_REVOKED'
  | 'NO_LONGER_CURRENT';

export type ParsedOfflineSyncReceipt = {
  tenantId: string;
  eventId: string;
  clientEventId: string;
  status: 'APPLIED';
  historical: true;
  ticketId: string;
  checkinId: string;
  staffSessionId: string;
  appliedAt: string;
  checkinState: OfflineSyncReceiptCheckinState;
};

export type FetchOfflineSyncReceiptResult =
  | { kind: 'ok'; receipt: ParsedOfflineSyncReceipt }
  | { kind: 'not_found' }
  | { kind: 'auth'; status: 401 | 403 }
  | { kind: 'malformed' }
  | { kind: 'network' };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function readUuid(value: unknown): string | null {
  if (typeof value !== 'string' || !UUID.test(value)) return null;
  return value;
}

function isIsoUtc(value: string): boolean {
  const ms = Date.parse(value);
  return Number.isFinite(ms) && value.endsWith('Z');
}

/** Validate GET body — fail closed on any drift from contract #859. */
export function parseOfflineSyncReceiptResponse(
  json: unknown,
): ParsedOfflineSyncReceipt | null {
  const body = asRecord(json);
  if (!body) return null;
  const tenantId = readUuid(body.tenantId);
  const eventId = readUuid(body.eventId);
  const clientEventId = readUuid(body.clientEventId);
  const ticketId = readUuid(body.ticketId);
  const checkinId = readUuid(body.checkinId);
  const staffSessionId = readUuid(body.staffSessionId);
  const appliedAt =
    typeof body.appliedAt === 'string' && isIsoUtc(body.appliedAt)
      ? body.appliedAt
      : null;
  const checkinState =
    typeof body.checkinState === 'string' &&
    CHECKIN_STATES.has(body.checkinState)
      ? (body.checkinState as OfflineSyncReceiptCheckinState)
      : null;
  if (
    !tenantId ||
    !eventId ||
    !clientEventId ||
    !ticketId ||
    !checkinId ||
    !staffSessionId ||
    !appliedAt ||
    !checkinState ||
    body.status !== 'APPLIED' ||
    body.historical !== true
  ) {
    return null;
  }
  return {
    tenantId,
    eventId,
    clientEventId,
    status: 'APPLIED',
    historical: true,
    ticketId,
    checkinId,
    staffSessionId,
    appliedAt,
    checkinState,
  };
}

export function receiptMatchesGateOp(
  receipt: ParsedOfflineSyncReceipt,
  op: GateOp,
): boolean {
  return (
    receipt.tenantId === op.tenantId &&
    receipt.eventId === op.eventId &&
    receipt.clientEventId === op.clientEventId &&
    receipt.ticketId === op.ticketId &&
    receipt.staffSessionId === op.staffSessionId
  );
}

export function historicalReceiptMessage(
  checkinState: OfflineSyncReceiptCheckinState,
): string {
  switch (checkinState) {
    case 'UNDONE':
      return 'Đã ghi nhận trước đó — lượt check-in này đã được hoàn tác. Không cho vào lại theo bản ghi cũ.';
    case 'TICKET_REVOKED':
      return 'Đã ghi nhận trước đó — vé đã bị thu hồi. Không cho vào.';
    case 'CURRENT':
      return 'Đã ghi nhận trước đó — check-in vẫn là bản ghi hiện tại trên máy chủ. Không tạo lượt vào mới từ đối soát lịch sử.';
    case 'NO_LONGER_CURRENT':
      return 'Đã ghi nhận trước đó — check-in không còn là bản ghi hiện tại. Đối soát trước khi cho qua.';
  }
}

export function gateOpFromHistoricalReceipt(
  op: GateOp,
  receipt: ParsedOfflineSyncReceipt,
): GateOp {
  if (!receiptMatchesGateOp(receipt, op)) return op;
  return {
    ...op,
    phase: 'recorded',
    checkinId: receipt.checkinId,
    admissionKind: undefined,
    historicalCheckinState: receipt.checkinState,
    receiptAppliedAt: receipt.appliedAt,
    message: historicalReceiptMessage(receipt.checkinState),
    recordedAt: receipt.appliedAt,
  };
}

export function offlineSyncReceiptUrl(
  apiBase: string,
  eventId: string,
  clientEventId: string,
  tenantId: string,
): string {
  const base = apiBase.replace(/\/$/, '');
  const params = new URLSearchParams({ tenantId });
  return `${base}/v1/gate/events/${eventId}/offline-sync/receipts/${clientEventId}?${params}`;
}

const DEFAULT_RECEIPT_FETCH_TIMEOUT_MS = 15_000;

async function readResponseText(
  response: Response,
  signal: AbortSignal,
): Promise<string> {
  if (signal.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  return response.text();
}

export async function fetchOfflineSyncReceipt(input: {
  bearer: string;
  apiBase: string;
  tenantId: string;
  eventId: string;
  clientEventId: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<FetchOfflineSyncReceiptResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_RECEIPT_FETCH_TIMEOUT_MS;
  const url = offlineSyncReceiptUrl(
    input.apiBase,
    input.eventId,
    input.clientEventId,
    input.tenantId,
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.bearer}`,
      },
      signal: controller.signal,
    });
    const text = await readResponseText(response, controller.signal);
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        json = null;
      }
    }
    if (response.status === 404) return { kind: 'not_found' };
    if (response.status === 401 || response.status === 403) {
      return { kind: 'auth', status: response.status };
    }
    if (response.status !== 200) return { kind: 'malformed' };
    const receipt = parseOfflineSyncReceiptResponse(json);
    if (!receipt) return { kind: 'malformed' };
    if (
      receipt.tenantId !== input.tenantId ||
      receipt.eventId !== input.eventId ||
      receipt.clientEventId !== input.clientEventId
    ) {
      return { kind: 'malformed' };
    }
    return { kind: 'ok', receipt };
  } catch {
    return { kind: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

const TERMINAL_QUEUE: ReadonlySet<QueuedOfflineScan['localStatus']> = new Set([
  'applied',
  'duplicate',
  'rejected',
  'conflict',
]);

/** Queued/unknown ops still missing a durable local queue receipt after POST replay. */
export function opNeedsHistoricalReceiptLookup(
  op: GateOp,
  queueById: ReadonlyMap<string, QueuedOfflineScan>,
): boolean {
  if (op.phase !== 'queued' && op.phase !== 'unknown') return false;
  if (!op.clientEventId || !UUID.test(op.clientEventId)) return false;
  if (!op.tenantId || !op.eventId || !op.ticketId || !op.staffSessionId) {
    return false;
  }
  const row = queueById.get(op.clientEventId);
  if (!row) return true;
  if (row.tenantId !== op.tenantId || row.eventId !== op.eventId) return true;
  if (row.ticketId !== op.ticketId || row.staffSessionId !== op.staffSessionId) {
    return true;
  }
  return !TERMINAL_QUEUE.has(row.localStatus);
}

export async function reconcileOpsWithHistoricalReceipts(input: {
  ops: readonly GateOp[];
  queueItems: readonly QueuedOfflineScan[];
  bearer: string;
  apiBase: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  shouldContinue: () => boolean;
  onAuthzDenied?: (status: 401 | 403) => void;
}): Promise<GateOp[]> {
  const original = [...input.ops];
  const queueById = new Map(
    input.queueItems.map((row) => [row.clientEventId, row]),
  );
  const next = [...input.ops];
  let changed = false;
  for (let index = 0; index < next.length; index += 1) {
    if (!input.shouldContinue()) return original;
    const op = next[index]!;
    if (!opNeedsHistoricalReceiptLookup(op, queueById)) continue;
    const result = await fetchOfflineSyncReceipt({
      bearer: input.bearer,
      apiBase: input.apiBase,
      tenantId: op.tenantId,
      eventId: op.eventId,
      clientEventId: op.clientEventId!,
      fetchImpl: input.fetchImpl,
      timeoutMs: input.timeoutMs,
    });
    if (!input.shouldContinue()) return original;
    if (result.kind === 'auth') input.onAuthzDenied?.(result.status);
    if (result.kind === 'ok' && receiptMatchesGateOp(result.receipt, op)) {
      const recorded = gateOpFromHistoricalReceipt(op, result.receipt);
      if (recorded !== op) {
        next[index] = recorded;
        changed = true;
      }
      continue;
    }
    if (result.kind === 'malformed' && op.phase === 'queued') {
      next[index] = {
        ...op,
        phase: 'unknown',
        message:
          'Máy chủ trả biên nhận không hợp lệ. Chưa cho vào — cần đối soát.',
      };
      changed = true;
    }
    // not_found / network / auth: leave op unchanged (fail-closed, not server-rejected).
  }
  return changed ? next : original;
}
