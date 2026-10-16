const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GATE_UNKNOWN_MESSAGE =
  'Result unknown. Do not admit. Reconcile before letting anyone through.';

export type ParsedScan = {
  ticketId: string;
  tenantId: string;
  eventId: string;
};

export type GatePhase =
  | 'holding'
  | 'confirming'
  | 'admitted'
  | 'denied'
  | 'unknown';

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
};

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
    return { ...op, phase: 'unknown', message: GATE_UNKNOWN_MESSAGE };
  }
  const body = asRecord(result.json);
  if (
    result.status === 200 &&
    body?.state === 'USED' &&
    typeof body.checkinId === 'string'
  ) {
    return {
      ...op,
      phase: 'admitted',
      checkinId: body.checkinId,
      token: undefined,
      message: 'Admitted. Check-in recorded.',
    };
  }
  if (result.status === 409 && body?.code === 'ALREADY_CHECKED_IN') {
    return {
      ...op,
      phase: 'admitted',
      checkinId: typeof body.checkinId === 'string' ? body.checkinId : op.checkinId,
      token: undefined,
      message: 'Already checked in. Known result — admit, do not confirm again.',
    };
  }
  return {
    ...op,
    phase: 'denied',
    token: undefined,
    message:
      typeof body?.message === 'string' && body.message.trim()
        ? body.message
        : 'Denied. Do not admit.',
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

export async function runScan(input: {
  raw: string;
  bearer: string;
  apiBase: string;
  ops: readonly GateOp[];
  staffSessionId: string | null;
  fallback?: { tenantId?: string | null; eventId?: string | null };
  fetchImpl?: typeof fetch;
  createId?: () => string;
}): Promise<{ ops: GateOp[]; staffSessionId: string | null; current: GateOp | null }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const createId = input.createId ?? (() => crypto.randomUUID());
  const parsed = parseScan(input.raw, input.fallback);
  if (!parsed) {
    const current: GateOp = {
      id: createId(),
      ticketId: '',
      tenantId: '',
      eventId: '',
      staffSessionId: input.staffSessionId ?? '',
      phase: 'denied',
      message: 'Unreadable code. Do not admit.',
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
  if (!staffSessionId) {
    const opened = await readJson(
      fetchImpl,
      `${base}/v1/gate/events/${parsed.eventId}/sessions`,
      input.bearer,
      { tenantId: parsed.tenantId },
    );
    const body = asRecord(opened.json);
    if (opened.networkError || opened.status !== 200 || typeof body?.sessionId !== 'string') {
      const current: GateOp = {
        id: createId(),
        ...parsed,
        staffSessionId: '',
        phase: opened.networkError || opened.status >= 500 ? 'unknown' : 'denied',
        message:
          opened.networkError || opened.status >= 500
            ? GATE_UNKNOWN_MESSAGE
            : typeof body?.message === 'string'
              ? body.message
              : 'Staff session was not opened. Do not admit.',
      };
      return {
        ops: [current, ...input.ops],
        staffSessionId: null,
        current,
      };
    }
    staffSessionId = body.sessionId;
  }

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
  const hold = asRecord(reserved.json);
  if (
    reserved.networkError ||
    reserved.status !== 200 ||
    typeof hold?.reservationId !== 'string' ||
    typeof hold.token !== 'string'
  ) {
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
  const current = applyConfirm(confirming, confirmed);
  return { ops: [current, ...input.ops], staffSessionId, current };
}

export async function reconcileOp(input: {
  op: GateOp;
  bearer: string;
  apiBase: string;
  fetchImpl?: typeof fetch;
}): Promise<GateOp> {
  if (!canReconcile(input.op)) return input.op;
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
  return applyConfirm(input.op, confirmed);
}
