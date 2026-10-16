export const SUPERVISOR_UNKNOWN_MESSAGE =
  'Result unknown. Do not show this guest as admitted.';

export type SupervisorAction =
  | 'open-session'
  | 'revoke-session'
  | 'reserve'
  | 'confirm'
  | 'undo'
  | 'revoke-ticket';

export type SupervisorPhase =
  | 'idle'
  | 'session-active'
  | 'session-revoked'
  | 'holding'
  | 'admitted'
  | 'undone'
  | 'ticket-revoked'
  | 'denied'
  | 'unknown';

export type SupervisorSnapshot = {
  phase: SupervisorPhase;
  admitted: boolean;
  message: string;
  sessionId?: string;
  reservationId?: string;
  token?: string;
  checkinId?: string;
  ticketId?: string;
};

export type SupervisorFetchResult = {
  status: number;
  json: unknown;
  networkError: boolean;
};

export function idleSnapshot(): SupervisorSnapshot {
  return {
    phase: 'idle',
    admitted: false,
    message: 'No gate result yet. Do not admit.',
  };
}

/** Admit copy is allowed only after a known USED check-in. */
export function presentsAsAdmitted(snapshot: SupervisorSnapshot): boolean {
  return snapshot.phase === 'admitted' && snapshot.admitted === true;
}

export function outcomeTitle(snapshot: SupervisorSnapshot): string {
  if (presentsAsAdmitted(snapshot)) return 'Admit';
  if (snapshot.phase === 'unknown') return 'Unknown — do not admit';
  return 'Do not admit';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

export function isUncertainTransport(result: SupervisorFetchResult): boolean {
  return result.networkError || result.status === 0 || result.status >= 500;
}

function unknown(previous: SupervisorSnapshot): SupervisorSnapshot {
  return {
    ...previous,
    phase: 'unknown',
    admitted: false,
    message: SUPERVISOR_UNKNOWN_MESSAGE,
  };
}

function denied(
  previous: SupervisorSnapshot,
  result: SupervisorFetchResult,
  fallback: string,
): SupervisorSnapshot {
  const body = asRecord(result.json);
  const message =
    typeof body?.message === 'string' && body.message.trim()
      ? body.message
      : fallback;
  return {
    ...previous,
    phase: 'denied',
    admitted: false,
    message,
  };
}

export function applySupervisorResult(input: {
  action: SupervisorAction;
  result: SupervisorFetchResult;
  previous: SupervisorSnapshot;
}): SupervisorSnapshot {
  const { action, result, previous } = input;
  if (isUncertainTransport(result)) return unknown(previous);

  const body = asRecord(result.json);

  if (action === 'open-session') {
    if (result.status === 200 && typeof body?.sessionId === 'string') {
      return {
        ...previous,
        phase: 'session-active',
        admitted: false,
        sessionId: body.sessionId,
        message: 'Staff session is open. A session is not an admission.',
      };
    }
    return denied(previous, result, 'Staff session was not opened. Do not admit.');
  }

  if (action === 'revoke-session') {
    if (result.status === 200 && body?.status === 'REVOKED') {
      return {
        ...previous,
        phase: 'session-revoked',
        admitted: false,
        sessionId: undefined,
        reservationId: undefined,
        token: undefined,
        message: 'Staff session revoked. Do not admit on this session.',
      };
    }
    return denied(previous, result, 'Staff session was not revoked. Do not admit.');
  }

  if (action === 'reserve') {
    if (
      result.status === 200 &&
      typeof body?.reservationId === 'string' &&
      typeof body.token === 'string'
    ) {
      return {
        ...previous,
        phase: 'holding',
        admitted: false,
        reservationId: body.reservationId,
        token: body.token,
        ticketId:
          typeof body.ticketId === 'string' ? body.ticketId : previous.ticketId,
        message: 'Hold reserved. Do not admit until confirm succeeds.',
      };
    }
    return denied(previous, result, 'Reservation failed. Do not admit.');
  }

  if (action === 'confirm') {
    if (
      result.status === 200 &&
      body?.state === 'USED' &&
      typeof body.checkinId === 'string'
    ) {
      return {
        ...previous,
        phase: 'admitted',
        admitted: true,
        checkinId: body.checkinId,
        token: undefined,
        message: 'Admitted. Check-in recorded.',
      };
    }
    if (result.status === 409 && body?.code === 'ALREADY_CHECKED_IN') {
      return {
        ...previous,
        phase: 'admitted',
        admitted: true,
        checkinId:
          typeof body.checkinId === 'string' ? body.checkinId : previous.checkinId,
        token: undefined,
        message: 'Already checked in. Known result — admit, do not confirm again.',
      };
    }
    if (result.status === 200) return unknown(previous);
    return denied(previous, result, 'Confirm denied. Do not admit.');
  }

  if (action === 'undo') {
    if (
      result.status === 200 &&
      body?.state === 'ACTIVE' &&
      typeof body.checkinId === 'string'
    ) {
      return {
        ...previous,
        phase: 'undone',
        admitted: false,
        checkinId: body.checkinId,
        message: 'Check-in undone. Do not admit.',
      };
    }
    if (result.status === 409 && body?.code === 'CHECKIN_ALREADY_UNDONE') {
      return {
        ...previous,
        phase: 'undone',
        admitted: false,
        message: 'Check-in was already undone. Do not admit.',
      };
    }
    if (result.status === 200) return unknown(previous);
    return denied(previous, result, 'Undo was not recorded. Do not admit.');
  }

  if (result.status === 200 && body?.status === 'REVOKED') {
    return {
      ...previous,
      phase: 'ticket-revoked',
      admitted: false,
      token: undefined,
      reservationId: undefined,
      message: 'Ticket revoked. Do not admit.',
    };
  }
  if (result.status === 200) return unknown(previous);
  return denied(previous, result, 'Ticket was not revoked. Do not admit.');
}

async function readJson(
  fetchImpl: typeof fetch,
  url: string,
  bearer: string,
  body: unknown,
): Promise<SupervisorFetchResult> {
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

export async function performSupervisorAction(input: {
  action: SupervisorAction;
  bearer: string;
  apiBase: string;
  tenantId: string;
  eventId: string;
  previous: SupervisorSnapshot;
  ticketId?: string;
  reason?: string;
  fetchImpl?: typeof fetch;
}): Promise<SupervisorSnapshot> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const base = input.apiBase.replace(/\/$/, '');
  const event = `${base}/v1/gate/events/${input.eventId}`;
  const previous = input.previous;
  let url = '';
  let body: Record<string, string> = { tenantId: input.tenantId };

  if (input.action === 'open-session') {
    url = `${event}/sessions`;
  } else if (input.action === 'revoke-session') {
    if (!previous.sessionId) {
      return denied(
        previous,
        { status: 422, json: null, networkError: false },
        'Open a staff session before revoking it.',
      );
    }
    url = `${event}/sessions/revoke`;
    body = { ...body, staffSessionId: previous.sessionId };
  } else if (input.action === 'reserve') {
    if (!previous.sessionId || !input.ticketId) {
      return denied(
        previous,
        { status: 422, json: null, networkError: false },
        'Open a session and choose a ticket before reserving.',
      );
    }
    url = `${event}/reservations`;
    body = {
      ...body,
      ticketId: input.ticketId,
      staffSessionId: previous.sessionId,
    };
  } else if (input.action === 'confirm') {
    if (!previous.sessionId || !previous.reservationId || !previous.token) {
      return denied(
        previous,
        { status: 422, json: null, networkError: false },
        'Reserve a hold before confirming. Do not admit.',
      );
    }
    url = `${event}/reservations/${previous.reservationId}/confirm`;
    body = {
      ...body,
      staffSessionId: previous.sessionId,
      token: previous.token,
    };
  } else if (input.action === 'undo') {
    const reason = input.reason?.trim() ?? '';
    if (!previous.checkinId || !reason) {
      return denied(
        previous,
        { status: 422, json: null, networkError: false },
        'Undo needs a recorded check-in and a reason. Do not admit.',
      );
    }
    url = `${event}/checkins/${previous.checkinId}/undo`;
    body = { ...body, reason };
  } else {
    const reason = input.reason?.trim() ?? '';
    const ticketId = input.ticketId ?? previous.ticketId;
    if (!ticketId || !reason) {
      return denied(
        previous,
        { status: 422, json: null, networkError: false },
        'Revoke needs a ticket and a reason. Do not admit.',
      );
    }
    url = `${event}/tickets/${ticketId}/revoke`;
    body = { ...body, reason };
  }

  const result = await readJson(fetchImpl, url, input.bearer, body);
  const next = applySupervisorResult({
    action: input.action,
    result,
    previous:
      input.action === 'reserve' && input.ticketId
        ? { ...previous, ticketId: input.ticketId }
        : previous,
  });
  return next;
}
