import { isMembershipAuthzDenial } from '../identity/staff-eligibility.ts';
import { randomId } from '../lib/random-id.ts';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GATE_UNKNOWN_MESSAGE =
  'Kết quả chưa rõ. Không cho vào. Đối soát trước khi cho bất kỳ ai qua.';

export type ParsedScanDisplayHints = {
  eventName?: string;
  ticketTypeLabel?: string;
  attendeeName?: string;
};

export type ParsedScan = {
  ticketId: string;
  tenantId: string;
  eventId: string;
  /** Optional labels from extended ticket.display paste — not gate proof. */
  displayHints?: ParsedScanDisplayHints;
};

function readOptionalDisplayString(
  body: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = body[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function displayHintsFromJson(
  body: Record<string, unknown>,
): ParsedScanDisplayHints | undefined {
  const eventName = readOptionalDisplayString(body, 'eventName');
  const ticketTypeLabel =
    readOptionalDisplayString(body, 'ticketTypeLabel') ??
    readOptionalDisplayString(body, 'ticketTypeName');
  const attendeeName =
    readOptionalDisplayString(body, 'attendeeName') ??
    readOptionalDisplayString(body, 'holderName') ??
    readOptionalDisplayString(body, 'guestName');
  if (!eventName && !ticketTypeLabel && !attendeeName) return undefined;
  return { eventName, ticketTypeLabel, attendeeName };
}

export type GatePhase =
  | 'holding'
  | 'confirming'
  | 'admitted'
  | 'denied'
  | 'unknown'
  /** Local offline queue — never an admission until server apply. */
  | 'queued'
  /** Historical GET receipt — neutral terminal, never fresh admission. */
  | 'recorded';

export type GateOp = {
  id: string;
  ticketId: string;
  tenantId: string;
  eventId: string;
  staffSessionId: string;
  reservationId?: string;
  token?: string;
  phase: GatePhase;
  checkinId?: string;
  message: string;
  /** Link to SecureStore offline queue row when phase === 'queued'. */
  clientEventId?: string;
  /**
   * UI-only hint when phase === 'admitted'.
   * Does not affect classifyScan / reconcile / supervisor admission class.
   */
  admissionKind?: 'fresh' | 'already';
  /** Device-local history ordering; stamped via stampGateOpsRecordedAt. */
  recordedAt?: string;
  /** Present when phase === 'recorded' (GET historical receipt). */
  historicalCheckinState?:
    | 'CURRENT'
    | 'UNDONE'
    | 'TICKET_REVOKED'
    | 'NO_LONGER_CURRENT';
  receiptAppliedAt?: string;
};

/** Strip zero-width / BOM from camera or paste payloads before parseScan. */
export function normalizeGatePasteInput(raw: string): string {
  return raw.replace(/[\u200B-\u200D\uFEFF]/g, '');
}

export function parseScan(
  raw: string,
  fallback?: { tenantId?: string | null; eventId?: string | null },
): ParsedScan | null {
  const text = raw.trim();
  if (!text) return null;
  if (text.startsWith('{')) {
    try {
      const body = JSON.parse(text) as Record<string, unknown>;
      if (
        body.kind === 'ticket.display' &&
        typeof body.ticketId === 'string' &&
        UUID.test(body.ticketId) &&
        typeof body.tenantId === 'string' &&
        UUID.test(body.tenantId) &&
        typeof body.eventId === 'string' &&
        UUID.test(body.eventId)
      ) {
        return {
          ticketId: body.ticketId,
          tenantId: body.tenantId,
          eventId: body.eventId,
          displayHints: displayHintsFromJson(body),
        };
      }
    } catch {
      return null;
    }
    return null;
  }
  if (!UUID.test(text)) return null;
  const tenantId = fallback?.tenantId?.trim() ?? '';
  const eventId = fallback?.eventId?.trim() ?? '';
  if (!UUID.test(tenantId) || !UUID.test(eventId)) return null;
  return { ticketId: text, tenantId, eventId };
}

export function classifyScan(
  ops: readonly GateOp[],
  ticketId: string,
):
  | { action: 'show'; op: GateOp }
  | { action: 'wait'; op: GateOp }
  | { action: 'start' } {
  const mine = ops.filter((op) => op.ticketId === ticketId);
  const admitted = mine.find((op) => op.phase === 'admitted' && op.checkinId);
  if (admitted) return { action: 'show', op: admitted };
  const recorded = mine.find((op) => op.phase === 'recorded' && op.checkinId);
  if (recorded) return { action: 'show', op: recorded };
  const queued = mine.find((op) => op.phase === 'queued');
  if (queued) return { action: 'wait', op: queued };
  const inflight = mine.find(
    (op) =>
      op.phase === 'holding' ||
      op.phase === 'confirming' ||
      (op.phase === 'unknown' && canReconcile(op)),
  );
  if (inflight) return { action: 'wait', op: inflight };
  return { action: 'start' };
}

/** Restart must not turn an unfinished confirm into an admit. */
export function recoverOps(ops: readonly GateOp[]): GateOp[] {
  return ops.map((op) => {
    if (op.phase === 'holding' || op.phase === 'confirming') {
      return {
        ...op,
        phase: 'unknown',
        message: GATE_UNKNOWN_MESSAGE,
      };
    }
    return op;
  });
}

export function canReconcile(op: GateOp): boolean {
  return op.phase === 'unknown' && Boolean(op.reservationId) && Boolean(op.token);
}

export const SUPERVISOR_NOT_ADMISSION =
  'Không phải lượt vào. Kết quả chưa rõ, hết giờ và lỗi máy chủ không bao giờ cho vào.';

export type SupervisorClass = 'admission' | 'not-admission';

/** Only a recorded check-in is an admission. Unknown/queued are never admissions. */
export function classifySupervisorOp(
  op: Pick<GateOp, 'phase' | 'checkinId'>,
): SupervisorClass {
  if (
    op.phase === 'admitted' &&
    typeof op.checkinId === 'string' &&
    op.checkinId.length > 0
  ) {
    return 'admission';
  }
  return 'not-admission';
}

export function listUnknownGateOps(ops: readonly GateOp[]): GateOp[] {
  return ops.filter((op) => op.phase === 'unknown');
}

type FetchResult = {
  status: number;
  json: unknown;
  networkError: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

export function applyConfirm(op: GateOp, result: FetchResult): GateOp {
  if (result.networkError || result.status === 0 || result.status >= 500) {
    return {
      ...op,
      phase: 'unknown',
      admissionKind: undefined,
      message: GATE_UNKNOWN_MESSAGE,
    };
  }
  const body = asRecord(result.json);
  if (
    (result.status === 200 || result.status === 201) &&
    body?.state === 'USED' &&
    typeof body.checkinId === 'string'
  ) {
    return {
      ...op,
      phase: 'admitted',
      admissionKind: 'fresh',
      checkinId: body.checkinId,
      token: undefined,
      message: 'Cho vào. Đã ghi nhận check-in.',
    };
  }
  if (result.status === 409 && body?.code === 'ALREADY_CHECKED_IN') {
    return {
      ...op,
      phase: 'admitted',
      admissionKind: 'already',
      checkinId: typeof body.checkinId === 'string' ? body.checkinId : op.checkinId,
      token: undefined,
      message:
        'Đã check-in. Kết quả đã rõ — cho vào theo lần ghi nhận trước, không tạo lượt mới.',
    };
  }
  return {
    ...op,
    phase: 'denied',
    admissionKind: undefined,
    token: undefined,
    message:
      typeof body?.message === 'string' && body.message.trim()
        ? body.message
        : 'Từ chối. Không cho vào.',
  };
}

async function readJson(
  fetchImpl: typeof fetch,
  url: string,
  bearer: string,
  body: unknown,
): Promise<FetchResult> {
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        json = null;
      }
    }
    return { status: response.status, json, networkError: false };
  } catch {
    return { status: 0, json: null, networkError: true };
  }
}

export type RunScanResult = {
  ops: GateOp[];
  staffSessionId: string | null;
  current: GateOp | null;
  /** True when the first network hop failed — caller may enqueue offline. */
  networkUnavailable?: boolean;
  parsed?: ParsedScan;
  /**
   * True when a Gate hop returned MEMBERSHIP_* / PERMISSION_DENIED 401/403.
   * Caller must `staffEligibility.reset()` + refresh MeEvents (SEC-CACHE).
   */
  membershipAuthzDenied?: boolean;
};

export async function runScan(input: {
  raw: string;
  bearer: string;
  apiBase: string;
  ops: readonly GateOp[];
  staffSessionId: string | null;
  fallback?: { tenantId?: string | null; eventId?: string | null };
  fetchImpl?: typeof fetch;
  createId?: () => string;
  /** When true and network fails with an existing session, skip reserve/confirm. */
  preferOfflineQueue?: boolean;
  /** Stops later network hops when the verified workspace lifecycle changes. */
  shouldContinue?: () => boolean;
}): Promise<RunScanResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  // Hermes has no global `crypto` — never call crypto.randomUUID() here.
  // Use randomId() (expo-crypto fallback). Bare crypto.randomUUID throws AFTER
  // /sessions+/reservations succeed, wiping toast/history/sessionId (#608).
  const createId = input.createId ?? randomId;
  const parsed = parseScan(input.raw, input.fallback);
  if (!parsed) {
    const current: GateOp = {
      id: createId(),
      ticketId: '',
      tenantId: '',
      eventId: '',
      staffSessionId: input.staffSessionId ?? '',
      phase: 'denied',
      message: 'Mã không đọc được. Không cho vào.',
    };
    return { ops: [...input.ops], staffSessionId: input.staffSessionId, current };
  }
  const existing = classifyScan(input.ops, parsed.ticketId);
  if (existing.action !== 'start') {
    return {
      ops: [...input.ops],
      staffSessionId: input.staffSessionId,
      current: existing.op,
    };
  }

  const base = input.apiBase.replace(/\/$/, '');
  let staffSessionId = input.staffSessionId;
  let membershipAuthzDenied = false;
  const stale = (): RunScanResult => ({ ops: [...input.ops], staffSessionId: input.staffSessionId, current: null });
  if (input.shouldContinue && !input.shouldContinue()) return stale();
  if (!staffSessionId) {
    const opened = await readJson(
      fetchImpl,
      `${base}/v1/gate/events/${parsed.eventId}/sessions`,
      input.bearer,
      { tenantId: parsed.tenantId },
    );
    if (input.shouldContinue && !input.shouldContinue()) return stale();
    const body = asRecord(opened.json);
    if (
      opened.networkError ||
      (opened.status !== 200 && opened.status !== 201) ||
      typeof body?.sessionId !== 'string'
    ) {
      if (opened.networkError) {
        const current: GateOp = {
          id: createId(),
          ...parsed,
          staffSessionId: '',
          phase: 'denied',
          message:
            'Mất mạng và chưa có phiên nhân viên. Cần online một lần để mở phiên trước khi xếp hàng offline.',
        };
        return {
          ops: [current, ...input.ops],
          staffSessionId: null,
          current,
          networkUnavailable: true,
          parsed,
        };
      }
      membershipAuthzDenied = isMembershipAuthzDenial(opened.status, opened.json);
      const current: GateOp = {
        id: createId(),
        ...parsed,
        staffSessionId: '',
        phase: opened.status >= 500 ? 'unknown' : 'denied',
        message:
          opened.status >= 500
            ? GATE_UNKNOWN_MESSAGE
            : typeof body?.message === 'string'
              ? body.message
              : 'Chưa mở phiên nhân viên. Không cho vào.',
      };
      return {
        ops: [current, ...input.ops],
        staffSessionId: null,
        current,
        membershipAuthzDenied: membershipAuthzDenied || undefined,
      };
    }
    staffSessionId = body.sessionId;
  }

  if (input.preferOfflineQueue) {
    return {
      ops: [...input.ops],
      staffSessionId,
      current: null,
      networkUnavailable: true,
      parsed,
    };
  }

  if (input.shouldContinue && !input.shouldContinue()) return stale();

  const reserved = await readJson(
    fetchImpl,
    `${base}/v1/gate/events/${parsed.eventId}/reservations`,
    input.bearer,
    {
      tenantId: parsed.tenantId,
      ticketId: parsed.ticketId,
      staffSessionId,
    },
  );
  if (input.shouldContinue && !input.shouldContinue()) return stale();
  const hold = asRecord(reserved.json);
  if (
    reserved.networkError ||
    (reserved.status !== 200 && reserved.status !== 201) ||
    typeof hold?.reservationId !== 'string' ||
    typeof hold.token !== 'string'
  ) {
    if (reserved.networkError && staffSessionId) {
      return {
        ops: [...input.ops],
        staffSessionId,
        current: null,
        networkUnavailable: true,
        parsed,
      };
    }
    membershipAuthzDenied =
      membershipAuthzDenied ||
      isMembershipAuthzDenial(reserved.status, reserved.json);
    const failed = applyConfirm(
      {
        id: createId(),
        ...parsed,
        staffSessionId,
        phase: 'holding',
        message: '',
      },
      reserved,
    );
    return {
      ops: [failed, ...input.ops],
      staffSessionId,
      current: failed,
      membershipAuthzDenied: membershipAuthzDenied || undefined,
    };
  }

  const confirming: GateOp = {
    id: createId(),
    ...parsed,
    staffSessionId,
    reservationId: hold.reservationId,
    token: hold.token,
    phase: 'confirming',
    message: GATE_UNKNOWN_MESSAGE,
  };
  if (input.shouldContinue && !input.shouldContinue()) return stale();
  const confirmed = await readJson(
    fetchImpl,
    `${base}/v1/gate/events/${parsed.eventId}/reservations/${hold.reservationId}/confirm`,
    input.bearer,
    {
      tenantId: parsed.tenantId,
      staffSessionId,
      token: hold.token,
    },
  );
  if (confirmed.networkError && staffSessionId) {
    // Hold was obtained but confirm never reached the server — queue offline
    // so the scan is not lost; do not treat as admission.
    return {
      ops: [...input.ops],
      staffSessionId,
      current: null,
      networkUnavailable: true,
      parsed,
    };
  }
  membershipAuthzDenied =
    membershipAuthzDenied ||
    isMembershipAuthzDenial(confirmed.status, confirmed.json);
  const current = applyConfirm(confirming, confirmed);
  return {
    ops: [current, ...input.ops],
    staffSessionId,
    current,
    membershipAuthzDenied: membershipAuthzDenied || undefined,
  };
}

/** Build a non-admission GateOp after a successful local enqueue. */
export function gateOpFromQueued(input: {
  id: string;
  ticketId: string;
  tenantId: string;
  eventId: string;
  staffSessionId: string;
  clientEventId: string;
  message?: string;
}): GateOp {
  return {
    id: input.id,
    ticketId: input.ticketId,
    tenantId: input.tenantId,
    eventId: input.eventId,
    staffSessionId: input.staffSessionId,
    phase: 'queued',
    clientEventId: input.clientEventId,
    message:
      input.message ??
      'Đã xếp hàng offline. Chưa cho vào — chờ đồng bộ khi có mạng.',
  };
}

export type ReconcileOpResult = {
  op: GateOp;
  membershipAuthzDenied?: boolean;
};

export async function reconcileOp(input: {
  op: GateOp;
  bearer: string;
  apiBase: string;
  fetchImpl?: typeof fetch;
  shouldContinue?: () => boolean;
}): Promise<ReconcileOpResult> {
  if (!canReconcile(input.op)) return { op: input.op };
  if (input.shouldContinue && !input.shouldContinue()) return { op: input.op };
  const fetchImpl = input.fetchImpl ?? fetch;
  const base = input.apiBase.replace(/\/$/, '');
  const confirmed = await readJson(
    fetchImpl,
    `${base}/v1/gate/events/${input.op.eventId}/reservations/${input.op.reservationId}/confirm`,
    input.bearer,
    {
      tenantId: input.op.tenantId,
      staffSessionId: input.op.staffSessionId,
      token: input.op.token,
    },
  );
  return {
    op: applyConfirm(input.op, confirmed),
    membershipAuthzDenied:
      isMembershipAuthzDenial(confirmed.status, confirmed.json) || undefined,
  };
}
