/**
 * k6: N virtual scanners — each VU uses one staff session and reserve→confirm.
 * Env from harness: BASE_URL, STAFF_TOKEN, TENANT_ID, EVENT_ID, SESSION_IDS, TICKET_IDS, VUS
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const confirmOk = new Counter('gate_confirm_ok');
const confirmFail = new Counter('gate_confirm_fail');
const confirmTrend = new Trend('gate_confirm_ms');
const errorRate = new Rate('gate_errors');

const BASE = __ENV.BASE_URL;
const TOKEN = __ENV.STAFF_TOKEN;
const TENANT = __ENV.TENANT_ID;
const EVENT = __ENV.EVENT_ID;
const SESSIONS = (__ENV.SESSION_IDS || '').split(',').filter(Boolean);
const TICKETS = (__ENV.TICKET_IDS || '').split(',').filter(Boolean);
const VUS = Number(__ENV.VUS || SESSIONS.length || 1);

export const options = {
  scenarios: {
    scanners: {
      executor: 'per-vu-iterations',
      vus: VUS,
      iterations: 2,
      maxDuration: '5m',
    },
  },
  thresholds: {
    gate_errors: ['rate<0.5'],
    http_req_failed: ['rate<0.5'],
  },
};

function headers() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  };
}

export default function () {
  const vu = __VU - 1;
  const sessionId = SESSIONS[vu % SESSIONS.length];
  const ticketId = TICKETS[(vu + (__ITER * VUS)) % TICKETS.length];

  const reserveRes = http.post(
    `${BASE}/v1/gate/events/${EVENT}/reservations`,
    JSON.stringify({
      tenantId: TENANT,
      ticketId,
      staffSessionId: sessionId,
    }),
    { headers: headers(), tags: { name: 'gate_reserve' } },
  );

  const reserved = check(reserveRes, {
    'reserve 2xx or conflict': (r) =>
      (r.status >= 200 && r.status < 300) ||
      r.status === 409 ||
      r.status === 422,
  });
  if (!reserved || reserveRes.status >= 300) {
    confirmFail.add(1);
    errorRate.add(1);
    sleep(0.05);
    return;
  }

  let body;
  try {
    body = reserveRes.json();
  } catch {
    confirmFail.add(1);
    errorRate.add(1);
    return;
  }

  const reservationId = body.reservationId || body.id;
  const holdToken = body.token;
  if (!reservationId || !holdToken) {
    confirmFail.add(1);
    errorRate.add(1);
    return;
  }

  const t0 = Date.now();
  const confirmRes = http.post(
    `${BASE}/v1/gate/events/${EVENT}/reservations/${reservationId}/confirm`,
    JSON.stringify({
      tenantId: TENANT,
      staffSessionId: sessionId,
      token: holdToken,
    }),
    { headers: headers(), tags: { name: 'gate_confirm' } },
  );
  confirmTrend.add(Date.now() - t0);

  const ok = check(confirmRes, {
    'confirm 2xx or already': (r) =>
      (r.status >= 200 && r.status < 300) || r.status === 409,
  });
  if (ok && confirmRes.status < 300) {
    confirmOk.add(1);
    errorRate.add(0);
  } else if (ok) {
    confirmOk.add(1);
    errorRate.add(0);
  } else {
    confirmFail.add(1);
    errorRate.add(1);
  }
  sleep(0.02);
}
