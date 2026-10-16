export const REDEEM_UNKNOWN =
  'Redeem result is unknown. Do not treat this as a ticket. Reconcile the same idempotency key.';

export type RedeemDecision =
  | { kind: 'issued'; ticketId: string; replayed: boolean }
  | { kind: 'denied'; code: string; message: string }
  | { kind: 'unknown'; idempotencyKey: string; message: string };

type FetchResult = {
  status: number;
  json: unknown;
  networkError: boolean;
};

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

export function decideRedeemBody(
  status: number,
  json: unknown,
  idempotencyKey: string,
  networkError = false,
): RedeemDecision {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', idempotencyKey, message: REDEEM_UNKNOWN };
  }
  const body = record(json);
  if (
    (status === 200 || status === 201) &&
    body &&
    typeof body.ticketId === 'string' &&
    body.state === 'ACTIVE'
  ) {
    return {
      kind: 'issued',
      ticketId: body.ticketId,
      replayed: body.replayed === true,
    };
  }
  const nested = body && record(body.response);
  if (body?.status === 'COMPLETED' && nested?.state === 'ACTIVE' && typeof nested.ticketId === 'string') {
    return {
      kind: 'issued',
      ticketId: nested.ticketId,
      replayed: nested.replayed === true,
    };
  }
  if (body?.status === 'COMPLETED' && nested && typeof nested.code === 'string') {
    return {
      kind: 'denied',
      code: nested.code,
      message: typeof nested.message === 'string' ? nested.message : 'Redeem was rejected.',
    };
  }
  if (body?.status === 'IN_PROGRESS' || body?.status === 'FAILED') {
    return { kind: 'unknown', idempotencyKey, message: REDEEM_UNKNOWN };
  }
  if (typeof body?.code === 'string') {
    return {
      kind: 'denied',
      code: body.code,
      message: typeof body.message === 'string' ? body.message : 'Redeem was rejected.',
    };
  }
  return { kind: 'unknown', idempotencyKey, message: REDEEM_UNKNOWN };
}

async function readJson(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<FetchResult> {
  try {
    const response = await fetchImpl(url, init);
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

export async function redeemCode(input: {
  apiBase: string;
  bearer: string;
  tenantId: string;
  eventId: string;
  code: string;
  idempotencyKey: string;
  fetchImpl?: typeof fetch;
}): Promise<RedeemDecision> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const base = input.apiBase.replace(/\/$/, '');
  const posted = await readJson(
    fetchImpl,
    `${base}/v1/tenants/${input.tenantId}/events/${input.eventId}/redemptions`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.bearer}`,
        'Content-Type': 'application/json',
        'idempotency-key': input.idempotencyKey,
      },
      body: JSON.stringify({ code: input.code }),
    },
  );
  const decision = decideRedeemBody(
    posted.status,
    posted.json,
    input.idempotencyKey,
    posted.networkError,
  );
  if (decision.kind !== 'unknown') return decision;
  return reconcileRedeem({ ...input, fetchImpl });
}

export async function reconcileRedeem(input: {
  apiBase: string;
  bearer: string;
  tenantId: string;
  eventId: string;
  idempotencyKey: string;
  fetchImpl?: typeof fetch;
}): Promise<RedeemDecision> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const base = input.apiBase.replace(/\/$/, '');
  const url = new URL(`${base}/v1/operations/${input.idempotencyKey}`);
  url.searchParams.set('tenantId', input.tenantId);
  url.searchParams.set('eventId', input.eventId);
  url.searchParams.set('command', 'redeem');
  const result = await readJson(fetchImpl, url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${input.bearer}`,
    },
  });
  return decideRedeemBody(
    result.status,
    result.json,
    input.idempotencyKey,
    result.networkError,
  );
}
