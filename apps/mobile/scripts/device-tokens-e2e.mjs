#!/usr/bin/env node
/**
 * Task-local device-token HTTP contract check (identity + POST/DELETE).
 *
 * Uses an explicit HTTP fixture APNs token — NOT a real device push token.
 * Never claims delivered / push receipt.
 *
 * Env:
 *   API_BASE_URL   default http://127.0.0.1:13160
 *   ACCESS_TOKEN   required Bearer (Keycloak JWT)
 *   FIXTURE_TOKEN  default "ios-http-fixture-token-not-apns-device"
 *   APS_ENV        sandbox|production (default sandbox)
 */
const API_BASE = (process.env.API_BASE_URL ?? 'http://127.0.0.1:13160').replace(
  /\/+$/,
  '',
);
const ACCESS_TOKEN = process.env.ACCESS_TOKEN?.trim() ?? '';
const FIXTURE_TOKEN =
  process.env.FIXTURE_TOKEN?.trim() ||
  'ios-http-fixture-token-not-apns-device';
const APS_ENV =
  process.env.APS_ENV === 'production' ? 'production' : 'sandbox';

function log(step, detail) {
  console.log(`[device-tokens-e2e] ${step}: ${detail}`);
}

async function main() {
  if (!ACCESS_TOKEN) {
    console.error(
      '[device-tokens-e2e] FAIL: ACCESS_TOKEN required (Keycloak JWT). No claim of delivery.',
    );
    process.exit(2);
  }

  log('config', `API_BASE=${API_BASE} env=${APS_ENV} fixtureTokenLength=${FIXTURE_TOKEN.length}`);

  const post = await fetch(`${API_BASE}/v1/me/device-tokens`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: FIXTURE_TOKEN, environment: APS_ENV }),
  });
  const postText = await post.text();
  log('POST', `status=${post.status} body=${postText.slice(0, 240)}`);
  if (post.status !== 200 && post.status !== 201) {
    console.error('[device-tokens-e2e] FAIL: expected POST 200/201');
    process.exit(1);
  }
  let registration;
  try {
    registration = JSON.parse(postText);
  } catch {
    console.error('[device-tokens-e2e] FAIL: POST body not JSON');
    process.exit(1);
  }
  if (
    typeof registration.registrationId !== 'string' ||
    !registration.registrationId ||
    (registration.environment !== 'sandbox' &&
      registration.environment !== 'production')
  ) {
    console.error('[device-tokens-e2e] FAIL: invalid registration shape');
    process.exit(1);
  }
  log(
    'POST_OK',
    `registrationId=${registration.registrationId} (HTTP fixture token — not delivered)`,
  );

  const del = await fetch(
    `${API_BASE}/v1/me/device-tokens/${encodeURIComponent(registration.registrationId)}`,
    {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
    },
  );
  log('DELETE', `status=${del.status}`);
  if (del.status !== 204) {
    console.error('[device-tokens-e2e] FAIL: expected DELETE 204');
    process.exit(1);
  }
  log('PASS', 'POST+DELETE contract ok; delivered=false always');
}

main().catch((error) => {
  console.error('[device-tokens-e2e] FAIL:', error);
  process.exit(1);
});
