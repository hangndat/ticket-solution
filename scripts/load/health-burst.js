/**
 * k6: public health burst — liveness only, not readiness/DB.
 */
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE_URL;

export const options = {
  scenarios: {
    health: {
      executor: 'constant-arrival-rate',
      rate: 200,
      timeUnit: '1s',
      duration: '15s',
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<200'],
  },
};

export default function () {
  const res = http.get(`${BASE}/v1/health`, { tags: { name: 'health' } });
  check(res, { 'health 200': (r) => r.status === 200 });
}
