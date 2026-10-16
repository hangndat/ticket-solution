import type { FetchJsonResult } from '../redeem/fetch-json';

export type GateDecision =
  | {
      kind: 'admit';
      ticketId: string;
      checkinId: string;
      message: string;
    }
  | { kind: 'deny'; code: string; message: string }
  | { kind: 'unknown'; message: string };

const UNKNOWN_MESSAGE =
  'Kết quả check-in chưa biết. Không cho khách qua. Giữ khách lại và thử đối soát lại; không đoán là đã vào.';

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

/**
 * Admit only when Nest returned a durable confirm (200 + check-in id)
 * or a known current check-in (409 ALREADY_CHECKED_IN).
 * Timeouts, network loss, and 5xx stay unknown — never admit.
 */
export function decideGateConfirm(result: FetchJsonResult): GateDecision {
  if (
    result.timedOut ||
    result.networkError ||
    result.status === 0 ||
    result.status >= 500
  ) {
    return { kind: 'unknown', message: UNKNOWN_MESSAGE };
  }

  const body = record(result.json);
  if (
    result.status === 200 &&
    body &&
    body.state === 'USED' &&
    typeof body.ticketId === 'string' &&
    typeof body.checkinId === 'string'
  ) {
    return {
      kind: 'admit',
      ticketId: body.ticketId,
      checkinId: body.checkinId,
      message: 'Đã xác nhận. Cho khách qua.',
    };
  }

  if (result.status === 409 && body?.code === 'ALREADY_CHECKED_IN') {
    return {
      kind: 'admit',
      ticketId: text(body.ticketId, ''),
      checkinId: text(body.checkinId, ''),
      message:
        'Vé đã có check-in hiện hành. Kết quả đã biết — cho qua, không tạo lượt mới.',
    };
  }

  if (body && typeof body.code === 'string') {
    return {
      kind: 'deny',
      code: body.code,
      message: text(body.message, 'Không cho qua.'),
    };
  }

  return { kind: 'unknown', message: UNKNOWN_MESSAGE };
}

export type KnownCheckin = {
  ticketId: string;
  checkinId: string;
  message: string;
};

export function lookupKnownCheckin(
  notes: readonly KnownCheckin[],
  ticketId: string,
): GateDecision {
  const found = notes.find((note) => note.ticketId === ticketId && note.checkinId);
  if (!found) {
    return {
      kind: 'unknown',
      message:
        'Chưa có check-in đã biết cho vé này trên cổng. Không cho khách qua.',
    };
  }
  return {
    kind: 'admit',
    ticketId: found.ticketId,
    checkinId: found.checkinId,
    message: found.message,
  };
}
