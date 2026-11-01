import { isMembershipAuthzDenial } from '../identity/staff-eligibility.ts';
import { randomId } from '../lib/random-id.ts';
import type { PresentedGateCredential } from '@ticket/contracts';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GATE_UNKNOWN_MESSAGE =
  'Kết quả chưa rõ. Không cho vào. Đối soát trước khi cho bất kỳ ai qua.';

export type ParsedScan = {
  ticketId: string;
  tenantId: string;
  eventId: string;
  /** Server verifies this proof; decoded claims below are only local context. */
  presented?: PresentedGateCredential;
};

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

function decodeUnverifiedQrContext(jws: string):
  | { ticketId: string; tenantId: string; eventId: string }
  | null {
  const parts = jws.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) return null;
  const decode = globalThis.atob;
  if (typeof decode !== 'function') return null;
  try {
    const base64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(decode(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as Record<string, unknown>;
    if (
      typeof claims.tkt !== 'string' || !UUID.test(claims.tkt) ||
      typeof claims.tid !== 'string' || !UUID.test(claims.tid) ||
      typeof claims.eid !== 'string' || !UUID.test(claims.eid) ||
      typeof claims.ver !== 'number' || !Number.isInteger(claims.ver) || claims.ver < 1
    ) return null;
    return { ticketId: claims.tkt, tenantId: claims.tid, eventId: claims.eid };
  } catch {
    return null;
  }
}

export function parseScan(raw: string): ParsedScan | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    if (body.v !== 1 || body.kind !== 'ticket.gate_credential' || typeof body.jws !== 'string') return null;
    const context = decodeUnverifiedQrContext(body.jws);
    if (!context) return null;
    return { ...context, presented: { kind: 'qr', jws: body.jws } };
  } catch {
    return null;
  }
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
    message: gateFailureMessage(body, 'Từ chối. Không cho vào.'),
  };
}

function gateFailureMessage(
  body: Record<string, unknown> | null,
  fallback: string,
): string {
  switch (body?.code) {
    case 'MANUAL_CODE_INVALID':
      return 'Mã nhập tay không đúng hoặc không còn hiệu lực. Không cho vào.';
    case 'MANUAL_PROOF_INVALID':
      return 'Mã xác minh đã hết hạn. Tra mã lại và thử lại.';
    case 'CREDENTIAL_VERSION_STALE':
      return 'Vé đã được cấp lại. Hãy dùng mã mới trên vé.';
    case 'CREDENTIAL_CONTEXT_MISMATCH':
      return 'Vé không thuộc sự kiện đang chọn. Không cho vào.';
    case 'CREDENTIAL_SIGNATURE_INVALID':
    case 'CREDENTIAL_REQUIRED':
      return 'QR không hợp lệ. Mở vé trong ứng dụng và thử lại.';
    case 'TICKET_NOT_ACTIVE':
    case 'TICKET_REVOKED':
      return 'Vé đã bị thu hồi hoặc không còn hiệu lực. Không cho vào.';
    default:
      return fallback;
  }
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
  /** Manual lookup proofs are online-only; only a QR scan may use ADR-18 queueing. */
  offlineQueueEligible?: boolean;
  /** O31: set only when this call opened the session (silent first-scan fallback). */
  openedSessionGate?: { gateId: string | null; gateName: string | null };
  /**
   * True when a Gate hop returned MEMBERSHIP_* / PERMISSION_DENIED 401/403.
   * Caller must `staffEligibility.reset()` + refresh MeEvents (SEC-CACHE).
   */
  membershipAuthzDenied?: boolean;
};

export async function runScan(input: {
  raw: string;
  /** Manual codes are looked up online and never written to Gate history or logs. */
  manualEntryCode?: string;
  bearer: string;
  apiBase: string;
  ops: readonly GateOp[];
  staffSessionId: string | null;
  /** O31: gate to attach when this call has to open the session itself. */
  gateId?: string | null;
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
  const manualCode = input.manualEntryCode?.trim() ?? '';
  const fallbackTenantId = input.fallback?.tenantId?.trim() ?? '';
  const fallbackEventId = input.fallback?.eventId?.trim() ?? '';
  const parsedQr = manualCode ? null : parseScan(input.raw);
  let parsed = manualCode
    ? UUID.test(fallbackTenantId) && UUID.test(fallbackEventId)
      ? { ticketId: '', tenantId: fallbackTenantId, eventId: fallbackEventId }
      : null
    : parsedQr
      ? {
          ...parsedQr,
          // Route admission through the selected staff workspace. The backend
          // verifies that the signed claims match this tenant/event context.
          tenantId: UUID.test(fallbackTenantId) ? fallbackTenantId : parsedQr.tenantId,
          eventId: UUID.test(fallbackEventId) ? fallbackEventId : parsedQr.eventId,
        }
      : null;
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
  const existing = parsed.ticketId
    ? classifyScan(input.ops, parsed.ticketId)
    : { action: 'start' as const };
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
  let openedSessionGate: RunScanResult['openedSessionGate'];
  const stale = (): RunScanResult => ({ ops: [...input.ops], staffSessionId: input.staffSessionId, current: null });
  if (input.shouldContinue && !input.shouldContinue()) return stale();
  if (!staffSessionId) {
    const opened = await readJson(
      fetchImpl,
      `${base}/v1/gate/events/${parsed.eventId}/sessions`,
      input.bearer,
      input.gateId
        ? { tenantId: parsed.tenantId, gateId: input.gateId }
        : { tenantId: parsed.tenantId },
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
          ticketId: parsed.ticketId,
          tenantId: parsed.tenantId,
          eventId: parsed.eventId,
          staffSessionId: '',
          phase: 'denied',
          message:
            manualCode
              ? 'Mất mạng. Mã nhập tay cần được xác minh trực tuyến; không cho vào.'
              : 'Mất mạng và chưa có phiên nhân viên. Cần online một lần để mở phiên trước khi xếp hàng offline.',
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
        ticketId: parsed.ticketId,
        tenantId: parsed.tenantId,
        eventId: parsed.eventId,
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
    openedSessionGate = {
      gateId: typeof body.gateId === 'string' ? body.gateId : null,
      gateName: typeof body.gateName === 'string' ? body.gateName : null,
    };
  }

  if (input.preferOfflineQueue) {
    if (manualCode) {
      const current: GateOp = {
        id: createId(), ticketId: '', tenantId: parsed.tenantId,
        eventId: parsed.eventId, staffSessionId,
        phase: 'denied',
        message: 'Mất mạng. Mã nhập tay cần được kiểm tra trực tuyến; không cho vào.',
      };
      return { ops: [current, ...input.ops], staffSessionId, current, networkUnavailable: true };
    }
    return {
      ops: [...input.ops],
      staffSessionId,
      current: null,
      networkUnavailable: true,
      parsed,
      offlineQueueEligible: true,
      openedSessionGate,
    };
  }

  let presented = parsed.presented;
  if (manualCode) {
    if (!staffSessionId) {
      const current: GateOp = {
        id: createId(), ticketId: '', tenantId: parsed.tenantId,
        eventId: parsed.eventId, staffSessionId: '', phase: 'denied',
        message: 'Chưa mở phiên nhân viên. Kết nối mạng để kiểm tra mã.',
      };
      return { ops: [current, ...input.ops], staffSessionId: null, current, networkUnavailable: true };
    }
    const lookup = await readJson(
      fetchImpl,
      `${base}/v1/gate/events/${parsed.eventId}/manual-lookup`,
      input.bearer,
      { tenantId: parsed.tenantId, staffSessionId, code: manualCode },
    );
    if (input.shouldContinue && !input.shouldContinue()) return stale();
    const lookupBody = asRecord(lookup.json);
    if (
      lookup.networkError || lookup.status !== 200 ||
      typeof lookupBody?.ticketId !== 'string' || !UUID.test(lookupBody.ticketId) ||
      typeof lookupBody.proofToken !== 'string' || !lookupBody.proofToken
    ) {
      const current: GateOp = {
        id: createId(), ticketId: '', tenantId: parsed.tenantId,
        eventId: parsed.eventId, staffSessionId,
        phase: lookup.networkError || lookup.status >= 500 ? 'unknown' : 'denied',
        message: lookup.networkError || lookup.status >= 500
          ? 'Không kết nối được máy chủ. Mã chưa được xác minh; không cho vào.'
          : gateFailureMessage(lookupBody, 'Không xác minh được mã. Không cho vào.'),
      };
      membershipAuthzDenied = isMembershipAuthzDenial(lookup.status, lookup.json);
      return {
        ops: [current, ...input.ops], staffSessionId, current,
        networkUnavailable: lookup.networkError || lookup.status >= 500,
        membershipAuthzDenied: membershipAuthzDenied || undefined,
      };
    }
    parsed = {
      ticketId: lookupBody.ticketId,
      tenantId: parsed.tenantId,
      eventId: parsed.eventId,
    };
    presented = { kind: 'manual', proofToken: lookupBody.proofToken };
    const existingAfterLookup = classifyScan(input.ops, parsed.ticketId);
    if (existingAfterLookup.action !== 'start') {
      return { ops: [...input.ops], staffSessionId, current: existingAfterLookup.op };
    }
  }

  if (!presented) {
    const current: GateOp = {
      id: createId(), ticketId: parsed.ticketId,
      tenantId: parsed.tenantId, eventId: parsed.eventId, staffSessionId,
      phase: 'denied', message: 'QR không hợp lệ. Không cho vào.',
    };
    return { ops: [current, ...input.ops], staffSessionId, current };
  }

  if (input.shouldContinue && !input.shouldContinue()) return stale();

  const reserved = await readJson(
    fetchImpl,
    `${base}/v1/gate/events/${parsed.eventId}/reservations`,
    input.bearer,
    {
      tenantId: parsed.tenantId,
      staffSessionId,
      presented,
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
      if (manualCode) {
        const current: GateOp = {
          id: createId(), ticketId: parsed.ticketId,
          tenantId: parsed.tenantId, eventId: parsed.eventId,
          staffSessionId, phase: 'unknown',
          message: 'Mất kết nối sau khi tra mã. Chưa xác nhận vào cổng; không cho vào.',
        };
        return {
          ops: [current, ...input.ops], staffSessionId, current,
          networkUnavailable: true, offlineQueueEligible: false,
        };
      }
      return {
        ops: [...input.ops],
        staffSessionId,
        current: null,
        networkUnavailable: true,
        parsed,
        offlineQueueEligible: !manualCode,
      };
    }
    membershipAuthzDenied =
      membershipAuthzDenied ||
      isMembershipAuthzDenial(reserved.status, reserved.json);
    const failed = applyConfirm(
      {
        id: createId(),
        ticketId: parsed.ticketId,
        tenantId: parsed.tenantId,
        eventId: parsed.eventId,
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
      openedSessionGate,
      membershipAuthzDenied: membershipAuthzDenied || undefined,
    };
  }

  const confirming: GateOp = {
    id: createId(),
    ticketId: parsed.ticketId,
    tenantId: parsed.tenantId,
    eventId: parsed.eventId,
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
      offlineQueueEligible: !manualCode,
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
    openedSessionGate,
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
