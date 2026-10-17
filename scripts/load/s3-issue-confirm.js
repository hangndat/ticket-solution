/**
 * k6 S3 — concurrent sustained issue + confirm (TD §14.1).
 * Env: BASE_URL, TENANT_ID, ISSUE_JOBS_FILE (JSON array), CONFIRM_JOBS_FILE,
 *      ISSUE_RATE, CONFIRM_RATE, SUSTAIN_SEC
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Rate, Trend } from 'k6/metrics';
import exec from 'k6/execution';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.4/index.js';

const issueOk = new Counter('s3_issue_ok');
const issueFail = new Counter('s3_issue_fail');
const issueTrend = new Trend('s3_issue_ms');
const confirmOk = new Counter('s3_confirm_ok');
const confirmFail = new Counter('s3_confirm_fail');
const confirmTrend = new Trend('s3_confirm_ms');
const issueErr = new Rate('s3_issue_errors');
const confirmErr = new Rate('s3_confirm_errors');

const BASE = __ENV.BASE_URL;
const TENANT = __ENV.TENANT_ID;
const ISSUE_RATE = Number(__ENV.ISSUE_RATE || 50);
const CONFIRM_RATE = Number(__ENV.CONFIRM_RATE || 20);
const SUSTAIN_SEC = __ENV.SUSTAIN_SEC || '60s';
const MAX_ERR = __ENV.S3_MAX_ERROR_RATE || '0.05';

const issueJobs = new SharedArray('issueJobs', () =>
  JSON.parse(open(__ENV.ISSUE_JOBS_FILE)),
);
const confirmJobs = new SharedArray('confirmJobs', () =>
  JSON.parse(open(__ENV.CONFIRM_JOBS_FILE)),
);

export const options = {
  scenarios: {
    issue: {
      executor: 'constant-arrival-rate',
      rate: ISSUE_RATE,
      timeUnit: '1s',
      duration: SUSTAIN_SEC,
      preAllocatedVUs: Math.min(200, Math.max(40, ISSUE_RATE * 2)),
      maxVUs: Math.min(400, Math.max(80, ISSUE_RATE * 4)),
      exec: 'issueVu',
      startTime: '0s',
    },
    confirm: {
      executor: 'constant-arrival-rate',
      rate: CONFIRM_RATE,
      timeUnit: '1s',
      duration: SUSTAIN_SEC,
      preAllocatedVUs: Math.min(100, Math.max(20, CONFIRM_RATE * 2)),
      maxVUs: Math.min(200, Math.max(40, CONFIRM_RATE * 4)),
      exec: 'confirmVu',
      startTime: '0s',
    },
  },
  thresholds: {
    s3_issue_errors: [`rate<${MAX_ERR}`],
    s3_confirm_errors: [`rate<${MAX_ERR}`],
    http_req_failed: [`rate<${MAX_ERR}`],
    s3_issue_ms: ['p(95)<1000'],
    s3_confirm_ms: ['p(95)<1000'],
  },
};

export function issueVu() {
  const i = exec.scenario.iterationInTest % issueJobs.length;
  const job = issueJobs[i];
  const t0 = Date.now();
  const res = http.post(
    `${BASE}/v1/tenants/${TENANT}/events/${job.eventId}/redemptions`,
    JSON.stringify({ code: job.code }),
    {
      headers: {
        Authorization: `Bearer ${job.token}`,
        'Content-Type': 'application/json',
        'idempotency-key': job.idempotencyKey || `${__VU}-${__ITER}-${i}`,
      },
      tags: { name: 's3_issue' },
    },
  );
  issueTrend.add(Date.now() - t0);
  let bodyOk = false;
  try {
    const body = res.json();
    bodyOk = !!(body && (body.ticketId || body.id || body.operationId));
  } catch {
    bodyOk = false;
  }
  const ok = check(res, {
    'issue 2xx': (r) => r.status === 200 || r.status === 201,
    'issue body has ticket': () => bodyOk,
  });
  if (ok && bodyOk) {
    issueOk.add(1);
    issueErr.add(0);
  } else {
    issueFail.add(1);
    issueErr.add(1);
  }
}

export function confirmVu() {
  const i = exec.scenario.iterationInTest % confirmJobs.length;
  const job = confirmJobs[i];
  const reserveRes = http.post(
    `${BASE}/v1/gate/events/${job.eventId}/reservations`,
    JSON.stringify({
      tenantId: TENANT,
      ticketId: job.ticketId,
      staffSessionId: job.sessionId,
    }),
    {
      headers: {
        Authorization: `Bearer ${job.staffToken}`,
        'Content-Type': 'application/json',
      },
      tags: { name: 's3_reserve' },
    },
  );
  if (reserveRes.status >= 300) {
    confirmFail.add(1);
    confirmErr.add(1);
    sleep(0.01);
    return;
  }
  let body;
  try {
    body = reserveRes.json();
  } catch {
    confirmFail.add(1);
    confirmErr.add(1);
    return;
  }
  const reservationId = body.reservationId || body.id;
  const holdToken = body.token;
  if (!reservationId || !holdToken) {
    confirmFail.add(1);
    confirmErr.add(1);
    return;
  }
  const t0 = Date.now();
  const confirmRes = http.post(
    `${BASE}/v1/gate/events/${job.eventId}/reservations/${reservationId}/confirm`,
    JSON.stringify({
      tenantId: TENANT,
      staffSessionId: job.sessionId,
      token: holdToken,
    }),
    {
      headers: {
        Authorization: `Bearer ${job.staffToken}`,
        'Content-Type': 'application/json',
      },
      tags: { name: 's3_confirm' },
    },
  );
  confirmTrend.add(Date.now() - t0);
  const ok = check(confirmRes, {
    'confirm 2xx': (r) => r.status >= 200 && r.status < 300,
  });
  if (ok) {
    confirmOk.add(1);
    confirmErr.add(0);
  } else {
    confirmFail.add(1);
    confirmErr.add(1);
  }
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: false }),
    [__ENV.S3_SUMMARY_JSON || '/tmp/s3-summary.json']: JSON.stringify(data),
  };
}
