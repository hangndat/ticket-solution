import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { chromium } from 'playwright';
import { web05ConfigV2Payload } from '../harness/web05-published-config.mjs';
import { loadWeb05ExpectedHashes } from '../harness/web05-hashes.mjs';

const CASE_IDS = [
  'SEC-01',
  'SEC-02',
  'SEC-03',
  'SEC-04',
  'SEC-05',
  'SEC-06',
  'AUTH-03',
  'AUTH-06',
  'GATE-01',
  'GATE-03',
  'DB-01',
  'DB-02',
  'DB-03',
  'DB-04',
  'DB-07',
  'DB-09',
  'DB-10',
  'DB-11',
  'DB-12',
  'DB-14',
  'JOB-04',
  'WEB-04',
  'WEB-05',
];
const EVIL_HOST = 'evil.example';
const EVIL_ORIGIN = 'https://evil.example';
const OAUTH_COOKIE = /oidc|oauth|pkce|nonce|state/i;
const PORTAL_CSRF_COOKIE = 'portal_csrf';
const PORTAL_CSRF_HEADER = 'x-portal-csrf';
const WEB_CSRF_COOKIE = 'vemoki_csrf';
const WEB_CSRF_HEADER = 'x-csrf-token';
const chosen = process.env.E2E_HTTP_CASE;
if (chosen && !CASE_IDS.includes(chosen))
  throw new Error(`Unknown HTTP case: ${chosen}`);

function required(value, label) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`BLOCKED: missing ${label}`);
  }
  return value;
}

function context(caseId) {
  const path = required(process.env.E2E_MANIFEST, 'E2E_MANIFEST');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(manifest.schemaVersion, 1, 'BLOCKED: manifest schemaVersion');
  const runId = required(manifest.runId, 'runId');
  const fixture = required(manifest.cases?.[caseId], `cases.${caseId}`);
  const api = required(manifest.origins?.api, 'origins.api');
  const auth = required(manifest.origins?.auth, 'origins.auth');
  const web = required(manifest.origins?.web, 'origins.web');
  const portal = required(manifest.origins?.portal, 'origins.portal');
  const marketing = required(manifest.origins?.marketing, 'origins.marketing');
  assert.equal(
    new URL(api).protocol,
    'https:',
    'BLOCKED: API origin must use HTTPS',
  );
  assert.equal(
    new URL(auth).protocol,
    'https:',
    'BLOCKED: Auth origin must use HTTPS',
  );
  assert.equal(
    new URL(web).protocol,
    'https:',
    'BLOCKED: Web origin must use HTTPS',
  );
  assert.equal(
    new URL(portal).protocol,
    'https:',
    'BLOCKED: Portal origin must use HTTPS',
  );
  assert.equal(
    new URL(marketing).protocol,
    'https:',
    'BLOCKED: Marketing origin must use HTTPS',
  );
  return {
    fixture,
    api,
    auth,
    web,
    portal,
    marketing,
    runtime: manifest.runtime ?? {},
    tokenUrl: new URL(
      `/realms/e2e-${runId}/protocol/openid-connect/token`,
      auth,
    ),
    clientId: required(manifest.runtime?.httpClientId, 'runtime.httpClientId'),
    clientSecret: required(
      manifest.runtime?.httpClientSecret,
      'runtime.httpClientSecret',
    ),
    platformClientId: manifest.runtime?.httpPlatformClientId,
    platformClientSecret: manifest.runtime?.httpPlatformClientSecret,
    secondaryActor: manifest.secondaryActor,
  };
}

function setCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie();
  }
  const single = response.headers.get('set-cookie');
  return single ? [single] : [];
}

function parseSetCookie(header) {
  const segments = header.split(';').map((part) => part.trim());
  const eq = segments[0].indexOf('=');
  assert.ok(eq > 0, 'malformed Set-Cookie');
  const name = segments[0].slice(0, eq);
  const attrs = {};
  for (let i = 1; i < segments.length; i += 1) {
    const part = segments[i];
    const split = part.indexOf('=');
    if (split === -1) attrs[part.toLowerCase()] = true;
    else attrs[part.slice(0, split).toLowerCase()] = part.slice(split + 1);
  }
  return { name, attrs };
}

function assertHostOnlyOAuthCookies(headers, label) {
  const oauth = [];
  for (const header of headers) {
    const parsed = parseSetCookie(header);
    if (!OAUTH_COOKIE.test(parsed.name)) continue;
    oauth.push(parsed);
    assert.ok(
      parsed.attrs.domain === undefined,
      `${label}: ${parsed.name} must not set Domain (host-only)`,
    );
    assert.equal(
      parsed.attrs.httponly,
      true,
      `${label}: ${parsed.name} must be HttpOnly`,
    );
    assert.equal(
      parsed.attrs.secure,
      true,
      `${label}: ${parsed.name} must be Secure`,
    );
    assert.equal(
      String(parsed.attrs.samesite ?? '').toLowerCase(),
      'lax',
      `${label}: ${parsed.name} must be SameSite=Lax`,
    );
  }
  assert.ok(oauth.length > 0, `${label}: expected OAuth Set-Cookie headers`);
}

async function oauthLoginSetCookies(origin, path) {
  const response = await fetch(new URL(path, origin), {
    method: 'GET',
    redirect: 'manual',
  });
  assertRedirectStatus({
    status: response.status,
    location: response.headers.get('location'),
  });
  return setCookieHeaders(response);
}

function totpCode(secret, epochMs = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of normalized) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) throw new Error('BLOCKED: invalid TOTP fixture secret');
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(epochMs / 30_000)));
  const digest = createHmac('sha1', Buffer.from(bytes))
    .update(counter)
    .digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(binary).padStart(6, '0');
}

async function bearerWithClient(ctx, actor, clientId, clientSecret) {
  const account = required(
    ctx.fixture.accounts?.[actor],
    `cases account ${actor}`,
  );
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: required(clientId, 'clientId'),
    client_secret: required(clientSecret, 'clientSecret'),
    username: required(account.username, `${actor}.username`),
    password: required(account.password, `${actor}.password`),
    scope: 'openid profile email',
  });
  if (account.totpSecret) body.set('totp', totpCode(account.totpSecret));
  const response = await fetch(ctx.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  assert.equal(
    response.status,
    200,
    `BLOCKED: Keycloak password grant for ${actor}`,
  );
  const payload = await response.json();
  return required(payload.access_token, `access token for ${actor}`);
}

async function bffJson(url, init = {}) {
  const response = await fetch(url, init);
  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  return { status: response.status, body };
}

function cookieHeader(cookies) {
  return cookies.map(({ name, value }) => `${name}=${value}`).join('; ');
}

async function oidcBrowserSession(
  browser,
  ctx,
  origin,
  otherOrigin,
  loginPath,
  probePath,
  actor,
) {
  const account = required(
    ctx.fixture.accounts?.[actor],
    `SEC-02 ${actor} account`,
  );
  const browserContext = await browser.newContext();
  try {
    const page = await browserContext.newPage();
    await page.goto(new URL(loginPath, origin).toString());
    await page.locator('#username').fill(account.username);
    await page.locator('#password').fill(account.password);
    await page.locator('#kc-login').click();
    await page.waitForURL((url) => url.origin === new URL(origin).origin, {
      timeout: 30_000,
    });
    const probe = await browserContext.request.get(
      new URL(probePath, origin).toString(),
    );
    assert.equal(
      probe.status(),
      200,
      `SEC-02 ${actor}: authenticated BFF probe`,
    );
    const cookies = await browserContext.cookies(origin);
    assert.ok(
      cookies.length > 0,
      `SEC-02 ${actor}: OIDC did not issue cookies`,
    );
    assert.ok(
      !(await browserContext.cookies(otherOrigin)).some(
        ({ name }) => name === 'oidc_access_token',
      ),
      `SEC-02 ${actor}: session cookie crossed host boundary`,
    );
    const otherHostProbe = await browserContext.request.get(
      new URL('/api/bff/me/tenants', otherOrigin).toString(),
    );
    assert.equal(
      otherHostProbe.status(),
      401,
      `SEC-02 ${actor}: other host must stay anonymous`,
    );
    return cookies;
  } finally {
    await browserContext.close();
  }
}

async function bearer(ctx, actor) {
  const account = required(
    ctx.fixture.accounts?.[actor],
    `cases account ${actor}`,
  );
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: ctx.clientId,
    client_secret: ctx.clientSecret,
    username: required(account.username, `${actor}.username`),
    password: required(account.password, `${actor}.password`),
    scope: 'openid profile email',
  });
  const response = await fetch(ctx.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  assert.equal(
    response.status,
    200,
    `BLOCKED: Keycloak password grant for ${actor}`,
  );
  const payload = await response.json();
  return required(payload.access_token, `access token for ${actor}`);
}

async function secondaryBearer(ctx) {
  const issuer = required(
    ctx.runtime.secondaryIssuer,
    'runtime.secondaryIssuer',
  );
  const actor = required(ctx.secondaryActor, 'secondaryActor');
  const response = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: required(
        ctx.runtime.secondaryHttpClientId,
        'secondaryHttpClientId',
      ),
      client_secret: required(
        ctx.runtime.secondaryHttpClientSecret,
        'secondaryHttpClientSecret',
      ),
      username: required(actor.username, 'secondaryActor.username'),
      password: required(actor.password, 'secondaryActor.password'),
      scope: 'openid profile email',
    }),
  });
  assert.equal(response.status, 200, 'BLOCKED: secondary Keycloak grant');
  const token = required(
    (await response.json()).access_token,
    'secondary access token',
  );
  const requireBackend = createRequire(
    new URL('../../../packages/backend/package.json', import.meta.url),
  );
  const jose = requireBackend('jose');
  const { payload } = await jose.jwtVerify(
    token,
    jose.createRemoteJWKSet(
      new URL(required(ctx.runtime.secondaryJwksUrl, 'secondaryJwksUrl')),
    ),
    { issuer, audience: 'ticket-api', algorithms: ['RS256', 'ES256'] },
  );
  assert.equal(payload.sub, required(actor.subject, 'secondaryActor.subject'));
  assert.notEqual(issuer, ctx.tokenUrl.href.split('/protocol/')[0]);
  return token;
}

async function db02MutationSnapshot(f, ctx) {
  const requireBackend = createRequire(
    new URL('../../../packages/backend/package.json', import.meta.url),
  );
  const { Client } = requireBackend('pg');
  const client = new Client({
    connectionString: required(
      f.data?.controlDatabaseUrl,
      'DB-02 controlDatabaseUrl',
    ),
  });
  await client.connect();
  try {
    const identity = await client.query(
      'SELECT count(*)::int AS n FROM users WHERE issuer = $1 AND subject = $2',
      [ctx.runtime.secondaryIssuer, ctx.secondaryActor.subject],
    );
    const sameEmail = await client.query(
      'SELECT count(*)::int AS n FROM users WHERE email = $1',
      [ctx.secondaryActor.username],
    );
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE ticket_runtime');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      f.tenantId,
    ]);
    const counts = await client.query(
      `SELECT
         (SELECT count(*)::int FROM staff_sessions WHERE tenant_id = $1 AND event_id = $2) AS sessions,
         (SELECT count(*)::int FROM gates WHERE tenant_id = $1 AND event_id = $2) AS gates,
         (SELECT count(*)::int FROM tickets WHERE tenant_id = $1 AND event_id = $2) AS tickets`,
      [f.tenantId, f.eventId],
    );
    await client.query('COMMIT');
    return {
      identity: identity.rows[0].n,
      sameEmailUsers: sameEmail.rows[0].n,
      ...counts.rows[0],
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

const FORGED_FORWARDED = {
  forwarded: 'for=127.0.0.1;host=evil.example;proto=https',
  'x-forwarded-host': EVIL_HOST,
  'x-forwarded-proto': 'https',
};

async function navigationFetch(origin, path, options = {}) {
  const response = await fetch(new URL(path, origin), {
    method: options.method ?? 'GET',
    redirect: 'manual',
    headers: { ...(options.headers ?? {}) },
  });
  return {
    status: response.status,
    location: response.headers.get('location'),
    cacheControl: response.headers.get('cache-control'),
    setCookie: response.headers.get('set-cookie'),
  };
}

/** Bypass E2E TLS proxy so client x-forwarded-* reaches Next.js verbatim. */
function directUpstreamFetch(port, hostHeader, path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: options.method ?? 'GET',
        headers: {
          host: hostHeader,
          ...(options.headers ?? {}),
        },
      },
      (res) => {
        resolve({
          status: res.statusCode ?? 0,
          location: res.headers.location ?? null,
          cacheControl: res.headers['cache-control'] ?? null,
          setCookie: res.headers['set-cookie'] ?? null,
        });
        res.resume();
      },
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function assertRedirectStatus(result) {
  assert.ok(
    [302, 307, 308].includes(result.status),
    `expected redirect, got HTTP ${result.status}`,
  );
  assert.ok(result.location, 'expected Location header');
}

function assertLocationOrigin(location, allowedOrigin, label) {
  const resolved = new URL(location, allowedOrigin);
  const allowed = new URL(allowedOrigin);
  assert.equal(
    resolved.origin,
    allowed.origin,
    `${label}: Location must stay on configured origin, got ${location}`,
  );
}

function assertNoOpenRedirectVector(location) {
  assert.ok(!location.includes(EVIL_HOST), `open redirect leaked ${EVIL_HOST}`);
  assert.ok(!location.includes('evil.test'), 'open redirect leaked evil.test');
  assert.ok(
    !/https?:\/\/[^/]*evil/i.test(location),
    `external redirect: ${location}`,
  );
  assert.ok(
    !location.includes('return=https'),
    'unsafe return query in Location',
  );
  assert.ok(!location.includes('next=https'), 'unsafe next query in Location');
}

function assertUncacheableHostProbe(result, label) {
  assert.ok(
    !/(^|[,\s])(public|s-maxage=\d+|max-age=[1-9]\d*)(\s|,|$)/i.test(
      result.cacheControl ?? '',
    ),
    `${label}: forged host response must not be shared-cacheable`,
  );
}

async function request(ctx, method, path, token, body, headers = {}) {
  const response = await fetch(new URL(`/v1${path}`, ctx.api), {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  return { status: response.status, body: payload, headers: response.headers };
}

function assertRateLimited(
  result,
  { code, retryable, retryAfter = false, noRetryAfter = false },
  label,
) {
  assert.equal(
    result.status,
    429,
    `${label}: expected 429, got ${result.status} (${result.body.code ?? 'none'})`,
  );
  assert.equal(result.body.code, code, `${label}: error code`);
  assert.equal(result.body.retryable, retryable, `${label}: retryable`);
  const retryHeader = result.headers.get('retry-after');
  if (retryAfter) {
    assert.ok(retryHeader, `${label}: Retry-After required`);
    assert.match(retryHeader, /^[1-9][0-9]*$/, `${label}: Retry-After seconds`);
  }
  if (noRetryAfter) {
    assert.equal(
      retryHeader,
      null,
      `${label}: must not require Retry-After on this branch`,
    );
  }
}

function expectStatus(result, status, code) {
  assert.equal(
    result.status,
    status,
    `HTTP ${result.status}; code=${result.body.code ?? 'none'}`,
  );
  if (code) assert.equal(result.body.code, code);
}

function deny(result) {
  assert.ok(
    [403, 404].includes(result.status),
    `expected 403/404, got ${result.status}`,
  );
  assert.equal(typeof result.body.code, 'string');
}

/** 422 only when API returns a stable code that explicitly denies owner mutation. */
const PATCH_OWNER_MUTATION_DENIED_CODES = new Set([
  // Reserved for explicit owner-immutable contract codes when generic PATCH exists.
]);

function patchOwnerTransferRefused(result, label) {
  const { status, body } = result;
  const code = body.code ?? 'none';
  if (status === 404 || status === 405) {
    return;
  }
  if (status === 403) {
    assert.equal(
      typeof body.code,
      'string',
      `${label}: permission denial must include structured code`,
    );
    return;
  }
  if (status === 422) {
    assert.ok(
      typeof body.code === 'string' &&
        PATCH_OWNER_MUTATION_DENIED_CODES.has(body.code),
      `${label}: generic PATCH must not pass on unrelated validation (422/${code}); ` +
        `only owner-mutation denial codes ${[...PATCH_OWNER_MUTATION_DENIED_CODES].join(', ') || '(none yet)'}`,
    );
    return;
  }
  assert.fail(
    `${label}: owner transfer via generic PATCH must be refused with 403/404/405 or explicit owner-denial 422, got ${status} (${code})`,
  );
}

function assertNoForbiddenStrings(payload, forbidden, label) {
  const blob = JSON.stringify(payload);
  for (const value of forbidden) {
    assert.equal(blob.includes(value), false, `${label}: leaked ${value}`);
  }
}

function assertNoForbiddenKeys(obj, keys, label) {
  for (const key of keys) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(obj, key),
      false,
      `${label}: must not expose ${key}`,
    );
  }
}

function assertNotPublicCache(headers, label) {
  const cacheControl = headers.get('cache-control');
  if (cacheControl) {
    assert.ok(
      !/(^|[,\s])public(\s|,|$)/i.test(cacheControl),
      `${label}: Cache-Control must not be public, got ${cacheControl}`,
    );
  }
  assert.equal(
    headers.get('set-cookie'),
    null,
    `${label}: bearer API response must not set cookies`,
  );
}

function assertNoStoreCache(headers, label) {
  const cacheControl = headers.get('cache-control');
  assert.ok(
    cacheControl && /(^|[,\s])no-store(\s|,|$)/i.test(cacheControl),
    `${label}: Cache-Control must be private, no-store, got ${cacheControl}`,
  );
  assert.match(
    cacheControl,
    /(^|[,\s])private(\s|,|$)/i,
    `${label}: Cache-Control must be private, got ${cacheControl}`,
  );
  assertNotPublicCache(headers, label);
}

const IMPORT_MAX_ROWS = 10_000;
const XSS_INERT_PROBE = 'SEC05-INERT-XSS-MARKER';

async function multipartImportUpload(ctx, token, tenantId, eventId, file) {
  const form = new FormData();
  form.set('kind', file.kind);
  form.append(
    'file',
    new Blob([file.body], { type: file.contentType ?? 'text/csv' }),
    file.filename,
  );
  const response = await fetch(
    new URL(`/v1/tenants/${tenantId}/events/${eventId}/imports/files`, ctx.api),
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
    },
  );
  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  return { status: response.status, body };
}

async function waitExportReady(ctx, f, token, exportId, timeoutMs = 120_000) {
  const path = `/tenants/${f.tenantId}/events/${f.eventId}/exports/${exportId}`;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const status = await request(ctx, 'GET', path, token);
    if (status.status === 200 && status.body.status === 'READY') return status;
    if (status.body.status === 'FAILED') {
      throw new Error(
        `export failed: ${status.body.error ?? status.body.code ?? 'unknown'}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('BLOCKED: export job did not reach READY');
}

async function downloadExportCsv(ctx, f, token, exportId) {
  const response = await fetch(
    new URL(
      `/v1/tenants/${f.tenantId}/events/${f.eventId}/exports/${exportId}/download`,
      ctx.api,
    ),
    { headers: { authorization: `Bearer ${token}` } },
  );
  assert.equal(response.status, 200, 'export download must succeed');
  return response.text();
}

function assertCsvFormulaGuard(csv, maskedEmail) {
  assert.ok(csv.includes('ownerEmailMasked'), 'export CSV must include header');
  const line = csv.split('\n').find((row) => row.includes(maskedEmail));
  assert.ok(line, 'export must include masked formula-like email');
  const cell = line.split(',').pop()?.trim() ?? '';
  assert.ok(
    cell.startsWith("'") || cell.startsWith('"\''),
    `formula guard must prefix ownerEmailMasked cell, got ${cell}`,
  );
  assert.ok(
    !cell.startsWith('='),
    'CSV cell must not start with raw formula char',
  );
}

function assertSecurityProfileHeaders(headers, label) {
  const csp = headers.get('content-security-policy');
  assert.ok(csp, `${label}: Content-Security-Policy required`);
  assert.match(csp, /default-src 'self'/, `${label}: default-src self`);
  assert.match(csp, /object-src 'none'/, `${label}: object-src none`);
  assert.match(csp, /frame-ancestors 'none'/, `${label}: frame-ancestors none`);
  assert.equal(
    headers.get('x-content-type-options'),
    'nosniff',
    `${label}: nosniff`,
  );
}

async function fetchPublicEventDetail(ctx, tenantSlug, eventSlug) {
  const response = await fetch(
    new URL(`/v1/public/tenants/${tenantSlug}/events/${eventSlug}`, ctx.api),
  );
  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  return { status: response.status, body };
}

function reportPath(f, tenantId = f.tenantId, eventId = f.eventId) {
  return `/tenants/${tenantId}/events/${eventId}/report`;
}

function redemptionPath(f) {
  return `/tenants/${f.tenantId}/events/${f.eventId}/redemptions`;
}

function redemptionBody(f, caseId) {
  return {
    code: required(f.code, `${caseId} code`),
    formVersion: required(f.data?.formVersion, `${caseId} formVersion`),
    termsVersion: required(f.data?.termsVersion, `${caseId} termsVersion`),
    answers: required(f.data?.answers, `${caseId} answers`),
    termsAccepted: true,
  };
}

function gatePath(f, suffix) {
  return `/gate/events/${f.eventId}/${suffix}`;
}

async function auth06Revoke(f, statement, values) {
  const requireBackend = createRequire(
    new URL('../../../packages/backend/package.json', import.meta.url),
  );
  const { Client } = requireBackend('pg');
  const client = new Client({
    connectionString: required(
      f.data?.controlDatabaseUrl,
      'controlDatabaseUrl',
    ),
  });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE ticket_runtime');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      f.tenantId,
    ]);
    const changed = await client.query(statement, values);
    assert.equal(
      changed.rowCount,
      1,
      'scoped revocation must change one row under tenant RLS',
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

async function web04Query(f, tenantId, statement, values) {
  const requireBackend = createRequire(
    new URL('../../../packages/backend/package.json', import.meta.url),
  );
  const { Client } = requireBackend('pg');
  const client = new Client({
    connectionString: required(
      f.data?.controlDatabaseUrl,
      'controlDatabaseUrl',
    ),
  });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE ticket_runtime');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      tenantId,
    ]);
    const result = await client.query(statement, values);
    await client.query('COMMIT');
    return result.rows;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

async function db03Query(f, statement, values) {
  const requireBackend = createRequire(
    new URL('../../../packages/backend/package.json', import.meta.url),
  );
  const { Client } = requireBackend('pg');
  const client = new Client({
    connectionString: required(
      f.data?.controlDatabaseUrl,
      'DB-03 controlDatabaseUrl',
    ),
  });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE ticket_runtime');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      f.tenantId,
    ]);
    const result = await client.query(statement, values);
    await client.query('COMMIT');
    return result.rows;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

async function auth03Snapshot(f) {
  const [state] = await web04Query(
    f,
    f.tenantId,
    `SELECT
       (SELECT jsonb_agg(jsonb_build_object('id', id, 'status', status,
         'activeRequestId', active_request_id) ORDER BY id)
        FROM redemption_codes WHERE tenant_id = $1 AND event_id = $2) AS codes,
       (SELECT jsonb_agg(jsonb_build_object('id', id, 'allocated', allocated) ORDER BY id)
        FROM quota_buckets WHERE tenant_id = $1 AND event_id = $2) AS quota,
       (SELECT count(*)::int FROM redemption_requests WHERE tenant_id = $1 AND event_id = $2) AS requests,
       (SELECT count(*)::int FROM tickets WHERE tenant_id = $1 AND event_id = $2) AS tickets,
       (SELECT count(*)::int FROM operations WHERE tenant_id = $1 AND event_id = $2) AS operations,
       (SELECT count(*)::int FROM audit_logs WHERE tenant_id = $1 AND event_id = $2) AS audit,
       (SELECT count(*)::int FROM outbox WHERE tenant_id = $1 AND event_id = $2) AS outbox`,
    [f.tenantId, f.eventId],
  );
  const [rate] = await web04Query(
    f,
    f.accounts.unverified.userId,
    `SELECT coalesce(jsonb_agg(jsonb_build_object('bucket', bucket_key,
      'window', window_started_at, 'count', count) ORDER BY bucket_key, window_started_at), '[]'::jsonb) AS counters
     FROM notification_rate_counters
     WHERE tenant_id = $1 AND bucket_key IN ('redemption.resolve', 'api.redeem')`,
    [f.accounts.unverified.userId],
  );
  return { ...state, rateCounters: rate.counters };
}

async function db04Snapshot(f) {
  const tables = {
    codes:
      'SELECT id, status, active_request_id FROM redemption_codes WHERE tenant_id = $1::uuid AND event_id = $2::uuid ORDER BY id',
    quotas:
      'SELECT id, capacity, allocated FROM quota_buckets WHERE tenant_id = $1::uuid AND event_id = $2::uuid ORDER BY id',
    requests:
      'SELECT id, status FROM redemption_requests WHERE tenant_id = $1::uuid AND event_id = $2::uuid ORDER BY id',
    tickets:
      'SELECT id, owner_user_id FROM tickets WHERE tenant_id = $1::uuid AND event_id = $2::uuid ORDER BY id',
    operations:
      'SELECT id, client_key, status, response_json FROM operations WHERE tenant_id = $1::uuid AND event_id = $2::uuid ORDER BY id',
    audits:
      'SELECT id, action FROM audit_logs WHERE tenant_id = $1::uuid AND event_id = $2::uuid ORDER BY id',
    outbox:
      'SELECT id, type FROM outbox WHERE tenant_id = $1::uuid AND event_id = $2::uuid ORDER BY id',
    attendees:
      'SELECT id, user_id, canonical_email FROM event_attendees WHERE tenant_id = $1::uuid AND event_id = $2::uuid ORDER BY id',
    counters:
      'SELECT attendee_id, issued_count, max_tickets FROM attendee_counters WHERE tenant_id = $1::uuid AND event_id = $2::uuid ORDER BY attendee_id',
  };
  const state = {};
  for (const [name, sql] of Object.entries(tables))
    state[name] = await db03Query(f, sql, [f.tenantId, f.eventId]);
  return state;
}

async function db07State(f, requestId) {
  const [requestRow] = await db03Query(
    f,
    `SELECT id, status, expires_at, created_at, decision_reason,
      redemption_code_id FROM redemption_requests
      WHERE tenant_id=$1::uuid AND id=$2::uuid`,
    [f.tenantId, requestId],
  );
  assert.ok(requestRow, 'DB-07 request must exist');
  const [code] = await db03Query(
    f,
    `SELECT status, active_request_id FROM redemption_codes
      WHERE tenant_id=$1::uuid AND id=$2::uuid`,
    [f.tenantId, requestRow.redemption_code_id],
  );
  return {
    request: requestRow,
    code,
    quota: await db03Query(
      f,
      `SELECT scope, capacity, allocated FROM quota_buckets
      WHERE tenant_id=$1::uuid AND event_id=$2::uuid ORDER BY scope`,
      [f.tenantId, f.eventId],
    ),
    tickets: await db03Query(
      f,
      `SELECT id, request_id FROM tickets
      WHERE tenant_id=$1::uuid AND request_id=$2::uuid`,
      [f.tenantId, requestId],
    ),
    audit: await db03Query(
      f,
      `SELECT action FROM audit_logs
      WHERE tenant_id=$1::uuid AND resource_id=$2::uuid`,
      [f.tenantId, requestId],
    ),
    outbox: await db03Query(
      f,
      `SELECT type FROM outbox
      WHERE tenant_id=$1::uuid AND event_id=$2::uuid AND payload->>'requestId'=$3`,
      [f.tenantId, f.eventId, requestId],
    ),
    operations: await db03Query(
      f,
      `SELECT command, status, response_json FROM operations
      WHERE tenant_id=$1::uuid AND event_id=$2::uuid
        AND response_json->>'requestId'=$3`,
      [f.tenantId, f.eventId, requestId],
    ),
  };
}

async function db07DecisionBarrier(ctx, requestId, calls) {
  const f = ctx.fixture;
  const requireBackend = createRequire(
    new URL('../../../packages/backend/package.json', import.meta.url),
  );
  const { Client } = requireBackend('pg');
  const url = required(f.data?.controlDatabaseUrl, 'DB-07 controlDatabaseUrl');
  const locker = new Client({ connectionString: url });
  const observer = new Client({ connectionString: url });
  await locker.connect();
  await observer.connect();
  let requests = [];
  try {
    await locker.query('BEGIN');
    await locker.query('SET LOCAL ROLE ticket_runtime');
    await locker.query("SELECT set_config('app.tenant_id', $1, true)", [
      f.tenantId,
    ]);
    const locked = await locker.query(
      `SELECT c.id, pg_backend_pid() AS pid
      FROM redemption_codes c JOIN redemption_requests r
        ON r.tenant_id=c.tenant_id AND r.redemption_code_id=c.id
      WHERE r.tenant_id=$1::uuid AND r.id=$2::uuid FOR UPDATE OF c`,
      [f.tenantId, requestId],
    );
    assert.equal(locked.rows.length, 1);
    const blockerPid = locked.rows[0].pid;
    requests = calls.map((call) => call());
    const deadline = Date.now() + 1500;
    let waiters = [];
    while (Date.now() < deadline) {
      const { rows } =
        await observer.query(`SELECT pid, pg_blocking_pids(pid) AS blockers
        FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND wait_event_type='Lock'`);
      const waiting = new Map(rows.map((row) => [row.pid, row]));
      const reachesLocker = (pid, seen = new Set()) => {
        if (pid === blockerPid) return true;
        if (seen.has(pid)) return false;
        const row = waiting.get(pid);
        if (!row) return false;
        seen.add(pid);
        return row.blockers.some((blocker) => reachesLocker(blocker, seen));
      };
      waiters = rows.filter((row) => reachesLocker(row.pid));
      if (waiters.length >= calls.length) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.ok(
      waiters.length >= calls.length,
      `DB-07 expected ${calls.length} HTTP contenders blocked on PostgreSQL code row; observed ${waiters.length}`,
    );
  } catch (error) {
    requests.forEach((pending) => pending.catch(() => undefined));
    throw error;
  } finally {
    await locker.query('ROLLBACK');
    await locker.end();
    await observer.end();
  }
  return Promise.all(requests);
}

async function db04ControlledRequests(ctx, path, token, body, codes) {
  const f = ctx.fixture;
  const requireBackend = createRequire(
    new URL('../../../packages/backend/package.json', import.meta.url),
  );
  const { Client } = requireBackend('pg');
  const locker = new Client({
    connectionString: required(
      f.data?.controlDatabaseUrl,
      'DB-04 controlDatabaseUrl',
    ),
  });
  const observer = new Client({
    connectionString: required(
      f.data?.controlDatabaseUrl,
      'DB-04 controlDatabaseUrl',
    ),
  });
  const attendeeId = randomUUID();
  await db03Query(
    f,
    `INSERT INTO event_attendees
    (tenant_id, event_id, id, user_id, canonical_email, created_at, updated_at)
    VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, now(), now())`,
    [
      f.tenantId,
      f.eventId,
      attendeeId,
      f.accounts.attendee.userId,
      f.accounts.attendee.username,
    ],
  );
  await db03Query(
    f,
    `INSERT INTO attendee_counters
    (tenant_id, event_id, attendee_id, issued_count, max_tickets, updated_at)
    VALUES ($1::uuid, $2::uuid, $3::uuid, 0, 1, now())`,
    [f.tenantId, f.eventId, attendeeId],
  );
  await locker.connect();
  await observer.connect();
  let requests = [];
  const observed = [];
  try {
    await locker.query('BEGIN');
    await locker.query('SET LOCAL ROLE ticket_runtime');
    await locker.query("SELECT set_config('app.tenant_id', $1, true)", [
      f.tenantId,
    ]);
    const locked = await locker.query(
      `SELECT pg_backend_pid() AS pid FROM attendee_counters
      WHERE tenant_id = $1::uuid AND attendee_id = $2::uuid FOR UPDATE`,
      [f.tenantId, attendeeId],
    );
    assert.equal(locked.rows.length, 1);
    const blockerPid = locked.rows[0].pid;
    requests = codes.map((code) =>
      request(
        ctx,
        'POST',
        path,
        token,
        { ...body, code },
        { 'idempotency-key': randomUUID() },
      ).then((result) => {
        observed.push({ status: result.status, code: result.body.code });
        return result;
      }),
    );
    const deadline = Date.now() + 3000;
    let blocked = [];
    while (Date.now() < deadline) {
      const { rows } = await observer.query(`SELECT pid, wait_event_type,
        pg_blocking_pids(pid) AS blockers, left(query, 160) AS query
        FROM pg_stat_activity WHERE pid <> pg_backend_pid()
          AND wait_event_type = 'Lock'`);
      const waiters = new Map(
        rows
          .filter((row) => row.query.includes('FROM attendee_counters'))
          .map((row) => [row.pid, row]),
      );
      const reachesLocker = (pid, seen = new Set()) => {
        if (pid === blockerPid) return true;
        if (seen.has(pid)) return false;
        const waiter = waiters.get(pid);
        if (!waiter) return false;
        seen.add(pid);
        return waiter.blockers.some((blocker) => reachesLocker(blocker, seen));
      };
      blocked = [...waiters.values()].filter((row) => reachesLocker(row.pid));
      if (blocked.length === codes.length) break;
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    assert.equal(
      blocked.length,
      codes.length,
      `all HTTP requests must wait on the owner counter before release; outcomes=${JSON.stringify(observed)}`,
    );
  } catch (error) {
    requests.forEach((pending) => pending.catch(() => undefined));
    throw error;
  } finally {
    await locker.query('ROLLBACK');
    await locker.end();
    await observer.end();
  }
  return Promise.all(requests);
}

async function web04AssertRejected(
  ctx,
  { label, tenantId, eventId, code, errorStatus, errorCode, redeemBody },
) {
  const f = ctx.fixture;
  const attendee = await bearer(ctx, 'attendee');
  const path = `/tenants/${tenantId}/events/${eventId}/redemptions`;
  const body = redeemBody ?? {
    code,
    formVersion: required(f.data?.formVersion, `${label} formVersion`),
    termsVersion: required(f.data?.termsVersion, `${label} termsVersion`),
    answers: required(f.data?.answers, `${label} answers`),
    termsAccepted: true,
  };
  const beforeCodeRows = await web04Query(
    f,
    tenantId,
    `SELECT id, status FROM redemption_codes
     WHERE tenant_id = $1::uuid AND event_id = $2::uuid`,
    [tenantId, eventId],
  );
  const beforeTicketCount = await web04Query(
    f,
    tenantId,
    `SELECT count(*)::int AS n FROM tickets WHERE tenant_id = $1::uuid AND event_id = $2::uuid`,
    [tenantId, eventId],
  );
  const beforeRequestCount = await web04Query(
    f,
    tenantId,
    `SELECT count(*)::int AS n FROM redemption_requests
     WHERE tenant_id = $1::uuid AND event_id = $2::uuid`,
    [tenantId, eventId],
  );
  const beforeOutbox = await web04Query(
    f,
    tenantId,
    `SELECT id, type, aggregate_id FROM outbox
     WHERE tenant_id = $1::uuid AND event_id = $2::uuid ORDER BY id`,
    [tenantId, eventId],
  );
  const beforeQuota = await web04Query(
    f,
    tenantId,
    `SELECT capacity, allocated FROM quota_buckets
     WHERE tenant_id = $1::uuid AND event_id = $2::uuid AND scope = 'EVENT'`,
    [tenantId, eventId],
  );
  const result = await request(ctx, 'POST', path, attendee, body, {
    'idempotency-key': randomUUID(),
  });
  expectStatus(result, errorStatus, errorCode);
  assert.equal(result.body.retryable, false, `${label}: must be terminal`);
  const afterTicketCount = await web04Query(
    f,
    tenantId,
    `SELECT count(*)::int AS n FROM tickets WHERE tenant_id = $1::uuid AND event_id = $2::uuid`,
    [tenantId, eventId],
  );
  assert.equal(
    afterTicketCount[0].n,
    beforeTicketCount[0].n,
    `${label}: must not issue a ticket`,
  );
  const afterCodeRows = await web04Query(
    f,
    tenantId,
    `SELECT status FROM redemption_codes
     WHERE tenant_id = $1::uuid AND event_id = $2::uuid`,
    [tenantId, eventId],
  );
  assert.deepEqual(
    afterCodeRows.map((r) => r.status).sort(),
    beforeCodeRows.map((r) => r.status).sort(),
    `${label}: code status must not change`,
  );
  const afterRequestCount = await web04Query(
    f,
    tenantId,
    `SELECT count(*)::int AS n FROM redemption_requests
     WHERE tenant_id = $1::uuid AND event_id = $2::uuid`,
    [tenantId, eventId],
  );
  assert.equal(
    afterRequestCount[0].n,
    beforeRequestCount[0].n,
    `${label}: must not create redemption_requests`,
  );
  const afterOutbox = await web04Query(
    f,
    tenantId,
    `SELECT id, type, aggregate_id FROM outbox
     WHERE tenant_id = $1::uuid AND event_id = $2::uuid ORDER BY id`,
    [tenantId, eventId],
  );
  assert.deepEqual(
    afterOutbox,
    beforeOutbox,
    `${label}: outbox must not change`,
  );
  const afterQuota = await web04Query(
    f,
    tenantId,
    `SELECT capacity, allocated FROM quota_buckets
     WHERE tenant_id = $1::uuid AND event_id = $2::uuid AND scope = 'EVENT'`,
    [tenantId, eventId],
  );
  assert.deepEqual(afterQuota, beforeQuota, `${label}: quota must not change`);
  const opRows = await web04Query(
    f,
    tenantId,
    `SELECT status, response_json FROM operations
     WHERE tenant_id = $1::uuid AND event_id = $2::uuid
       AND actor_user_id = $3::uuid AND command = 'redemption.redeem'`,
    [tenantId, eventId, f.accounts.attendee.userId],
  );
  for (const op of opRows) {
    assert.notEqual(
      op.status,
      'IN_PROGRESS',
      `${label}: must not leave a dangling IN_PROGRESS operation`,
    );
  }
  return result;
}

for (const caseId of CASE_IDS) {
  if (chosen && chosen !== caseId) continue;
  test(`[${caseId}] live HTTP`, async () => {
    const ctx = context(caseId);
    const f = ctx.fixture;
    if (caseId === 'SEC-01') {
      const owner = await bearer(ctx, 'owner');
      const own = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(own, 200);
      assert.equal(own.body.eventId, f.eventId);
      const foreignTenantId = required(
        f.data?.foreignTenantId,
        'SEC-01 foreignTenantId',
      );
      const foreignEventId = required(
        f.data?.foreignEventId,
        'SEC-01 foreignEventId',
      );
      deny(
        await request(
          ctx,
          'GET',
          reportPath(f, foreignTenantId, foreignEventId),
          owner,
        ),
      );
      deny(
        await request(
          ctx,
          'GET',
          reportPath(f, f.tenantId, foreignEventId),
          owner,
        ),
      );
      return;
    }
    if (caseId === 'SEC-02') {
      const f = ctx.fixture;
      const tenantId = required(f.tenantId, 'SEC-02 tenantId');
      const eventId = required(f.eventId, 'SEC-02 eventId');
      const portalOrigin = new URL(ctx.portal).origin;
      const webOrigin = new URL(ctx.web).origin;

      assertHostOnlyOAuthCookies(
        await oauthLoginSetCookies(ctx.web, '/api/auth/login?return=/'),
        'web OIDC login',
      );
      assertHostOnlyOAuthCookies(
        await oauthLoginSetCookies(ctx.portal, '/api/auth/login?return=/'),
        'portal staff OIDC login',
      );
      assertHostOnlyOAuthCookies(
        await oauthLoginSetCookies(ctx.portal, '/api/auth/platform/login'),
        'portal platform OIDC login',
      );

      const ticketTypesUrl = new URL(
        `/api/bff/tenants/${tenantId}/events/${eventId}/ticket-types`,
        ctx.portal,
      );
      const missingOrigin = await bffJson(ticketTypesUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label: 'Synthetic SEC-02 probe' }),
      });
      assert.ok(
        [401, 403].includes(missingOrigin.status),
        `missing Origin expected 401/403, got ${missingOrigin.status}`,
      );
      assert.equal(
        missingOrigin.body.code,
        'CSRF_ORIGIN_REQUIRED',
        'missing Origin must fail closed before authz',
      );

      const wrongOrigin = await bffJson(ticketTypesUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Origin: webOrigin,
        },
        body: JSON.stringify({ label: 'Synthetic SEC-02 probe' }),
      });
      assert.equal(
        wrongOrigin.status,
        403,
        `wrong Origin expected 403, got ${wrongOrigin.status}`,
      );
      assert.equal(wrongOrigin.body.code, 'CSRF_ORIGIN_MISMATCH');

      const webResolveUrl = new URL('/api/bff/redeem/resolve', ctx.web);
      const webMissingOrigin = await bffJson(webResolveUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId, eventId, code: 'INVALID-PROBE' }),
      });
      assert.equal(webMissingOrigin.status, 403);
      assert.equal(webMissingOrigin.body.code, 'CSRF_ORIGIN_REQUIRED');

      const webWrongOrigin = await bffJson(webResolveUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Origin: EVIL_ORIGIN,
        },
        body: JSON.stringify({ tenantId, eventId, code: 'INVALID-PROBE' }),
      });
      assert.equal(webWrongOrigin.status, 403);
      assert.equal(webWrongOrigin.body.code, 'CSRF_ORIGIN_MISMATCH');

      const staffToken = await bearer(ctx, 'owner');
      const platformClientId = required(
        ctx.platformClientId,
        'runtime.httpPlatformClientId',
      );
      const platformClientSecret = required(
        ctx.platformClientSecret,
        'runtime.httpPlatformClientSecret',
      );
      const platformToken = await bearerWithClient(
        ctx,
        'operator',
        platformClientId,
        platformClientSecret,
      );

      const staffOnPlatform = await request(
        ctx,
        'GET',
        '/platform/me',
        staffToken,
      );
      assert.ok(
        [401, 403].includes(staffOnPlatform.status),
        `ticket-api token must not satisfy platform routes (${staffOnPlatform.status})`,
      );

      const platformOnStaff = await fetch(
        new URL(`/v1/me/tickets?tenantId=${tenantId}`, ctx.api),
        {
          headers: {
            authorization: `Bearer ${platformToken}`,
            Origin: portalOrigin,
          },
        },
      );
      const platformOnStaffBody = await platformOnStaff.json();
      assert.equal(
        platformOnStaff.status,
        401,
        'platform audience must not satisfy ticket-api identity',
      );
      assert.equal(
        platformOnStaffBody.code,
        'UNAUTHENTICATED',
        'wrong audience must not authenticate as attendee/staff API caller',
      );

      function tokenPayload(token) {
        const segment = token.split('.')[1];
        return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
      }
      const staffAud = tokenPayload(staffToken).aud;
      const platformAud = tokenPayload(platformToken).aud;
      const staffAudiences = Array.isArray(staffAud) ? staffAud : [staffAud];
      const platformAudiences = Array.isArray(platformAud)
        ? platformAud
        : [platformAud];
      assert.ok(
        staffAudiences.includes('ticket-api'),
        'staff/API grant must include ticket-api audience',
      );
      assert.ok(
        !staffAudiences.includes('ticket-platform-api'),
        'staff/API grant must not include platform audience',
      );
      assert.ok(
        platformAudiences.includes('ticket-platform-api'),
        'platform grant must include ticket-platform-api audience',
      );
      assert.ok(
        !platformAudiences.includes('ticket-api'),
        'platform grant must not include ticket-api audience',
      );

      const platformRouteProbe = await request(
        ctx,
        'GET',
        '/platform/me',
        platformToken,
      );
      assert.ok(
        [401, 403].includes(platformRouteProbe.status),
        'HTTP password grant is not browser MFA; platform route must stay gated',
      );

      const corsNoAuth = await fetch(
        new URL(`/v1/me/tickets?tenantId=${tenantId}`, ctx.api),
        {
          headers: {
            Origin: EVIL_ORIGIN,
            'Access-Control-Request-Method': 'GET',
          },
        },
      );
      assert.equal(
        corsNoAuth.status,
        401,
        'Origin alone must not replace bearer authz on API',
      );

      const corsWithStaff = await fetch(
        new URL(`/v1${reportPath(f)}`, ctx.api),
        {
          headers: {
            authorization: `Bearer ${staffToken}`,
            Origin: EVIL_ORIGIN,
          },
        },
      );
      const corsBody = await corsWithStaff.json();
      assert.equal(corsWithStaff.status, 200);
      assert.equal(corsBody.eventId, f.eventId);
      deny(
        await request(
          ctx,
          'GET',
          reportPath(
            f,
            required(f.data?.foreignTenantId, 'SEC-02 foreignTenantId'),
            required(f.data?.foreignEventId, 'SEC-02 foreignEventId'),
          ),
          staffToken,
        ),
      );

      const portalCsrfOnly = await bffJson(ticketTypesUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Origin: portalOrigin,
          [PORTAL_CSRF_HEADER]: 'not-a-real-token',
          Cookie: `${PORTAL_CSRF_COOKIE}=not-a-real-token`,
        },
        body: JSON.stringify({ label: 'Synthetic SEC-02 probe' }),
      });
      assert.ok(
        [401, 403].includes(portalCsrfOnly.status),
        `portal mutate without valid CSRF/session expected 401/403, got ${portalCsrfOnly.status}`,
      );
      if (portalCsrfOnly.status === 403) {
        assert.equal(portalCsrfOnly.body.code, 'CSRF_TOKEN_MISMATCH');
      }

      const platformTenantsUrl = new URL(
        '/api/bff/platform/tenants',
        ctx.portal,
      );
      const platformBootstrap = await fetch(platformTenantsUrl);
      assert.equal(
        platformBootstrap.status,
        401,
        'platform BFF needs a session',
      );
      const platformCsrf = setCookieHeaders(platformBootstrap)
        .map(parseSetCookie)
        .find(({ name }) => name === PORTAL_CSRF_COOKIE);
      assert.ok(platformCsrf, 'platform BFF must bootstrap CSRF cookie');
      assert.equal(platformCsrf.attrs.domain, undefined);
      assert.equal(platformCsrf.attrs.secure, true);
      assert.equal(String(platformCsrf.attrs.samesite).toLowerCase(), 'lax');
      const platformCsrfToken = required(
        setCookieHeaders(platformBootstrap)
          .find((header) => header.startsWith(`${PORTAL_CSRF_COOKIE}=`))
          ?.split(';', 1)[0]
          .slice(PORTAL_CSRF_COOKIE.length + 1),
        'platform CSRF token',
      );
      const platformPayload = {
        idempotencyKey: randomUUID(),
        slug: `sec02-${randomUUID()}`,
        name: 'Synthetic SEC-02 anonymous probe',
        defaultTimezone: 'UTC',
        ownerEmail: 'owner@example.test',
        limits: {},
        flags: {},
      };
      const platformPost = (headers) =>
        bffJson(platformTenantsUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Cookie: `${PORTAL_CSRF_COOKIE}=${platformCsrfToken}`,
            [PORTAL_CSRF_HEADER]: platformCsrfToken,
            ...headers,
          },
          body: JSON.stringify(platformPayload),
        });
      expectStatus(await platformPost({}), 403, 'CSRF_ORIGIN_REQUIRED');
      expectStatus(
        await platformPost({ Origin: EVIL_ORIGIN }),
        403,
        'CSRF_ORIGIN_MISMATCH',
      );
      expectStatus(await platformPost({ Origin: portalOrigin }), 401);

      const suffix = required(process.env.E2E_HOST_SUFFIX, 'E2E_HOST_SUFFIX');
      const trust = required(process.env.E2E_TLS_SPKI, 'E2E_TLS_SPKI');
      const browser = await chromium.launch({
        headless: true,
        args: [
          `--host-resolver-rules=MAP *.${suffix} 127.0.0.1, MAP ${suffix} 127.0.0.1`,
          `--ignore-certificate-errors-spki-list=${trust}`,
        ],
      });
      try {
        const surfaces = [
          {
            label: 'web attendee',
            origin: ctx.web,
            login: '/api/auth/login?return=/',
            probe: '/api/bff/me/tenants',
            actor: 'attendee',
            csrfName: WEB_CSRF_COOKIE,
            csrfHeader: WEB_CSRF_HEADER,
            mutation: '/api/bff/redeem/resolve',
            payload: { code: '' },
            positiveCode: 'CODE_INVALID',
            anonymousPayload: { code: 'INVALID-PROBE' },
          },
          {
            label: 'portal staff',
            origin: ctx.portal,
            login: '/api/auth/login?return=/',
            probe: '/api/bff/me/tenants',
            actor: 'owner',
            csrfName: PORTAL_CSRF_COOKIE,
            csrfHeader: PORTAL_CSRF_HEADER,
            mutation: `/api/bff/tenants/${tenantId}/events/${eventId}/ticket-types`,
            payload: { label: '' },
            positiveCode: 'LABEL_REQUIRED',
            anonymousPayload: { label: 'Synthetic SEC-02 anonymous probe' },
          },
        ];
        for (const surface of surfaces) {
          surface.cookies = await oidcBrowserSession(
            browser,
            ctx,
            surface.origin,
            surface.origin === ctx.web ? ctx.portal : ctx.web,
            surface.login,
            surface.probe,
            surface.actor,
          );
          const host = new URL(surface.origin).hostname;
          const sessionCookies = surface.cookies.filter(({ name }) =>
            /^(oidc_(access|refresh|id)_|platform_oidc_(access|refresh))/.test(
              name,
            ),
          );
          assert.ok(
            sessionCookies.length > 0,
            `${surface.label}: session cookie required`,
          );
          for (const cookie of sessionCookies) {
            assert.equal(
              cookie.domain,
              host,
              `${surface.label}: host-only session cookie`,
            );
            assert.equal(
              cookie.httpOnly,
              true,
              `${surface.label}: HttpOnly session cookie`,
            );
            assert.equal(
              cookie.secure,
              true,
              `${surface.label}: Secure session cookie`,
            );
            assert.equal(
              cookie.sameSite,
              'Lax',
              `${surface.label}: SameSite session cookie`,
            );
          }
          const csrf = required(
            surface.cookies.find(({ name }) => name === surface.csrfName)
              ?.value,
            `${surface.label} CSRF cookie`,
          );
          const url = new URL(surface.mutation, surface.origin);
          const body = JSON.stringify(surface.payload);
          const base = { method: 'POST', body };
          const send = (headers) =>
            bffJson(url, {
              ...base,
              headers: {
                'content-type': 'application/json',
                Cookie: cookieHeader(surface.cookies),
                ...headers,
              },
            });
          for (const [headers, code] of [
            [{ [surface.csrfHeader]: csrf }, 'CSRF_ORIGIN_REQUIRED'],
            [
              { Origin: EVIL_ORIGIN, [surface.csrfHeader]: csrf },
              'CSRF_ORIGIN_MISMATCH',
            ],
            [
              { Origin: new URL(surface.origin).origin },
              surface.label === 'web attendee'
                ? 'CSRF_TOKEN_INVALID'
                : 'CSRF_TOKEN_MISMATCH',
            ],
            [
              {
                Origin: new URL(surface.origin).origin,
                [surface.csrfHeader]: 'wrong-token',
              },
              surface.label === 'web attendee'
                ? 'CSRF_TOKEN_INVALID'
                : 'CSRF_TOKEN_MISMATCH',
            ],
          ]) {
            const result = await send(headers);
            expectStatus(result, 403, code);
          }
          expectStatus(
            await send({
              Origin: new URL(surface.origin).origin,
              [surface.csrfHeader]: csrf,
            }),
            422,
            surface.positiveCode,
          );
          const beforeSession = await bffJson(url, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              Origin: new URL(surface.origin).origin,
              Cookie: `${surface.csrfName}=${csrf}`,
              [surface.csrfHeader]: csrf,
            },
            body: JSON.stringify(surface.anonymousPayload),
          });
          expectStatus(beforeSession, 401);
        }

        const staffOnPlatformBff = await bffJson(
          new URL('/api/bff/platform/me', ctx.portal),
          { headers: { Cookie: cookieHeader(surfaces[1].cookies) } },
        );
        assert.equal(
          staffOnPlatformBff.status,
          401,
          'staff session cannot enter platform BFF',
        );
      } finally {
        await browser.close();
      }

      return;
    }
    if (caseId === 'SEC-03') {
      const forged = FORGED_FORWARDED;
      const tenantId = required(f.tenantId, 'SEC-03 tenantId');

      const loginOpen = await navigationFetch(
        ctx.web,
        '/api/auth/login?return=https://evil.example/phish&next=//evil.example',
        { headers: forged },
      );
      assertRedirectStatus(loginOpen);
      assertLocationOrigin(loginOpen.location, ctx.auth, 'OIDC login start');
      assertNoOpenRedirectVector(loginOpen.location);

      const refreshOpen = await navigationFetch(
        ctx.web,
        '/api/auth/refresh?next=https://evil.example/wallet',
        { headers: forged },
      );
      assertRedirectStatus(refreshOpen);
      assertLocationOrigin(
        refreshOpen.location,
        ctx.web,
        'SSR refresh fail-closed',
      );
      assertNoOpenRedirectVector(refreshOpen.location);
      const refreshTarget = new URL(refreshOpen.location, ctx.web);
      assert.ok(
        refreshTarget.pathname === '/auth' || refreshTarget.pathname === '/',
        `refresh must not honor external next, got ${refreshTarget.pathname}`,
      );

      const refreshHead = await navigationFetch(
        ctx.web,
        '/api/auth/refresh?next=%2Fwallet',
        { method: 'HEAD', headers: forged },
      );
      assert.ok(
        [302, 307, 308, 405].includes(refreshHead.status),
        `unexpected HEAD refresh status ${refreshHead.status}`,
      );
      if (refreshHead.location) {
        assertLocationOrigin(refreshHead.location, ctx.web, 'HEAD refresh');
        assertNoOpenRedirectVector(refreshHead.location);
      }

      const adminMigrate = await navigationFetch(
        ctx.web,
        `/admin?return=https://evil&next=//evil&tenantId=${tenantId}`,
        { headers: forged },
      );
      assertRedirectStatus(adminMigrate);
      assertLocationOrigin(
        adminMigrate.location,
        ctx.portal,
        'legacy admin GET',
      );
      assertNoOpenRedirectVector(adminMigrate.location);
      assert.equal(
        adminMigrate.setCookie,
        null,
        'legacy GET must not mutate session',
      );
      assertUncacheableHostProbe(adminMigrate, 'legacy admin GET');

      const adminHead = await navigationFetch(
        ctx.web,
        `/admin?tenantId=${tenantId}`,
        { method: 'HEAD', headers: forged },
      );
      assertRedirectStatus(adminHead);
      assertLocationOrigin(adminHead.location, ctx.portal, 'legacy admin HEAD');
      assertNoOpenRedirectVector(adminHead.location);
      assert.equal(
        adminHead.setCookie,
        null,
        'legacy HEAD must not mutate session',
      );

      const adminPost = await navigationFetch(ctx.web, '/admin', {
        method: 'POST',
        headers: {
          ...forged,
          'content-type': 'application/x-www-form-urlencoded',
        },
      });
      assert.ok(
        ![302, 307, 308].includes(adminPost.status),
        `POST /admin must not navigation-redirect (legacy GET/HEAD only), got ${adminPost.status} ${adminPost.location ?? ''}`,
      );

      const apiHealth = await fetch(new URL('/v1/health', ctx.api), {
        redirect: 'manual',
        headers: {
          host: EVIL_HOST,
          ...forged,
        },
      });
      assert.equal(
        apiHealth.status,
        200,
        'API health must not redirect on forged host',
      );
      assert.equal(apiHealth.headers.get('location'), null);

      const webPort = required(
        ctx.runtime?.upstreamPorts?.web,
        'runtime.upstreamPorts.web',
      );
      const portalPort = required(
        ctx.runtime?.upstreamPorts?.portal,
        'runtime.upstreamPorts.portal',
      );
      const webHost = new URL(ctx.web).host;
      const portalHost = new URL(ctx.portal).host;

      const directLogin = await directUpstreamFetch(
        webPort,
        webHost,
        '/api/auth/login?return=https://evil.example/phish&next=//evil.example',
        { headers: forged },
      );
      assertRedirectStatus(directLogin);
      assertLocationOrigin(
        directLogin.location,
        ctx.auth,
        'direct OIDC login start',
      );
      assertNoOpenRedirectVector(directLogin.location);
      assertUncacheableHostProbe(directLogin, 'direct OIDC login');

      const directRefresh = await directUpstreamFetch(
        webPort,
        webHost,
        '/api/auth/refresh?next=https://evil.example/wallet',
        { headers: forged },
      );
      assertRedirectStatus(directRefresh);
      assertLocationOrigin(
        directRefresh.location,
        ctx.web,
        'direct SSR refresh fail-closed',
      );
      assertNoOpenRedirectVector(directRefresh.location);
      assertUncacheableHostProbe(directRefresh, 'direct SSR refresh');

      const marketingAuth = await navigationFetch(
        ctx.marketing,
        '/auth?return=https://evil.example&next=//evil',
        { headers: forged },
      );
      assertRedirectStatus(marketingAuth);
      assertLocationOrigin(
        marketingAuth.location,
        ctx.web,
        'marketing /auth bounce',
      );
      assert.notEqual(
        new URL(marketingAuth.location, ctx.web).hostname,
        EVIL_HOST,
        'marketing bounce must not redirect to forged forwarded host',
      );
      assertUncacheableHostProbe(marketingAuth, 'marketing /auth bounce');
      const marketingAuthTarget = new URL(marketingAuth.location, ctx.web);
      const productAuth = await navigationFetch(
        ctx.web,
        `${marketingAuthTarget.pathname}${marketingAuthTarget.search}`,
        { headers: forged },
      );
      assertRedirectStatus(productAuth);
      assertLocationOrigin(
        productAuth.location,
        ctx.web,
        'marketing /auth next hop',
      );
      assertNoOpenRedirectVector(productAuth.location);

      const marketingAdmin = await navigationFetch(
        ctx.marketing,
        `/admin?return=https://evil&tenantId=${tenantId}`,
        { headers: forged },
      );
      assertRedirectStatus(marketingAdmin);
      assertLocationOrigin(
        marketingAdmin.location,
        ctx.web,
        'marketing /admin bounce',
      );
      assert.notEqual(
        new URL(marketingAdmin.location, ctx.web).hostname,
        EVIL_HOST,
        'marketing admin bounce must not leave marketing with forged host',
      );
      assertUncacheableHostProbe(marketingAdmin, 'marketing /admin bounce');
      const marketingAdminTarget = new URL(marketingAdmin.location, ctx.web);
      const productAdmin = await navigationFetch(
        ctx.web,
        `${marketingAdminTarget.pathname}${marketingAdminTarget.search}`,
        { headers: forged },
      );
      assertRedirectStatus(productAdmin);
      assertLocationOrigin(
        productAdmin.location,
        ctx.portal,
        'marketing /admin next hop',
      );
      assertNoOpenRedirectVector(productAdmin.location);

      const portalLogin = await navigationFetch(
        ctx.portal,
        '/api/auth/login?return=https://evil.example/admin',
        { headers: forged },
      );
      assertRedirectStatus(portalLogin);
      assertLocationOrigin(
        portalLogin.location,
        ctx.auth,
        'portal staff OIDC login',
      );
      assertNoOpenRedirectVector(portalLogin.location);
      assert.ok(
        !String(portalLogin.setCookie).includes(EVIL_HOST),
        'portal login must not persist external return in cookies',
      );

      const portalPlatform = await navigationFetch(
        ctx.portal,
        '/api/auth/platform/login',
        { headers: forged },
      );
      assertRedirectStatus(portalPlatform);
      assertLocationOrigin(
        portalPlatform.location,
        ctx.auth,
        'portal platform OIDC login',
      );
      assertNoOpenRedirectVector(portalPlatform.location);

      const directPortalLogin = await directUpstreamFetch(
        portalPort,
        portalHost,
        '/api/auth/login?return=https://evil.example',
        { headers: forged },
      );
      assertRedirectStatus(directPortalLogin);
      assertLocationOrigin(
        directPortalLogin.location,
        ctx.auth,
        'direct portal OIDC login',
      );
      assertNoOpenRedirectVector(directPortalLogin.location);
      assertUncacheableHostProbe(directPortalLogin, 'direct portal login');

      const directAdmin = await directUpstreamFetch(
        webPort,
        webHost,
        `/admin?return=https://evil&next=//evil&tenantId=${tenantId}`,
        { headers: forged },
      );
      assertRedirectStatus(directAdmin);
      assertLocationOrigin(
        directAdmin.location,
        ctx.portal,
        'direct legacy admin GET',
      );
      assertNoOpenRedirectVector(directAdmin.location);
      assert.equal(
        directAdmin.setCookie,
        null,
        'direct legacy GET must not mutate session',
      );
      assertUncacheableHostProbe(directAdmin, 'direct legacy admin GET');

      const directMarketingAuth = await directUpstreamFetch(
        webPort,
        new URL(ctx.marketing).host,
        '/auth?return=https%3A%2F%2Fevil.example%2Fphish',
        { headers: forged },
      );
      if ([302, 307, 308].includes(directMarketingAuth.status)) {
        assertLocationOrigin(
          directMarketingAuth.location,
          ctx.web,
          'direct marketing /auth',
        );
        assertNoOpenRedirectVector(directMarketingAuth.location);
      } else {
        assert.ok(
          [400, 403, 421].includes(directMarketingAuth.status),
          `direct marketing /auth must deny or redirect to product origin, got ${directMarketingAuth.status}`,
        );
      }
      assertUncacheableHostProbe(directMarketingAuth, 'direct marketing /auth');

      const canonicalPoison = await directUpstreamFetch(webPort, webHost, '/', {
        headers: { ...forged, 'x-forwarded-host': 'www.vemoki.com' },
      });
      if ([301, 302, 307, 308].includes(canonicalPoison.status)) {
        assertLocationOrigin(
          canonicalPoison.location,
          ctx.web,
          'product Host with forged www forwarding',
        );
      } else {
        assert.ok(
          [200, 400, 403, 421].includes(canonicalPoison.status),
          `product Host with forged www forwarding must serve product or deny, got ${canonicalPoison.status}`,
        );
      }
      assertUncacheableHostProbe(canonicalPoison, 'forged www forwarding');

      for (const path of [
        '/auth?notice=auth_failed&return=https%3A%2F%2Fevil.example%2Fphish&next=%2F%2Fevil.example&redirect=https%3A%2F%2Fevil.example',
        '/auth?error=session_rejected&return=%2F%2Fevil.example',
      ]) {
        const authBounce = await directUpstreamFetch(webPort, webHost, path, {
          headers: forged,
        });
        assertRedirectStatus(authBounce);
        assertLocationOrigin(
          authBounce.location,
          ctx.web,
          'direct /auth bounce',
        );
        assertNoOpenRedirectVector(authBounce.location);
        assertUncacheableHostProbe(authBounce, 'direct /auth bounce');
      }

      const forgedHostAuth = await directUpstreamFetch(
        webPort,
        EVIL_HOST,
        '/auth?notice=auth_failed&redirect=https%3A%2F%2Fevil.example',
        { headers: forged },
      );
      if ([302, 307, 308].includes(forgedHostAuth.status)) {
        assertLocationOrigin(
          forgedHostAuth.location,
          ctx.web,
          'forged Host /auth',
        );
        assertNoOpenRedirectVector(forgedHostAuth.location);
      } else {
        assert.ok(
          [400, 403, 421].includes(forgedHostAuth.status),
          `forged Host /auth must deny or redirect to configured origin, got ${forgedHostAuth.status}`,
        );
      }
      assertUncacheableHostProbe(forgedHostAuth, 'forged Host /auth');

      for (const method of ['GET', 'HEAD']) {
        const legacyApi = await directUpstreamFetch(
          webPort,
          webHost,
          '/api/bff/admin/tenants/forged?redirect=https%3A%2F%2Fevil.example',
          { method, headers: forged },
        );
        assert.equal(
          legacyApi.status,
          410,
          `legacy API ${method} must be gone`,
        );
        assert.equal(
          legacyApi.location,
          null,
          `legacy API ${method} must not redirect`,
        );
        assert.equal(
          legacyApi.setCookie,
          null,
          `legacy API ${method} must not mutate session`,
        );
      }

      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        const legacyWrite = await directUpstreamFetch(
          webPort,
          webHost,
          `/admin?tenantId=${tenantId}&redirect=https%3A%2F%2Fevil.example`,
          { method, headers: forged },
        );
        assert.equal(
          legacyWrite.status,
          404,
          `legacy ${method} must not navigate`,
        );
        assert.equal(
          legacyWrite.location,
          null,
          `legacy ${method} must not redirect`,
        );
        assert.equal(
          legacyWrite.setCookie,
          null,
          `legacy ${method} must not mutate session`,
        );
      }

      return;
    }
    if (caseId === 'SEC-04') {
      const scanner = await bearer(ctx, 'scanner');
      const owner = await bearer(ctx, 'owner');
      const attendee = await bearer(ctx, 'attendee');
      const cs = await bearer(ctx, 'cs');
      const ticketId = required(f.ticketId, 'SEC-04 ticketId');
      const reportBefore = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(reportBefore, 200);
      const session = await request(
        ctx,
        'POST',
        gatePath(f, 'sessions'),
        scanner,
        { tenantId: f.tenantId },
      );
      expectStatus(session, 200);
      const reserve = await request(
        ctx,
        'POST',
        gatePath(f, 'reservations'),
        scanner,
        {
          tenantId: f.tenantId,
          staffSessionId: session.body.sessionId,
          ticketId,
        },
      );
      expectStatus(reserve, 200);
      assert.ok(reserve.body.reservationId);
      assert.ok(reserve.body.token);
      const badConfirm = await request(
        ctx,
        'POST',
        `${gatePath(f, 'reservations')}/${reserve.body.reservationId}/confirm`,
        scanner,
        {
          tenantId: f.tenantId,
          staffSessionId: session.body.sessionId,
          token: 'synthetic-invalid-admission-token',
        },
      );
      expectStatus(badConfirm, 409, 'RESERVATION_TOKEN_MISMATCH');
      const reportAfterBadToken = await request(
        ctx,
        'GET',
        reportPath(f),
        owner,
      );
      expectStatus(reportAfterBadToken, 200);
      assert.equal(
        reportAfterBadToken.body.checkInSuccessCount,
        reportBefore.body.checkInSuccessCount,
        'rejected admission token must not consume check-in state',
      );

      const ownerReserveProbe = await request(
        ctx,
        'POST',
        gatePath(f, 'reservations'),
        owner,
        {
          tenantId: f.tenantId,
          staffSessionId: session.body.sessionId,
          ticketId: randomUUID(),
        },
      );
      assert.notEqual(
        ownerReserveProbe.status,
        429,
        'owner gate.reserve bucket must stay isolated from scanner exhaustion',
      );

      assertRateLimited(
        await request(ctx, 'POST', gatePath(f, 'reservations'), scanner, {
          tenantId: f.tenantId,
          staffSessionId: session.body.sessionId,
          ticketId: randomUUID(),
        }),
        { code: 'RATE_LIMITED', retryable: true, noRetryAfter: true },
        'gate reserve',
      );

      assertRateLimited(
        await request(ctx, 'POST', '/redemptions/resolve', attendee, {
          code: 'SYNTHETIC-SEC04-RESOLVE-PROBE',
        }),
        { code: 'RATE_LIMITED', retryable: true, noRetryAfter: true },
        'global redemption resolve',
      );

      const redeemBody = {
        code: required(f.secondCode, 'SEC-04 secondCode'),
        formVersion: required(f.data?.formVersion, 'SEC-04 formVersion'),
        termsVersion: required(f.data?.termsVersion, 'SEC-04 termsVersion'),
        answers: required(f.data?.answers, 'SEC-04 answers'),
        termsAccepted: true,
      };
      const quotaBeforeRedeem = (
        await request(ctx, 'GET', reportPath(f), owner)
      ).body.quota.allocated;
      assertRateLimited(
        await request(ctx, 'POST', redemptionPath(f), attendee, redeemBody, {
          'idempotency-key': randomUUID(),
        }),
        { code: 'RATE_LIMITED', retryable: true, noRetryAfter: true },
        'event redeem',
      );
      const quotaAfterRedeem = (await request(ctx, 'GET', reportPath(f), owner))
        .body.quota.allocated;
      assert.equal(
        quotaAfterRedeem,
        quotaBeforeRedeem,
        'rate-limited redeem must not allocate quota',
      );

      assertRateLimited(
        await request(
          ctx,
          'GET',
          `/tenants/${f.tenantId}/events/${f.eventId}/imports`,
          owner,
        ),
        { code: 'RATE_LIMITED', retryable: true, retryAfter: true },
        'import jobs list',
      );

      const clientEventId = randomUUID();
      assertRateLimited(
        await request(
          ctx,
          'GET',
          `${gatePath(f, 'offline-sync/receipts')}/${clientEventId}?tenantId=${f.tenantId}`,
          scanner,
        ),
        { code: 'RATE_LIMITED', retryable: true, noRetryAfter: true },
        'offline-sync receipt GET',
      );

      const offlineProbe = await request(
        ctx,
        'POST',
        gatePath(f, 'offline-sync'),
        scanner,
        {
          tenantId: f.tenantId,
          staffSessionId: session.body.sessionId,
          deviceId: randomUUID(),
          clientClockAt: new Date().toISOString(),
          events: [],
        },
      );
      assert.notEqual(
        offlineProbe.status,
        429,
        'POST offline-sync budget must stay isolated from receipt read bucket',
      );

      const firstResend = await request(
        ctx,
        'POST',
        `/tenants/${f.tenantId}/events/${f.eventId}/tickets/${ticketId}/resend`,
        cs,
        null,
        { 'idempotency-key': randomUUID() },
      );
      assert.ok(
        [200, 201, 202].includes(firstResend.status),
        `CS resend setup expected success, got ${firstResend.status} (${firstResend.body.code ?? 'none'})`,
      );
      const cooldown = await request(
        ctx,
        'POST',
        `/tenants/${f.tenantId}/events/${f.eventId}/tickets/${ticketId}/resend`,
        cs,
        null,
        { 'idempotency-key': randomUUID() },
      );
      assertRateLimited(
        cooldown,
        { code: 'RESEND_COOLDOWN', retryable: false, noRetryAfter: true },
        'CS resend cooldown',
      );
      return;
    }
    if (caseId === 'JOB-04') {
      // PLAN JOB-04: resend cooldown/dedup (CS endpoint) + staff notification
      // retry cooldown live qua Keycloak thật, cùng emailNeedsCs phân biệt
      // retry tạm (FAILED/UNKNOWN) khỏi terminal (DEAD, dictionary O12).
      // Staff/recipient hourly numeric matrix is covered by the DB layer.
      const owner = await bearer(ctx, 'owner');
      const ticketId = required(f.ticketId, 'JOB-04 ticketId');
      const resendPath = `/tenants/${f.tenantId}/events/${f.eventId}/tickets/${ticketId}/resend`;

      const [budgetLimit] = await web04Query(
        f,
        f.tenantId,
        `INSERT INTO tenant_limits (tenant_id, email_per_day) VALUES ($1::uuid, 0)
         ON CONFLICT (tenant_id) DO UPDATE SET email_per_day = 0
         RETURNING email_per_day`,
        [f.tenantId],
      );
      assert.equal(budgetLimit?.email_per_day, 0);

      const firstResend = await request(ctx, 'POST', resendPath, owner, null, {
        'idempotency-key': 'job04-resend-1',
      });
      assert.ok(
        [200, 201, 202].includes(firstResend.status),
        `JOB-04 CS resend expected success, got ${firstResend.status} (${firstResend.body.code ?? 'none'})`,
      );
      assert.equal(firstResend.body.providerStatus, 'PENDING');
      assert.equal(firstResend.body.replayed, false);

      const dedupReplay = await request(ctx, 'POST', resendPath, owner, null, {
        'idempotency-key': 'job04-resend-1',
      });
      expectStatus(dedupReplay, firstResend.status);
      assert.equal(
        dedupReplay.body.operationId,
        firstResend.body.operationId,
        'JOB-04 dedup: same Idempotency-Key must replay the same logical resend',
      );
      assert.equal(dedupReplay.body.replayed, true);

      const cooldownDeny = await request(ctx, 'POST', resendPath, owner, null, {
        'idempotency-key': 'job04-resend-2',
      });
      assertRateLimited(
        cooldownDeny,
        { code: 'RESEND_COOLDOWN', retryable: false, noRetryAfter: true },
        'JOB-04 CS resend cooldown',
      );

      // The API keeps the command pending; the real worker must defer before SMTP.
      let deferred;
      for (let i = 0; i < 40; i++) {
        [deferred] = await web04Query(
          f,
          f.tenantId,
          `SELECT o.status, o.payload->>'emailBudgetDeferred' AS reason,
                  n.state AS notification_state, n.attempts
           FROM outbox o JOIN notifications n
             ON n.tenant_id = o.tenant_id
            AND n.business_key = o.payload->>'businessKey'
           WHERE o.tenant_id = $1::uuid AND n.id = $2::uuid`,
          [f.tenantId, firstResend.body.notificationId],
        );
        if (deferred?.reason === 'email_budget_deferred') break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      assert.equal(deferred?.status, 'PENDING');
      assert.equal(deferred?.reason, 'email_budget_deferred');
      assert.equal(deferred?.notification_state, 'PENDING');
      assert.equal(deferred?.attempts, 0, 'quota defer consumes no SMTP retry');

      const [beforeAdmission] = await web04Query(
        f,
        f.tenantId,
        `SELECT COALESCE(sent_count, 0) AS sent_count FROM tenant_email_usage
         WHERE tenant_id = $1::uuid AND usage_date = (clock_timestamp() AT TIME ZONE 'UTC')::date`,
        [f.tenantId],
      );
      await web04Query(
        f,
        f.tenantId,
        `UPDATE tenant_limits SET email_per_day = 100 WHERE tenant_id = $1::uuid`,
        [f.tenantId],
      );
      await web04Query(
        f,
        f.tenantId,
        `UPDATE outbox SET next_attempt_at = clock_timestamp()
         WHERE tenant_id = $1::uuid AND payload->>'businessKey' = $2`,
        [
          f.tenantId,
          `ticket:${ticketId}:resend:email:${firstResend.body.operationId}`,
        ],
      );
      let admitted;
      for (let i = 0; i < 40; i++) {
        [admitted] = await web04Query(
          f,
          f.tenantId,
          `SELECT n.state, n.attempts, u.sent_count
           FROM notifications n JOIN tenant_email_usage u
             ON u.tenant_id = n.tenant_id
            AND u.usage_date = (clock_timestamp() AT TIME ZONE 'UTC')::date
           WHERE n.tenant_id = $1::uuid AND n.id = $2::uuid`,
          [f.tenantId, firstResend.body.notificationId],
        );
        if (admitted?.state === 'ACCEPTED') break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      assert.equal(admitted?.state, 'ACCEPTED');
      assert.equal(admitted?.attempts, 1);
      assert.equal(
        admitted?.sent_count,
        (beforeAdmission?.sent_count ?? 0) + 1,
      );

      const [issuedNotification] = await web04Query(
        f,
        f.tenantId,
        `SELECT id, state FROM notifications
         WHERE tenant_id = $1::uuid AND business_key = $2
         LIMIT 1`,
        [f.tenantId, `ticket:${ticketId}:issued:email`],
      );
      assert.ok(
        issuedNotification,
        'JOB-04 TicketIssued notification must exist from issuance (JOB-01)',
      );
      const notificationId = issuedNotification.id;
      const retryPath = `/tenants/${f.tenantId}/events/${f.eventId}/notifications/${notificationId}/retry`;

      const retryTooSoon = await request(ctx, 'POST', retryPath, owner, {
        reason: 'JOB-04 live retry cooldown probe',
      });
      assertRateLimited(
        retryTooSoon,
        { code: 'RESEND_COOLDOWN', retryable: true, noRetryAfter: true },
        'JOB-04 notification retry cooldown (fresh issuance)',
      );

      await web04Query(
        f,
        f.tenantId,
        `UPDATE notifications SET updated_at = clock_timestamp() - interval '2 minutes'
         WHERE tenant_id = $1::uuid AND id = $2::uuid`,
        [f.tenantId, notificationId],
      );
      const retrySuccess = await request(ctx, 'POST', retryPath, owner, {
        reason: 'JOB-04 live retry after cooldown clears',
      });
      expectStatus(retrySuccess, 201);
      assert.equal(retrySuccess.body.requeued, true);

      const retryAgainTooSoon = await request(ctx, 'POST', retryPath, owner, {
        reason: 'JOB-04 live retry cooldown probe 2',
      });
      assertRateLimited(
        retryAgainTooSoon,
        { code: 'RESEND_COOLDOWN', retryable: true, noRetryAfter: true },
        'JOB-04 notification retry cooldown (after successful requeue)',
      );

      const [afterRequeue] = await web04Query(
        f,
        f.tenantId,
        `SELECT state FROM notifications WHERE tenant_id = $1::uuid AND id = $2::uuid`,
        [f.tenantId, notificationId],
      );
      assert.equal(
        afterRequeue.state,
        'PENDING',
        'JOB-04 successful retry must requeue to PENDING',
      );

      const list = await request(
        ctx,
        'GET',
        `/tenants/${f.tenantId}/events/${f.eventId}/notifications`,
        owner,
      );
      expectStatus(list, 200);
      const providerStates = new Set([
        'PENDING',
        'ACCEPTED',
        'FAILED',
        'DEAD',
        'UNKNOWN',
      ]);
      assert.ok(list.body.items.length >= 1);
      for (const item of list.body.items) {
        assert.ok(
          providerStates.has(item.providerStatus),
          `JOB-04 providerStatus must be in the contract enum, got ${item.providerStatus}`,
        );
      }

      const reportBeforeDead = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(reportBeforeDead, 200);
      const needsCsBefore = reportBeforeDead.body.emailNeedsCsCount;

      await web04Query(
        f,
        f.tenantId,
        `UPDATE notifications SET state = 'DEAD', last_error = 'provider rejected recipient', next_attempt_at = NULL
         WHERE tenant_id = $1::uuid AND id = $2::uuid`,
        [f.tenantId, notificationId],
      );
      const reportAfterDead = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(reportAfterDead, 200);
      assert.equal(
        reportAfterDead.body.emailNeedsCsCount,
        needsCsBefore + 1,
        'JOB-04 terminal DEAD (not transient FAILED/UNKNOWN) must increment emailNeedsCs, not the earlier cooldown-denied transient retry',
      );
      return;
    }
    if (caseId === 'SEC-05') {
      const owner = await bearer(ctx, 'owner');
      const f = ctx.fixture;
      const tenantId = required(f.tenantId, 'SEC-05 tenantId');
      const eventId = required(f.eventId, 'SEC-05 eventId');
      const persistMarker = required(
        f.data?.xssPersistMarker,
        'SEC-05 xssPersistMarker',
      );
      const maskedFormulaEmail = '=***@example.test';

      const exportCreate = await request(
        ctx,
        'POST',
        `/tenants/${tenantId}/events/${eventId}/exports`,
        owner,
        { format: 'csv', filter: { states: ['ACTIVE'] } },
        { 'idempotency-key': randomUUID() },
      );
      expectStatus(exportCreate, 201);
      const exportId = required(exportCreate.body.exportId, 'SEC-05 exportId');
      await waitExportReady(ctx, f, owner, exportId);
      const csv = await downloadExportCsv(ctx, f, owner, exportId);
      assertCsvFormulaGuard(csv, maskedFormulaEmail);
      assert.ok(
        !csv.includes('=formula-'),
        'export must not leak raw formula email',
      );

      const importsBefore = await request(
        ctx,
        'GET',
        `/tenants/${tenantId}/events/${eventId}/imports`,
        owner,
      );
      expectStatus(importsBefore, 200);

      const emptyUpload = await multipartImportUpload(
        ctx,
        owner,
        tenantId,
        eventId,
        {
          kind: 'CODES',
          filename: 'empty.csv',
          contentType: 'text/csv',
          body: Buffer.alloc(0),
        },
      );
      assert.equal(emptyUpload.status, 422);
      assert.equal(emptyUpload.body.code, 'IMPORT_FILE_INVALID');

      const pdfUpload = await multipartImportUpload(
        ctx,
        owner,
        tenantId,
        eventId,
        {
          kind: 'CODES',
          filename: 'probe.pdf',
          contentType: 'application/pdf',
          body: Buffer.from('%PDF-1.4 synthetic'),
        },
      );
      assert.equal(pdfUpload.status, 422);
      assert.equal(pdfUpload.body.code, 'IMPORT_FILE_INVALID');

      const rowLines = ['code'];
      for (let i = 0; i < IMPORT_MAX_ROWS + 1; i += 1) {
        rowLines.push(`ROW-${i}`);
      }
      const rowOverflow = await multipartImportUpload(
        ctx,
        owner,
        tenantId,
        eventId,
        {
          kind: 'CODES',
          filename: 'rows.csv',
          contentType: 'text/csv',
          body: Buffer.from(`${rowLines.join('\n')}\n`, 'utf8'),
        },
      );
      expectStatus(rowOverflow, 201);
      const overflowFileId = required(
        rowOverflow.body.fileId,
        'overflow fileId',
      );
      const overflowHash = required(
        rowOverflow.body.fileHash,
        'overflow fileHash',
      );
      const previewOverflow = await request(
        ctx,
        'POST',
        `/tenants/${tenantId}/events/${eventId}/imports`,
        owner,
        {
          kind: 'CODES',
          sourceId: required(f.sourceId, 'SEC-05 sourceId'),
          ticketTypeId: required(f.ticketTypeId, 'SEC-05 ticketTypeId'),
          fileId: overflowFileId,
          columnMapping: { code: 'code' },
        },
        { 'idempotency-key': randomUUID() },
      );
      expectStatus(previewOverflow, 201);
      const importId = required(
        previewOverflow.body.importId,
        'SEC-05 overflow importId',
      );
      const preview = await request(
        ctx,
        'POST',
        `/tenants/${tenantId}/events/${eventId}/imports/${importId}/preview`,
        owner,
        { fileHash: overflowHash, columnMapping: { code: 'code' } },
      );
      assert.equal(preview.status, 422);
      assert.equal(preview.body.code, 'IMPORT_ROW_LIMIT');

      const importsAfter = await request(
        ctx,
        'GET',
        `/tenants/${tenantId}/events/${eventId}/imports`,
        owner,
      );
      expectStatus(importsAfter, 200);
      assert.equal(
        (importsAfter.body.items ?? []).length,
        (importsBefore.body.items ?? []).length + 1,
        'row-limit preview must not create extra import jobs beyond overflow create',
      );

      const publicBefore = await fetchPublicEventDetail(
        ctx,
        f.tenantSlug,
        f.eventSlug,
      );
      expectStatus(publicBefore, 200);
      const heroBefore = publicBefore.body.sections?.find(
        (section) => section.kind === 'hero',
      );
      assert.ok(heroBefore?.title, 'published hero title required');
      assert.ok(!String(heroBefore.title).includes(XSS_INERT_PROBE));

      const listedVersions = await request(
        ctx,
        'GET',
        `/tenants/${tenantId}/events/${eventId}/config-versions`,
        owner,
      );
      expectStatus(listedVersions, 200);
      const headVersion = Math.max(
        ...(listedVersions.body.items ?? []).map((row) => row.version),
      );
      assert.ok(Number.isFinite(headVersion), 'config version list required');

      const unsafePayload = {
        schemaVersion: 1,
        brand: {
          primaryColor: '#164E63',
          organizationName: 'Tenant SEC-05',
        },
        sections: [
          {
            kind: 'hero',
            id: 'hero',
            visible: true,
            order: 0,
            body: {
              title: 'E2E SEC-05',
              text: '<script>inert-sec05-probe</script>',
            },
          },
          {
            kind: 'info',
            id: 'info',
            visible: true,
            order: 1,
            body: { title: 'Thông tin', text: 'Local fixture' },
          },
          {
            kind: 'redeem',
            id: 'redeem',
            visible: true,
            order: 2,
            body: { title: 'Đổi mã', text: '' },
          },
          {
            kind: 'guide',
            id: 'guide',
            visible: false,
            order: 3,
            body: { title: 'Hướng dẫn', text: '' },
          },
          {
            kind: 'faq',
            id: 'faq',
            visible: true,
            order: 4,
            body: {
              title: 'FAQ',
              items: [
                { question: 'Khi nào?', answer: 'Trong thời gian sự kiện.' },
              ],
            },
          },
          {
            kind: 'terms',
            id: 'terms',
            visible: true,
            order: 5,
            body: {
              title: 'Điều khoản',
              termsVersion: 'terms-v1',
              text: 'Synthetic test terms',
            },
          },
        ],
        formDefinitionId: 'form-v1',
        termsVersion: 'terms-v1',
        form: {
          formVersion: 'form-v1',
          fields: [
            { id: 'full_name', label: 'Họ tên', type: 'text', required: true },
            { id: 'email', label: 'Email', type: 'email', required: true },
            { id: 'phone', label: 'Điện thoại', type: 'phone', required: true },
            {
              id: 'shirt',
              label: 'Áo',
              type: 'select',
              required: true,
              options: [{ id: 'm', label: 'M' }],
            },
            { id: 'agree', label: 'Đồng ý', type: 'checkbox', required: true },
          ],
        },
      };
      const unsafeSave = await request(
        ctx,
        'POST',
        `/tenants/${tenantId}/events/${eventId}/config-versions`,
        owner,
        { payload: unsafePayload, expectedVersion: headVersion },
      );
      assert.equal(unsafeSave.status, 422);
      assert.ok(
        ['CONFIG_UNSAFE_MARKUP', 'CONFIG_INCOMPATIBLE'].includes(
          unsafeSave.body.code,
        ),
        `unsafe config must fail closed (${unsafeSave.body.code})`,
      );
      assert.match(
        String(unsafeSave.body.message),
        /HTML\/JS|script|unsafe/i,
        'unsafe markup message must describe rejection',
      );

      const publicAfter = await fetchPublicEventDetail(
        ctx,
        f.tenantSlug,
        f.eventSlug,
      );
      expectStatus(publicAfter, 200);
      const heroAfter = publicAfter.body.sections?.find(
        (section) => section.kind === 'hero',
      );
      assert.equal(heroAfter?.title, heroBefore.title);
      assert.ok(!JSON.stringify(publicAfter.body).includes(XSS_INERT_PROBE));
      assert.ok(!JSON.stringify(publicAfter.body).includes(persistMarker));

      const badTemplate = await request(
        ctx,
        'POST',
        `/tenants/${tenantId}/events/${eventId}/notification-templates/preview`,
        owner,
        {
          kind: 'TicketIssued',
          subject: 'Hi',
          bodyText: 'plain',
          bodyHtml: '<script>inert-sec05-template</script>',
          sampleVariables: {},
        },
      );
      assert.equal(badTemplate.status, 422);
      assert.equal(badTemplate.body.code, 'TEMPLATE_INVALID');

      const escapedPreview = await request(
        ctx,
        'POST',
        `/tenants/${tenantId}/events/${eventId}/notification-templates/preview`,
        owner,
        {
          kind: 'TicketIssued',
          subject: '{{eventName}}',
          bodyText: '{{eventName}}',
          bodyHtml: '<p>{{eventName}}</p>',
          sampleVariables: {
            eventName: '<img src=x alt=SEC05-INERT-ESCAPE-PROBE>',
          },
        },
      );
      expectStatus(escapedPreview, 201);
      assert.equal(escapedPreview.body.escaped, true);
      assert.ok(
        !String(escapedPreview.body.bodyHtml).includes('<img'),
        'preview HTML must escape markup',
      );
      assert.ok(
        String(escapedPreview.body.bodyHtml).includes('&lt;img'),
        'preview must HTML-escape injected markup',
      );

      const badAsset = await request(
        ctx,
        'POST',
        `/tenants/${tenantId}/events/${eventId}/assets/upload-init`,
        owner,
        {
          filename: 'probe.pdf',
          contentType: 'application/pdf',
          byteLength: 128,
        },
      );
      assert.equal(badAsset.status, 422);
      assert.equal(badAsset.body.code, 'ASSET_INVALID');

      const assetTooLarge = await request(
        ctx,
        'POST',
        `/tenants/${tenantId}/events/${eventId}/assets/upload-init`,
        owner,
        {
          filename: 'large.png',
          contentType: 'image/png',
          byteLength: 5 * 1024 * 1024 + 1,
        },
      );
      assert.equal(assetTooLarge.status, 422);
      assert.equal(assetTooLarge.body.code, 'ASSET_LIMIT');

      const portalLogin = await fetch(
        new URL('/api/auth/login?return=/', ctx.portal),
        { redirect: 'manual' },
      );
      assert.ok(
        [302, 307, 308].includes(portalLogin.status),
        `portal auth entry must redirect (${portalLogin.status})`,
      );
      assertSecurityProfileHeaders(portalLogin.headers, 'portal CSP profile');

      const webPort = required(
        ctx.runtime?.upstreamPorts?.web,
        'runtime.upstreamPorts.web',
      );
      const webHost = new URL(ctx.web).host;
      const webLogin = await fetch(
        `http://127.0.0.1:${webPort}/api/auth/login?return=/`,
        {
          redirect: 'manual',
          headers: { host: webHost },
        },
      );
      assert.ok(
        [302, 307, 308].includes(webLogin.status),
        `direct web auth entry must redirect (${webLogin.status})`,
      );
      assertSecurityProfileHeaders(webLogin.headers, 'web CSP profile');
      return;
    }
    if (caseId === 'SEC-06') {
      const owner = await bearer(ctx, 'owner');
      const scanner = await bearer(ctx, 'scanner');
      const tenantId = required(f.tenantId, 'SEC-06 tenantId');
      const eventId = required(f.eventId, 'SEC-06 eventId');
      const secretReason = required(
        f.data?.secretReason,
        'SEC-06 secretReason',
      );
      const secretEmail = required(f.data?.secretEmail, 'SEC-06 secretEmail');
      const secretHmac = required(f.data?.secretHmac, 'SEC-06 secretHmac');
      const probeRawCode = required(
        f.data?.probeRawCode,
        'SEC-06 probeRawCode',
      );
      const codesSourceId = required(
        f.data?.codesSourceId,
        'SEC-06 codesSourceId',
      );
      const auditCount = required(f.data?.auditCount, 'SEC-06 auditCount');
      const codesBulkCount = required(
        f.data?.codesBulkCount,
        'SEC-06 codesBulkCount',
      );
      const FORBIDDEN_VALUES = [
        secretReason,
        secretEmail,
        secretHmac,
        probeRawCode,
      ];

      const auditPath = `/tenants/${tenantId}/events/${eventId}/audit`;
      const auditDefault = await request(ctx, 'GET', auditPath, owner);
      expectStatus(auditDefault, 200);
      assertNoStoreCache(auditDefault.headers, 'audit list');
      assert.equal(
        auditDefault.body.items.length,
        20,
        'audit default page size must stay clamped to default 20',
      );
      assert.ok(
        auditDefault.body.nextCursor,
        'audit must paginate when seeded rows exceed default page',
      );
      assertNoForbiddenStrings(
        auditDefault.body,
        FORBIDDEN_VALUES,
        'audit list',
      );
      for (const item of auditDefault.body.items) {
        assertNoForbiddenKeys(
          item,
          [
            'reason',
            'reasonCode',
            'sanitizedDiff',
            'sanitized_diff',
            'codeHmac',
            'code_hmac',
            'rawCode',
            'email',
            'phone',
            'token',
          ],
          'audit item',
        );
      }

      const auditOversized = await request(
        ctx,
        'GET',
        `${auditPath}?limit=100000`,
        owner,
      );
      expectStatus(auditOversized, 200);
      assert.ok(
        auditOversized.body.items.length <= 100,
        `audit limit must cap at 100, got ${auditOversized.body.items.length}`,
      );
      assert.ok(
        auditOversized.body.items.length < auditCount,
        'audit oversized limit must not return every seeded row (cap enforced)',
      );

      const cursor = auditDefault.body.nextCursor;
      assert.doesNotMatch(
        cursor,
        /sec06\.demo|audit_logs|reason-/i,
        'audit cursor must be opaque, not a readable payload',
      );
      const auditPage2 = await request(
        ctx,
        'GET',
        `${auditPath}?cursor=${encodeURIComponent(cursor)}`,
        owner,
      );
      expectStatus(auditPage2, 200);
      assertNoForbiddenStrings(
        auditPage2.body,
        FORBIDDEN_VALUES,
        'audit page 2',
      );

      const auditBadCursor = await request(
        ctx,
        'GET',
        `${auditPath}?cursor=not-a-real-cursor`,
        owner,
      );
      expectStatus(auditBadCursor, 422, 'INVALID_CURSOR');
      assertNoStoreCache(auditBadCursor.headers, 'audit invalid cursor error');
      assertNoForbiddenStrings(
        auditBadCursor.body,
        FORBIDDEN_VALUES,
        'audit bad cursor error',
      );

      const auditDenied = await request(ctx, 'GET', auditPath, scanner);
      deny(auditDenied);
      assertNoStoreCache(auditDenied.headers, 'audit denied error');
      assertNoForbiddenStrings(
        auditDenied.body,
        FORBIDDEN_VALUES,
        'audit denied error',
      );

      const codesPath = `/tenants/${tenantId}/events/${eventId}/codes`;
      const codesBySource = await request(
        ctx,
        'GET',
        `${codesPath}?sourceId=${codesSourceId}&limit=100000`,
        owner,
      );
      expectStatus(codesBySource, 200);
      assertNoStoreCache(codesBySource.headers, 'codes list');
      assert.ok(
        codesBySource.body.items.length <= 100,
        `codes limit must cap at 100, got ${codesBySource.body.items.length}`,
      );
      assert.ok(
        codesBySource.body.items.length < codesBulkCount,
        'codes oversized limit must not return every seeded row (cap enforced)',
      );
      for (const item of codesBySource.body.items) {
        assertNoForbiddenKeys(
          item,
          ['codeHmac', 'code_hmac', 'rawCode', 'code', 'q', 'pepper'],
          'codes item',
        );
      }
      assertNoForbiddenStrings(
        codesBySource.body,
        [probeRawCode, secretHmac],
        'codes list',
      );

      const codesByQ = await request(
        ctx,
        'GET',
        `${codesPath}?q=${encodeURIComponent(probeRawCode)}`,
        owner,
      );
      expectStatus(codesByQ, 200);
      assert.equal(
        codesByQ.body.items.length,
        1,
        'q search must resolve exactly the probed code',
      );
      assertNoForbiddenStrings(
        codesByQ.body,
        [probeRawCode, secretHmac],
        'codes q search',
      );

      const codesDenied = await request(ctx, 'GET', codesPath, scanner);
      deny(codesDenied);
      assertNoStoreCache(codesDenied.headers, 'codes denied error');
      assertNoForbiddenStrings(
        codesDenied.body,
        FORBIDDEN_VALUES,
        'codes denied error',
      );

      const reportResp = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(reportResp, 200);
      assertNoStoreCache(reportResp.headers, 'event report');
      const reportDenied = await request(ctx, 'GET', reportPath(f), scanner);
      deny(reportDenied);
      assertNoStoreCache(reportDenied.headers, 'event report denied');

      const ticketsResp = await request(
        ctx,
        'GET',
        `/me/tickets?tenantId=${tenantId}`,
        owner,
      );
      expectStatus(ticketsResp, 200);
      assertNoStoreCache(ticketsResp.headers, 'me/tickets');
      const ticketsDenied = await request(
        ctx,
        'GET',
        `/me/tickets?tenantId=${tenantId}`,
      );
      expectStatus(ticketsDenied, 401);
      assertNoStoreCache(ticketsDenied.headers, 'me/tickets denied');

      const sessionResp = await request(
        ctx,
        'POST',
        gatePath(f, 'sessions'),
        scanner,
        { tenantId },
      );
      expectStatus(sessionResp, 200);
      assertNoStoreCache(sessionResp.headers, 'gate session');
      const sessionDenied = await request(
        ctx,
        'POST',
        gatePath(f, 'sessions'),
        null,
        { tenantId },
      );
      expectStatus(sessionDenied, 401);
      assertNoStoreCache(sessionDenied.headers, 'gate session denied');

      const missingEvent = await request(
        ctx,
        'GET',
        `/tenants/${tenantId}/events/${randomUUID()}/audit`,
        owner,
      );
      deny(missingEvent);
      assertNoStoreCache(missingEvent.headers, 'audit missing event error');
      assert.equal(typeof missingEvent.body.requestId, 'string');
      assert.equal(
        'stack' in missingEvent.body,
        false,
        'error body must not leak stack',
      );
      return;
    }
    if (caseId === 'AUTH-03') {
      const path = redemptionPath(f);
      const body = redemptionBody(f, caseId);
      const owner = await bearer(ctx, 'owner');
      const before = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(before, 200);
      const beforeState = await auth03Snapshot(f);
      const resolveBody = { code: body.code };
      const assertDeniedBff = async (response, status, label, errorCode) => {
        expectStatus(response, status, errorCode);
        for (const field of [
          'tenantId',
          'eventId',
          'ticketTypeId',
          'sourceId',
          'resolveToken',
        ]) {
          assert.equal(
            response.body[field],
            undefined,
            `${label} leaked ${field}`,
          );
        }
        const responseJson = JSON.stringify(response.body);
        assert.equal(
          [body.code, f.tenantId, f.eventId, 'resolveToken'].some((value) =>
            responseJson.includes(value),
          ),
          false,
          `${label} leaked code or target`,
        );
        assert.deepEqual(
          await auth03Snapshot(f),
          beforeState,
          `${label} must not mutate redeem state`,
        );
      };
      expectStatus(
        await request(ctx, 'POST', '/redemptions/resolve', null, resolveBody),
        401,
      );
      const afterGuest = await auth03Snapshot(f);
      assert.deepEqual(
        afterGuest,
        beforeState,
        'guest resolve must not mutate redeem state',
      );
      const key = randomUUID();
      expectStatus(
        await request(ctx, 'POST', path, null, body, {
          'idempotency-key': key,
        }),
        401,
      );
      const unverified = await bearer(ctx, 'unverified');
      for (const candidate of [body.code, `INVALID-${randomUUID()}`]) {
        const denied = await request(
          ctx,
          'POST',
          '/redemptions/resolve',
          unverified,
          {
            code: candidate,
          },
        );
        expectStatus(denied, 403, 'EMAIL_NOT_VERIFIED');
        assert.equal(denied.body.retryable, false);
        assert.equal(denied.body.resolveToken, undefined);
        for (const field of [
          'tenantId',
          'eventId',
          'ticketTypeId',
          'sourceId',
        ]) {
          assert.equal(
            denied.body[field],
            undefined,
            `resolve leaked ${field}`,
          );
        }
        assert.equal(
          JSON.stringify(denied.body).includes(candidate),
          false,
          'resolve leaked code',
        );
      }
      const suffix = required(process.env.E2E_HOST_SUFFIX, 'E2E_HOST_SUFFIX');
      const trust = required(process.env.E2E_TLS_SPKI, 'E2E_TLS_SPKI');
      const webOrigin = new URL(ctx.web).origin;
      const bffResolveUrl = new URL('/api/bff/redeem/resolve', ctx.web);
      const bffIssueUrl = new URL('/api/bff/redeem', ctx.web);
      const guestCsrf = randomUUID();
      const guestHeaders = {
        'content-type': 'application/json',
        Origin: webOrigin,
        Cookie: `${WEB_CSRF_COOKIE}=${guestCsrf}`,
        [WEB_CSRF_HEADER]: guestCsrf,
      };
      await assertDeniedBff(
        await bffJson(bffResolveUrl, {
          method: 'POST',
          headers: guestHeaders,
          body: JSON.stringify(resolveBody),
        }),
        401,
        'guest BFF resolve',
      );
      await assertDeniedBff(
        await bffJson(bffIssueUrl, {
          method: 'POST',
          headers: guestHeaders,
          body: JSON.stringify({
            tenantId: f.tenantId,
            eventId: f.eventId,
            ...body,
            idempotencyKey: randomUUID(),
          }),
        }),
        401,
        'guest BFF issue',
      );
      const browser = await chromium.launch({
        headless: true,
        args: [
          `--host-resolver-rules=MAP *.${suffix} 127.0.0.1, MAP ${suffix} 127.0.0.1`,
          `--ignore-certificate-errors-spki-list=${trust}`,
        ],
      });
      try {
        const cookies = await oidcBrowserSession(
          browser,
          ctx,
          ctx.web,
          ctx.portal,
          '/api/auth/login?return=/',
          '/api/bff/me/tenants',
          'unverified',
        );
        const csrf = cookies.find(
          ({ name }) => name === WEB_CSRF_COOKIE,
        )?.value;
        assert.ok(csrf, 'unverified Web session must include CSRF cookie');
        const unverifiedHeaders = {
          'content-type': 'application/json',
          Origin: webOrigin,
          Cookie: cookieHeader(cookies),
          [WEB_CSRF_HEADER]: csrf,
        };
        await assertDeniedBff(
          await bffJson(bffResolveUrl, {
            method: 'POST',
            headers: unverifiedHeaders,
            body: JSON.stringify(resolveBody),
          }),
          403,
          'unverified BFF resolve',
          'EMAIL_NOT_VERIFIED',
        );
        await assertDeniedBff(
          await bffJson(bffIssueUrl, {
            method: 'POST',
            headers: unverifiedHeaders,
            body: JSON.stringify({
              tenantId: f.tenantId,
              eventId: f.eventId,
              ...body,
              idempotencyKey: randomUUID(),
            }),
          }),
          403,
          'unverified BFF issue',
          'EMAIL_NOT_VERIFIED',
        );
      } finally {
        await browser.close();
      }
      const deniedIssue = await request(ctx, 'POST', path, unverified, body, {
        'idempotency-key': key,
      });
      expectStatus(deniedIssue, 403, 'EMAIL_NOT_VERIFIED');
      assert.equal(deniedIssue.body.resolveToken, undefined);
      assert.equal(
        JSON.stringify(deniedIssue.body).includes(body.code),
        false,
        'issue leaked code',
      );
      assert.deepEqual(
        await auth03Snapshot(f),
        beforeState,
        'unverified resolve/issue must not change code, quota, pending, request, ticket, operation, audit, outbox or rate counters',
      );
      const deniedSnapshot = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(deniedSnapshot, 200);
      assert.equal(
        deniedSnapshot.body.quota.allocated,
        before.body.quota.allocated,
      );
      assert.equal(
        deniedSnapshot.body.pendingApprovalCount,
        before.body.pendingApprovalCount,
      );
      const attendee = await bearer(ctx, 'attendee');
      const resolved = await request(
        ctx,
        'POST',
        '/redemptions/resolve',
        attendee,
        resolveBody,
      );
      assert.ok(
        [200, 201].includes(resolved.status),
        `verified resolve HTTP ${resolved.status}`,
      );
      assert.equal(resolved.body.tenantId, f.tenantId);
      assert.equal(resolved.body.eventId, f.eventId);
      assert.equal(typeof resolved.body.resolveToken, 'string');
      const issued = await request(ctx, 'POST', path, attendee, body, {
        'idempotency-key': randomUUID(),
      });
      expectStatus(issued, 201);
      assert.equal(issued.body.state, 'ACTIVE');
      const after = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(after, 200);
      assert.equal(after.body.quota.allocated, before.body.quota.allocated + 1);
      return;
    }
    if (caseId === 'DB-04') {
      const path = redemptionPath(f);
      const body = redemptionBody(f, caseId);
      const before = await db04Snapshot(f);
      const anonymous = await request(ctx, 'POST', path, null, body, {
        'idempotency-key': randomUUID(),
      });
      expectStatus(anonymous, 401);
      assert.deepEqual(
        await db04Snapshot(f),
        before,
        'guest must not hold code, quota or pending state',
      );
      const unverified = await bearer(ctx, 'unverified');
      const denied = await request(ctx, 'POST', path, unverified, body, {
        'idempotency-key': randomUUID(),
      });
      expectStatus(denied, 403, 'EMAIL_NOT_VERIFIED');
      assert.deepEqual(
        await db04Snapshot(f),
        before,
        'unverified must not leave operation, hold or pending state',
      );
      const attendee = await bearer(ctx, 'attendee');
      const codes = [
        f.code,
        f.secondCode,
        required(f.data?.raceCode, 'DB-04 thirdCode'),
      ];
      const outcomes = await db04ControlledRequests(
        ctx,
        path,
        attendee,
        body,
        codes,
      );
      assert.equal(outcomes.filter((x) => x.status === 201).length, 1);
      assert.equal(
        outcomes.filter(
          (x) => x.status === 409 && x.body.code === 'ATTENDEE_LIMIT',
        ).length,
        2,
      );
      const after = await db04Snapshot(f);
      assert.equal(after.attendees.length, 1);
      assert.equal(
        after.attendees[0].canonical_email,
        f.accounts.attendee.username,
      );
      assert.ok(after.attendees[0].canonical_email.includes('.last+label.'));
      assert.equal(after.counters.length, 1);
      assert.equal(after.counters[0].issued_count, 1);
      assert.equal(after.counters[0].max_tickets, 1);
      assert.equal(after.tickets.length, 1);
      assert.equal(after.requests.length, 1);
      assert.equal(
        after.codes.filter((x) => x.status === 'CONSUMED').length,
        1,
      );
      assert.equal(
        after.codes.filter((x) => x.status === 'AVAILABLE').length,
        2,
      );
      assert.ok(after.codes.every((x) => x.status !== 'HELD'));
      assert.ok(after.quotas.every((x) => x.allocated === 1));
      assert.equal(after.operations.length, 3);
      assert.ok(after.operations.every((x) => x.status === 'COMPLETED'));
      assert.equal(
        after.audits.filter((x) => x.action === 'ticket.issued').length,
        1,
      );
      assert.equal(
        after.outbox.filter((x) => x.type === 'TicketIssued').length,
        1,
      );
      return;
    }
    if (caseId === 'DB-07') {
      const attendee = await bearer(ctx, 'attendee');
      const manager = await bearer(ctx, 'manager');
      const secondApprover = await bearer(ctx, 'owner');
      const path = redemptionPath(f);
      const body = redemptionBody(f, caseId);
      const hold = async (code, allocated = 0) => {
        const key = randomUUID();
        const pendingBody = { ...body, code };
        const first = await request(ctx, 'POST', path, attendee, pendingBody, {
          'idempotency-key': key,
        });
        expectStatus(first, 201);
        assert.equal(first.body.status, 'PENDING_REVIEW');
        assert.equal(first.body.code, 'APPROVAL_PENDING');
        assert.equal(first.body.replayed, false);
        assert.equal(first.body.ticketId, undefined);
        const replay = await request(ctx, 'POST', path, attendee, pendingBody, {
          'idempotency-key': key,
        });
        expectStatus(replay, 201);
        assert.equal(replay.body.replayed, true);
        assert.equal(replay.body.requestId, first.body.requestId);
        const s = await db07State(f, first.body.requestId);
        assert.equal(s.request.status, 'PENDING_REVIEW');
        assert.equal(s.code.status, 'HELD');
        assert.equal(s.code.active_request_id, first.body.requestId);
        assert.equal(s.tickets.length, 0);
        assert.ok(
          s.quota.every((q) => q.allocated === allocated),
          'pending must not allocate quota',
        );
        assert.equal(
          s.audit.filter((a) => a.action === 'redemption.pending').length,
          1,
        );
        assert.equal(s.outbox.length, 0);
        assert.ok(
          Math.abs(
            new Date(s.request.expires_at).getTime() -
              new Date(s.request.created_at).getTime() -
              required(f.data?.pendingTtlHours, 'DB-07 pendingTtlHours') *
                3_600_000,
          ) < 5000,
          'pending TTL must come from issuance source config',
        );
        assert.equal(
          first.body.expiresAt,
          new Date(s.request.expires_at).toISOString(),
        );
        return first.body.requestId;
      };
      const decision = (requestId, action, token, key, reason) =>
        request(
          ctx,
          'POST',
          `${path}/${requestId}/${action}`,
          token,
          action === 'deny' ? { reason } : undefined,
          { 'idempotency-key': key },
        );

      const approveRequestId = await hold(f.code);
      const firstKey = randomUUID();
      const secondKey = randomUUID();
      const approvals = await db07DecisionBarrier(ctx, approveRequestId, [
        () => decision(approveRequestId, 'approve', manager, firstKey),
        () => decision(approveRequestId, 'approve', secondApprover, secondKey),
      ]);
      assert.ok(approvals.some((result) => result.status === 201));
      const approved = approvals.find((result) => result.status === 201);
      assert.equal(approved.body.status, 'ISSUED');
      for (const result of approvals) {
        if (result.status === 201)
          assert.equal(result.body.ticketId, approved.body.ticketId);
        else expectStatus(result, 409, 'DECISION_CONFLICT');
      }
      const approvedState = await db07State(f, approveRequestId);
      assert.equal(approvedState.request.status, 'ISSUED');
      assert.equal(approvedState.code.status, 'CONSUMED');
      assert.equal(approvedState.tickets.length, 1);
      assert.equal(approvedState.tickets[0].id, approved.body.ticketId);
      assert.ok(approvedState.quota.every((q) => q.allocated === 1));
      assert.equal(
        approvedState.audit.filter((a) => a.action === 'redemption.approved')
          .length,
        1,
      );
      assert.equal(
        approvedState.outbox.filter((o) => o.type === 'TicketIssued').length,
        1,
      );
      const replayKey = approvals[0].status === 201 ? firstKey : secondKey;
      const replayActor =
        approvals[0].status === 201 ? manager : secondApprover;
      const approvalReplay = await decision(
        approveRequestId,
        'approve',
        replayActor,
        replayKey,
      );
      expectStatus(approvalReplay, 201);
      assert.equal(approvalReplay.body.replayed, true);
      assert.equal(approvalReplay.body.ticketId, approved.body.ticketId);
      assert.equal(approvalReplay.body.operationId, approved.body.operationId);

      const denyRequestId = await hold(f.secondCode, 1);
      const denyKey = randomUUID();
      const denied = await decision(
        denyRequestId,
        'deny',
        manager,
        denyKey,
        'DB-07 synthetic denial',
      );
      expectStatus(denied, 201);
      assert.equal(denied.body.status, 'REJECTED');
      const denyReplay = await decision(
        denyRequestId,
        'deny',
        manager,
        denyKey,
        'DB-07 synthetic denial',
      );
      expectStatus(denyReplay, 201);
      assert.equal(denyReplay.body.replayed, true);
      assert.equal(denyReplay.body.operationId, denied.body.operationId);
      expectStatus(
        await decision(denyRequestId, 'approve', secondApprover, randomUUID()),
        409,
        'DECISION_CONFLICT',
      );
      const deniedState = await db07State(f, denyRequestId);
      assert.equal(deniedState.request.status, 'REJECTED');
      assert.equal(
        deniedState.request.decision_reason,
        'DB-07 synthetic denial',
      );
      assert.equal(deniedState.code.status, 'AVAILABLE');
      assert.equal(deniedState.code.active_request_id, null);
      assert.equal(deniedState.tickets.length, 0);
      assert.ok(deniedState.quota.every((q) => q.allocated === 1));
      assert.equal(
        deniedState.audit.filter((a) => a.action === 'redemption.denied')
          .length,
        1,
      );
      assert.equal(deniedState.outbox.length, 0);

      const expiryRequestId = await hold(
        required(f.data?.thirdCode, 'DB-07 thirdCode'),
        1,
      );
      await db03Query(
        f,
        `UPDATE redemption_requests
        SET expires_at=clock_timestamp() - interval '1 second'
        WHERE tenant_id=$1::uuid AND id=$2::uuid`,
        [f.tenantId, expiryRequestId],
      );
      const expiryKey = randomUUID();
      expectStatus(
        await decision(expiryRequestId, 'approve', manager, expiryKey),
        409,
        'PENDING_EXPIRED',
      );
      expectStatus(
        await decision(expiryRequestId, 'approve', manager, expiryKey),
        409,
        'PENDING_EXPIRED',
      );
      const expiredState = await db07State(f, expiryRequestId);
      assert.equal(expiredState.request.status, 'EXPIRED');
      assert.equal(expiredState.code.status, 'AVAILABLE');
      assert.equal(expiredState.code.active_request_id, null);
      assert.equal(expiredState.tickets.length, 0);
      assert.ok(expiredState.quota.every((q) => q.allocated === 1));
      assert.equal(
        expiredState.audit.filter((a) => a.action === 'redemption.expired')
          .length,
        1,
      );
      assert.equal(expiredState.outbox.length, 0);

      const quotaRequestId = await hold(
        required(f.data?.fourthCode, 'DB-07 fourthCode'),
        1,
      );
      await db03Query(
        f,
        `UPDATE quota_buckets SET capacity=allocated
        WHERE tenant_id=$1::uuid AND event_id=$2::uuid`,
        [f.tenantId, f.eventId],
      );
      const quotaKey = randomUUID();
      expectStatus(
        await decision(quotaRequestId, 'approve', manager, quotaKey),
        409,
        'QUOTA_EXHAUSTED',
      );
      expectStatus(
        await decision(quotaRequestId, 'approve', manager, quotaKey),
        409,
        'QUOTA_EXHAUSTED',
      );
      const quotaState = await db07State(f, quotaRequestId);
      assert.equal(quotaState.request.status, 'PENDING_REVIEW');
      assert.equal(quotaState.code.status, 'HELD');
      assert.equal(quotaState.tickets.length, 0);
      assert.ok(quotaState.quota.every((q) => q.allocated === 1));
      assert.equal(
        quotaState.audit.filter((a) => a.action === 'redemption.approved')
          .length,
        0,
      );
      assert.equal(quotaState.outbox.length, 0);
      const operations = await db03Query(
        f,
        `SELECT status FROM operations
        WHERE tenant_id=$1::uuid AND event_id=$2::uuid`,
        [f.tenantId, f.eventId],
      );
      assert.ok(
        operations.length >= 8,
        'DB-07 must persist redeem and decision outcomes',
      );
      assert.ok(
        operations.every((op) => op.status === 'COMPLETED'),
        'DB-07 must leave no IN_PROGRESS operation after races/replay',
      );
      return;
    }
    if (caseId === 'AUTH-06') {
      const scanner = await bearer(ctx, 'scanner');
      const manager = await bearer(ctx, 'manager');
      const supervisor = await bearer(ctx, 'supervisor');
      const owner = await bearer(ctx, 'owner');
      const sessions = gatePath(f, 'sessions');
      const scannerSession = await request(ctx, 'POST', sessions, scanner, {
        tenantId: f.tenantId,
      });
      expectStatus(scannerSession, 200);
      await auth06Revoke(
        f,
        'UPDATE memberships SET revoked_at = now() WHERE tenant_id = $1::uuid AND user_id = $2::uuid AND revoked_at IS NULL',
        [f.tenantId, f.accounts.scanner.userId],
      );
      deny(
        await request(ctx, 'POST', sessions, scanner, { tenantId: f.tenantId }),
      );

      const gates = gatePath(f, 'gates');
      expectStatus(
        await request(ctx, 'POST', gates, manager, {
          tenantId: f.tenantId,
          name: `AUTH-06 before ${randomUUID()}`,
        }),
        201,
      );
      await auth06Revoke(
        f,
        `UPDATE event_assignments SET revoked_at = now()
         WHERE tenant_id = $1::uuid AND event_id = $2::uuid
           AND membership_id = (SELECT id FROM memberships WHERE tenant_id = $1::uuid AND user_id = $3::uuid)
           AND revoked_at IS NULL`,
        [f.tenantId, f.eventId, f.accounts.manager.userId],
      );
      deny(
        await request(ctx, 'POST', gates, manager, {
          tenantId: f.tenantId,
          name: `AUTH-06 after ${randomUUID()}`,
        }),
      );

      const session = await request(ctx, 'POST', sessions, supervisor, {
        tenantId: f.tenantId,
      });
      expectStatus(session, 200);
      const before = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(before, 200);
      const reservation = await request(
        ctx,
        'POST',
        gatePath(f, 'reservations'),
        supervisor,
        {
          tenantId: f.tenantId,
          staffSessionId: session.body.sessionId,
          ticketId: required(f.ticketId, 'AUTH-06 ticketId'),
        },
      );
      expectStatus(reservation, 200);
      expectStatus(
        await request(ctx, 'POST', gatePath(f, 'sessions/revoke'), owner, {
          tenantId: f.tenantId,
          staffSessionId: session.body.sessionId,
        }),
        201,
      );
      expectStatus(
        await request(
          ctx,
          'POST',
          `${gatePath(f, 'reservations')}/${reservation.body.reservationId}/confirm`,
          supervisor,
          {
            tenantId: f.tenantId,
            staffSessionId: session.body.sessionId,
            token: reservation.body.token,
          },
        ),
        409,
        'SESSION_NOT_ACTIVE',
      );
      const after = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(after, 200);
      assert.equal(
        after.body.checkInSuccessCount,
        before.body.checkInSuccessCount,
        'revoked session must not confirm check-in',
      );
      return;
    }
    if (caseId === 'GATE-01') {
      const owner = await bearer(ctx, 'owner');
      const scanner = await bearer(ctx, 'scanner');
      const gates = gatePath(f, 'gates');
      const listPath = `${gates}?tenantId=${f.tenantId}`;
      const before = await request(ctx, 'GET', listPath, scanner);
      expectStatus(before, 200);
      assert.ok(Array.isArray(before.body.gates));
      const name = required(f.data?.gateName, 'GATE-01 gateName');
      assert.ok(!before.body.gates.some((gate) => gate.name === name));
      expectStatus(
        await request(ctx, 'POST', gates, scanner, {
          tenantId: f.tenantId,
          name,
        }),
        403,
      );
      const created = await request(ctx, 'POST', gates, owner, {
        tenantId: f.tenantId,
        name,
      });
      expectStatus(created, 201);
      assert.equal(created.body.eventId, f.eventId);
      assert.equal(created.body.name, name);
      const listed = await request(ctx, 'GET', listPath, scanner);
      expectStatus(listed, 200);
      assert.ok(
        listed.body.gates.some(
          (gate) => gate.id === created.body.id && gate.name === name,
        ),
      );
      expectStatus(
        await request(ctx, 'POST', gates, owner, {
          tenantId: f.tenantId,
          name,
        }),
        409,
        'GATE_NAME_CONFLICT',
      );
      const sessions = gatePath(f, 'sessions');
      const unbound = await request(ctx, 'POST', sessions, scanner, {
        tenantId: f.tenantId,
      });
      expectStatus(unbound, 200);
      assert.equal(unbound.body.gateId, null);
      assert.equal(unbound.body.gateName, null);
      const bound = await request(ctx, 'POST', sessions, scanner, {
        tenantId: f.tenantId,
        gateId: created.body.id,
      });
      expectStatus(bound, 200);
      assert.equal(bound.body.gateId, created.body.id);
      assert.equal(bound.body.gateName, name);
      const foreignGateId = required(
        f.data?.foreignGateId,
        'GATE-01 foreignGateId',
      );
      expectStatus(
        await request(ctx, 'POST', sessions, scanner, {
          tenantId: f.tenantId,
          gateId: foreignGateId,
        }),
        404,
        'GATE_NOT_FOUND',
      );
      const foreignEventId = required(
        f.data?.foreignEventId,
        'GATE-01 foreignEventId',
      );
      deny(
        await request(
          ctx,
          'GET',
          `/gate/events/${foreignEventId}/gates?tenantId=${f.tenantId}`,
          scanner,
        ),
      );
      deny(
        await request(
          ctx,
          'POST',
          `/gate/events/${foreignEventId}/gates`,
          owner,
          { tenantId: f.tenantId, name: `${name} foreign` },
        ),
      );
      return;
    }
    if (caseId === 'GATE-03') {
      const scanner = await bearer(ctx, 'scanner');
      const attendee = await bearer(ctx, 'attendee');
      const owner = await bearer(ctx, 'owner');
      const ticketId = required(f.ticketId, 'GATE-03 ticketId');
      const session = await request(
        ctx,
        'POST',
        gatePath(f, 'sessions'),
        scanner,
        { tenantId: f.tenantId },
      );
      expectStatus(session, 200);
      const reportBefore = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(reportBefore, 200);
      const path = gatePath(f, 'reservations');
      const base = {
        tenantId: f.tenantId,
        staffSessionId: session.body.sessionId,
      };
      expectStatus(
        await request(ctx, 'POST', path, scanner, {
          ...base,
          ticketId: 'bad-qr',
        }),
        422,
        'SCOPE_REQUIRED',
      );
      expectStatus(
        await request(ctx, 'POST', path, scanner, {
          ...base,
          ticketId: randomUUID(),
        }),
        404,
        'TICKET_NOT_FOUND',
      );
      expectStatus(
        await request(ctx, 'POST', path, attendee, { ...base, ticketId }),
        403,
      );
      const reportAfter = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(reportAfter, 200);
      assert.equal(
        reportAfter.body.checkInSuccessCount,
        reportBefore.body.checkInSuccessCount,
      );
      assert.equal(
        reportAfter.body.rejectByReason.TICKET_NOT_FOUND ?? 0,
        (reportBefore.body.rejectByReason.TICKET_NOT_FOUND ?? 0) + 1,
      );
      return;
    }
    if (caseId === 'DB-09') {
      // TECHNICAL-DESIGN §10: ticket lifecycle mutations use dedicated audited
      // endpoints; generic PATCH must not reassign owner (PLAN DB-09 H).
      const ticketId = required(f.ticketId, 'DB-09 ticketId');
      const attendeeUserId = required(
        f.accounts.attendee.userId,
        'DB-09 attendee.userId',
      );
      const otherUserId = required(
        f.accounts.otherAttendee.userId,
        'DB-09 otherAttendee.userId',
      );
      assert.notEqual(attendeeUserId, otherUserId);

      const cs = await bearer(ctx, 'cs');
      const attendee = await bearer(ctx, 'attendee');
      const scanner = await bearer(ctx, 'scanner');

      const csDetail = await request(
        ctx,
        'GET',
        `/tenants/${f.tenantId}/events/${f.eventId}/tickets/${ticketId}`,
        cs,
      );
      expectStatus(csDetail, 200);
      assert.equal(csDetail.body.ticketId, ticketId);

      const meDetail = await request(
        ctx,
        'GET',
        `/me/tickets/${ticketId}?tenantId=${f.tenantId}`,
        attendee,
      );
      expectStatus(meDetail, 200);
      assert.equal(meDetail.body.ticketId, ticketId);

      const snapshot = async () => {
        const row = (
          await web04Query(
            f,
            f.tenantId,
            `SELECT
              (SELECT row_to_json(t) FROM (
                SELECT id, owner_user_id, state, credential_version, request_id, redemption_code_id
                FROM tickets WHERE tenant_id = $1::uuid AND id = $2::uuid
              ) t) AS ticket,
              (SELECT coalesce(json_agg(row_to_json(c) ORDER BY version), '[]'::json) FROM (
                SELECT version, status FROM ticket_credentials
                WHERE tenant_id = $1::uuid AND ticket_id = $2::uuid
              ) c) AS credentials,
              (SELECT row_to_json(rc) FROM (
                SELECT rc.id, rc.status, rc.active_request_id
                FROM redemption_codes rc
                INNER JOIN tickets tk ON tk.redemption_code_id = rc.id AND tk.tenant_id = rc.tenant_id
                WHERE tk.id = $2::uuid AND tk.tenant_id = $1::uuid
              ) rc) AS code,
              (SELECT allocated FROM quota_buckets
                WHERE tenant_id = $1::uuid AND event_id = $3::uuid AND scope = 'EVENT') AS allocated,
              (SELECT coalesce(json_agg(row_to_json(a) ORDER BY a.id), '[]'::json) FROM (
                SELECT id, action, resource_id, operation_id FROM audit_logs
                WHERE tenant_id = $1::uuid AND event_id = $3::uuid
              ) a) AS audit_rows,
              (SELECT coalesce(json_agg(row_to_json(o) ORDER BY o.id), '[]'::json) FROM (
                SELECT id, type, aggregate_id FROM outbox
                WHERE tenant_id = $1::uuid AND event_id = $3::uuid
              ) o) AS outbox_rows`,
            [f.tenantId, ticketId, f.eventId],
          )
        )[0];
        assert.equal(row.ticket.owner_user_id, attendeeUserId);
        return row;
      };

      const before = await snapshot();
      const transferBodies = [
        { label: 'ownerUserId alias', body: { ownerUserId: otherUserId } },
        { label: 'owner_user_id alias', body: { owner_user_id: otherUserId } },
      ];

      const candidates = [
        {
          label: 'CS ticket resource (authorized staff)',
          path: `/tenants/${f.tenantId}/events/${f.eventId}/tickets/${ticketId}`,
          token: cs,
        },
        {
          label: 'attendee me/ticket',
          path: `/me/tickets/${ticketId}?tenantId=${f.tenantId}`,
          token: attendee,
        },
        {
          label: 'gate ticket resource (assigned scanner)',
          path: `/gate/events/${f.eventId}/tickets/${ticketId}`,
          token: scanner,
        },
      ];

      for (const attempt of candidates) {
        for (const transfer of transferBodies) {
          const result = await request(
            ctx,
            'PATCH',
            attempt.path,
            attempt.token,
            transfer.body,
          );
          patchOwnerTransferRefused(
            result,
            `${attempt.label} (${transfer.label})`,
          );
          assert.deepEqual(
            await snapshot(),
            before,
            `${attempt.label} (${transfer.label}): ticket owner/state, credential, code, quota, audit and outbox rows must be unchanged`,
          );
        }
      }
      return;
    }
    if (caseId === 'DB-10') {
      const owner = await bearer(ctx, 'owner');
      const manager = await bearer(ctx, 'manager');
      const attendee = await bearer(ctx, 'attendee');
      const base = `/tenants/${f.tenantId}/events/${f.eventId}/imports`;
      const codes = `code\nDB10-${ctx.fixture.tenantSlug}\n${f.code}\n`;
      const used = await request(
        ctx,
        'POST',
        redemptionPath(f),
        attendee,
        redemptionBody(f, caseId),
        { 'idempotency-key': randomUUID() },
      );
      expectStatus(used, 201);
      const snapshot = async () =>
        (
          await db03Query(
            f,
            `
        SELECT
          (SELECT count(*)::int FROM redemption_codes WHERE tenant_id=$1::uuid AND event_id=$2::uuid) AS codes,
          (SELECT count(*)::int FROM tickets WHERE tenant_id=$1::uuid AND event_id=$2::uuid) AS tickets,
          (SELECT count(*)::int FROM guest_invitations WHERE tenant_id=$1::uuid AND event_id=$2::uuid) AS invitations,
          (SELECT count(*)::int FROM outbox WHERE tenant_id=$1::uuid AND event_id=$2::uuid) AS outbox,
          (SELECT count(*)::int FROM audit_logs WHERE tenant_id=$1::uuid AND event_id=$2::uuid) AS audit,
          (SELECT count(*)::int FROM operations WHERE tenant_id=$1::uuid AND event_id=$2::uuid AND command='import.commit') AS commit_ops,
          (SELECT allocated FROM quota_buckets WHERE tenant_id=$1::uuid AND event_id=$2::uuid AND scope='EVENT') AS allocated,
          (SELECT count(*)::int FROM users) AS users
      `,
            [f.tenantId, f.eventId],
          )
        )[0];
      const usedBefore = (
        await db03Query(
          f,
          `
        SELECT id, status, source_id, ticket_type_id FROM redemption_codes
        WHERE tenant_id=$1::uuid AND event_id=$2::uuid AND id=$3::uuid
      `,
          [f.tenantId, f.eventId, required(f.data?.usedCodeId, 'usedCodeId')],
        )
      )[0];
      assert.equal(usedBefore.status, 'CONSUMED');
      const upload = async (kind, csv, token) => {
        const form = new FormData();
        form.set('kind', kind);
        form.set('file', new Blob([csv], { type: 'text/csv' }), `${kind}.csv`);
        const response = await fetch(new URL(`/v1${base}/files`, ctx.api), {
          method: 'POST',
          headers: { authorization: `Bearer ${token}` },
          body: form,
        });
        const body = await response.json();
        expectStatus({ status: response.status, body }, 201);
        return body;
      };
      const file = await upload('CODES', codes, owner);
      const createBody = {
        kind: 'CODES',
        sourceId: f.sourceId,
        ticketTypeId: f.ticketTypeId,
        fileId: file.fileId,
      };
      const create = (token, body, key, path = base) =>
        request(ctx, 'POST', path, token, body, { 'idempotency-key': key });
      const keys = [randomUUID(), randomUUID()];
      const jobs = [];
      for (const [i, token] of [owner, manager].entries()) {
        const created = await create(token, createBody, keys[i]);
        expectStatus(created, 201);
        assert.equal(created.body.status, 'CREATED');
        jobs.push(created.body);
      }
      const createReplay = await create(owner, createBody, keys[0]);
      expectStatus(createReplay, 201);
      assert.equal(createReplay.body.importId, jobs[0].importId);
      assert.equal(createReplay.body.replayed, true);
      expectStatus(
        await create(owner, { ...createBody, mappingRevision: 2 }, keys[0]),
        409,
        'IDEMPOTENCY_CONFLICT',
      );
      const provenance = await db03Query(
        f,
        `SELECT f.created_by AS uploader,
        j.created_by AS job_actor, j.event_id, j.file_id FROM import_jobs j
        JOIN import_files f ON f.tenant_id=j.tenant_id AND f.id=j.file_id
        WHERE j.tenant_id=$1::uuid AND j.event_id=$2::uuid AND j.id=ANY($3::uuid[])
        ORDER BY j.created_by`,
        [f.tenantId, f.eventId, jobs.map((j) => j.importId)],
      );
      assert.equal(provenance.length, 2);
      assert.deepEqual(
        provenance.map((row) => row.job_actor).sort(),
        [f.accounts.owner.userId, f.accounts.manager.userId].sort(),
      );
      provenance.forEach((row) => {
        assert.equal(row.uploader, f.accounts.owner.userId);
        assert.equal(row.event_id, f.eventId);
        assert.equal(row.file_id, file.fileId);
      });
      const managerReadsOwnerJob = await request(
        ctx,
        'GET',
        `${base}/${jobs[0].importId}`,
        manager,
      );
      expectStatus(managerReadsOwnerJob, 200);
      assert.equal(managerReadsOwnerJob.body.importId, jobs[0].importId);
      const beforePermissionDeny = await snapshot();
      deny(await request(ctx, 'GET', `${base}/${jobs[0].importId}`, attendee));
      deny(
        await request(
          ctx,
          'POST',
          `${base}/${jobs[0].importId}/preview`,
          attendee,
          {},
        ),
      );
      assert.deepEqual(
        await snapshot(),
        beforePermissionDeny,
        'actor without inventory.import must not read or preview another actor job',
      );
      const beforeWrongScope = await snapshot();
      const otherEvent = `/tenants/${f.tenantId}/events/${f.data.otherEventId}/imports`;
      const foreign = `/tenants/${f.data.foreignTenantId}/events/${f.data.foreignEventId}/imports`;
      deny(
        await create(
          owner,
          {
            ...createBody,
            sourceId: f.data.otherSourceId,
            ticketTypeId: f.data.otherTicketTypeId,
          },
          randomUUID(),
          otherEvent,
        ),
      );
      deny(
        await create(
          owner,
          {
            ...createBody,
            sourceId: f.data.foreignSourceId,
            ticketTypeId: f.data.foreignTicketTypeId,
          },
          randomUUID(),
          foreign,
        ),
      );
      deny(
        await request(ctx, 'GET', `${otherEvent}/${jobs[0].importId}`, owner),
      );
      deny(await request(ctx, 'GET', `${foreign}/${jobs[0].importId}`, owner));
      assert.deepEqual(
        await snapshot(),
        beforeWrongScope,
        'wrong tenant/event file and job access must not mutate owner event',
      );
      const foreignJobs = await web04Query(
        f,
        f.data.foreignTenantId,
        `SELECT count(*)::int AS n FROM import_jobs WHERE tenant_id=$1::uuid AND event_id=$2::uuid`,
        [f.data.foreignTenantId, f.data.foreignEventId],
      );
      assert.equal(foreignJobs[0].n, 0);
      const beforePreview = await snapshot();
      const previews = [];
      for (let i = 0; i < 2; i++) {
        const preview = await request(
          ctx,
          'POST',
          `${base}/${jobs[i].importId}/preview`,
          i === 0 ? manager : owner,
          {},
        );
        expectStatus(preview, 201);
        assert.equal(preview.body.validRowCount, 2);
        assert.equal(preview.body.estimatedQuota, 2);
        previews.push(preview.body);
      }
      assert.deepEqual(
        await snapshot(),
        beforePreview,
        'preview must not reserve quota or mutate business rows',
      );
      const commit = (i, token, key, body = previews[i]) =>
        request(
          ctx,
          'POST',
          `${base}/${jobs[i].importId}/commit`,
          token,
          {
            previewRevision: body.previewRevision,
            mappingRevision: body.mappingRevision,
            fileHash: body.fileHash,
          },
          { 'idempotency-key': key },
        );
      const requireBackend = createRequire(
        new URL('../../../packages/backend/package.json', import.meta.url),
      );
      const { Client } = requireBackend('pg');
      const lock = new Client({ connectionString: f.data.controlDatabaseUrl });
      const observer = new Client({
        connectionString: f.data.controlDatabaseUrl,
      });
      await lock.connect();
      await observer.connect();
      let pending;
      const commitKeys = [randomUUID(), randomUUID()];
      try {
        await lock.query('BEGIN');
        await lock.query('SET LOCAL ROLE ticket_runtime');
        await lock.query("SELECT set_config('app.tenant_id', $1, true)", [
          f.tenantId,
        ]);
        await lock.query(
          'SELECT id FROM events WHERE tenant_id=$1::uuid AND id=$2::uuid FOR UPDATE',
          [f.tenantId, f.eventId],
        );
        pending = [
          commit(0, manager, commitKeys[0]),
          commit(1, owner, commitKeys[1]),
        ];
        let waiting = 0;
        for (let i = 0; i < 100; i++) {
          const result =
            await observer.query(`SELECT count(*)::int AS n FROM pg_stat_activity
            WHERE wait_event_type='Lock' AND query LIKE '%SELECT id, status FROM events%'
              AND pid <> pg_backend_pid()`);
          waiting = result.rows[0].n;
          if (waiting >= 2) break;
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        assert.ok(
          waiting >= 2,
          'both HTTP commits must overlap at PostgreSQL event lock',
        );
      } finally {
        await lock.query('ROLLBACK');
        await lock.end();
        await observer.end();
      }
      const outcomes = await Promise.all(pending);
      outcomes.forEach((result) => expectStatus(result, 201));
      assert.deepEqual(
        outcomes.map((r) => r.body.committedRowCount).sort(),
        [0, 1],
      );
      assert.deepEqual(
        outcomes.map((r) => r.body.skippedRowCount).sort(),
        [1, 2],
      );
      for (let i = 0; i < 2; i++) {
        const token = i === 0 ? manager : owner;
        const replay = await commit(i, token, commitKeys[i]);
        expectStatus(replay, 201);
        assert.equal(replay.body.replayed, true);
        assert.equal(
          replay.body.committedRowCount,
          outcomes[i].body.committedRowCount,
        );
        expectStatus(
          await commit(i, token, commitKeys[i], {
            ...previews[i],
            previewRevision: previews[i].previewRevision + 1,
          }),
          409,
          'IDEMPOTENCY_CONFLICT',
        );
      }
      const afterCommit = await snapshot();
      assert.equal(afterCommit.codes, beforePreview.codes + 1);
      assert.equal(afterCommit.commit_ops, beforePreview.commit_ops + 2);
      for (const field of [
        'tickets',
        'invitations',
        'outbox',
        'audit',
        'allocated',
        'users',
      ])
        assert.equal(afterCommit[field], beforePreview[field], field);
      assert.deepEqual(
        (
          await db03Query(
            f,
            `SELECT id, status, source_id, ticket_type_id
        FROM redemption_codes WHERE tenant_id=$1::uuid AND event_id=$2::uuid AND id=$3::uuid`,
            [f.tenantId, f.eventId, f.data.usedCodeId],
          )
        )[0],
        usedBefore,
      );
      const jobRows = await db03Query(
        f,
        `SELECT status, commit_response IS NOT NULL AS has_response
        FROM import_jobs WHERE tenant_id=$1::uuid AND event_id=$2::uuid
          AND id=ANY($3::uuid[])`,
        [f.tenantId, f.eventId, jobs.map((j) => j.importId)],
      );
      assert.equal(jobRows.length, 2);
      jobRows.forEach((row) =>
        assert.deepEqual(row, { status: 'COMPLETED', has_response: true }),
      );
      const consumed = await db03Query(
        f,
        `SELECT consumed_at IS NOT NULL AS consumed
        FROM import_files WHERE tenant_id=$1::uuid AND id=$2::uuid`,
        [f.tenantId, file.fileId],
      );
      assert.deepEqual(consumed, [{ consumed: true }]);
      const ops = await db03Query(
        f,
        `SELECT actor_user_id, status,
        response_json->>'importId' AS import_id FROM operations
        WHERE tenant_id=$1::uuid AND event_id=$2::uuid AND command='import.commit'
          AND client_key=ANY($3::text[])`,
        [f.tenantId, f.eventId, commitKeys],
      );
      assert.equal(ops.length, 2);
      assert.deepEqual(
        ops.map((row) => row.actor_user_id).sort(),
        [f.accounts.owner.userId, f.accounts.manager.userId].sort(),
      );
      ops.forEach((row) => {
        assert.equal(row.status, 'COMPLETED');
        assert.ok(jobs.some((job) => job.importId === row.import_id));
      });
      assert.deepEqual(
        ops.find((row) => row.import_id === jobs[0].importId)?.actor_user_id,
        f.accounts.manager.userId,
        'manager commits the job created by owner',
      );

      // F01: both HTTP requests for one importId/key/body reach the DB lock
      // before either can finish. The second is a replay of the in-flight first.
      const retryFile = await upload(
        'CODES',
        `code\nDB10-RETRY-${ctx.fixture.tenantSlug}\n${f.code}\n`,
        owner,
      );
      const retryCreated = await create(
        owner,
        { ...createBody, fileId: retryFile.fileId },
        randomUUID(),
      );
      expectStatus(retryCreated, 201);
      const retryId = retryCreated.body.importId;
      const retryPreviewResult = await request(
        ctx,
        'POST',
        `${base}/${retryId}/preview`,
        manager,
        {},
      );
      expectStatus(retryPreviewResult, 201);
      const retryBody = retryPreviewResult.body;
      const retryKey = randomUUID();
      const retryCommit = () =>
        request(
          ctx,
          'POST',
          `${base}/${retryId}/commit`,
          manager,
          {
            previewRevision: retryBody.previewRevision,
            mappingRevision: retryBody.mappingRevision,
            fileHash: retryBody.fileHash,
          },
          { 'idempotency-key': retryKey },
        );
      const beforeRetry = await snapshot();
      const retryLock = new Client({
        connectionString: f.data.controlDatabaseUrl,
      });
      const retryObserver = new Client({
        connectionString: f.data.controlDatabaseUrl,
      });
      await retryLock.connect();
      await retryObserver.connect();
      let firstRetry;
      let secondRetry;
      const waitForRetryWaiters = async (minimum) => {
        for (let attempt = 0; attempt < 100; attempt++) {
          const observed =
            await retryObserver.query(`SELECT count(*)::int AS n FROM pg_stat_activity
            WHERE wait_event_type='Lock' AND query LIKE '%SELECT id, status FROM events%'
              AND pid <> pg_backend_pid()`);
          if (observed.rows[0].n >= minimum) return;
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        assert.fail(
          `${minimum} same-key HTTP commits must reach the event lock`,
        );
      };
      try {
        await retryLock.query('BEGIN');
        await retryLock.query('SET LOCAL ROLE ticket_runtime');
        await retryLock.query("SELECT set_config('app.tenant_id', $1, true)", [
          f.tenantId,
        ]);
        await retryLock.query(
          'SELECT id FROM events WHERE tenant_id=$1::uuid AND id=$2::uuid FOR UPDATE',
          [f.tenantId, f.eventId],
        );
        firstRetry = retryCommit();
        await waitForRetryWaiters(1);
        secondRetry = retryCommit();
        await waitForRetryWaiters(2);
      } finally {
        await retryLock.query('ROLLBACK');
        await retryLock.end();
        await retryObserver.end();
      }
      const retryResults = await Promise.all([firstRetry, secondRetry]);
      retryResults.forEach((result) => expectStatus(result, 201));
      assert.deepEqual(
        retryResults.map((result) => result.body.replayed).sort(),
        [false, true],
      );
      retryResults.forEach((result) => {
        assert.equal(result.body.importId, retryId);
        assert.equal(result.body.committedRowCount, 1);
        assert.equal(result.body.skippedRowCount, 1);
      });
      const afterRetry = await snapshot();
      assert.equal(afterRetry.codes, beforeRetry.codes + 1);
      assert.equal(afterRetry.commit_ops, beforeRetry.commit_ops + 1);
      for (const field of [
        'tickets',
        'invitations',
        'outbox',
        'audit',
        'allocated',
        'users',
      ])
        assert.equal(afterRetry[field], beforeRetry[field], field);
      const sameKeyOps = await db03Query(
        f,
        `SELECT actor_user_id, status, response_json->>'importId' AS import_id
        FROM operations WHERE tenant_id=$1::uuid AND event_id=$2::uuid
          AND command='import.commit' AND client_key=$3`,
        [f.tenantId, f.eventId, retryKey],
      );
      assert.deepEqual(sameKeyOps, [
        {
          actor_user_id: f.accounts.manager.userId,
          status: 'COMPLETED',
          import_id: retryId,
        },
      ]);
      assert.deepEqual(
        (
          await db03Query(
            f,
            `SELECT id, status, source_id, ticket_type_id
        FROM redemption_codes WHERE tenant_id=$1::uuid AND event_id=$2::uuid AND id=$3::uuid`,
            [f.tenantId, f.eventId, f.data.usedCodeId],
          )
        )[0],
        usedBefore,
      );
      const beforeCommitDeny = await snapshot();
      deny(
        await request(
          ctx,
          'POST',
          `${base}/${retryId}/commit`,
          attendee,
          {
            previewRevision: retryBody.previewRevision,
            mappingRevision: retryBody.mappingRevision,
            fileHash: retryBody.fileHash,
          },
          { 'idempotency-key': randomUUID() },
        ),
      );
      assert.deepEqual(
        await snapshot(),
        beforeCommitDeny,
        'actor without inventory.import must not commit another actor job',
      );

      const guests = await upload(
        'GUESTS',
        `email\nnew-${f.tenantSlug}@example.test\n`,
        owner,
      );
      const guestJob = await create(
        owner,
        {
          kind: 'GUESTS',
          sourceId: f.sourceId,
          ticketTypeId: f.ticketTypeId,
          fileId: guests.fileId,
        },
        randomUUID(),
      );
      expectStatus(guestJob, 201);
      const guestPreview = await request(
        ctx,
        'POST',
        `${base}/${guestJob.body.importId}/preview`,
        owner,
        {},
      );
      expectStatus(guestPreview, 201);
      assert.equal(guestPreview.body.invitationCount, 1);
      const beforeGuest = await snapshot();
      const guestCommit = await request(
        ctx,
        'POST',
        `${base}/${guestJob.body.importId}/commit`,
        owner,
        {
          previewRevision: guestPreview.body.previewRevision,
          mappingRevision: guestPreview.body.mappingRevision,
          fileHash: guestPreview.body.fileHash,
        },
        { 'idempotency-key': randomUUID() },
      );
      expectStatus(guestCommit, 201);
      assert.equal(guestCommit.body.invitationCount, 1);
      const afterGuest = await snapshot();
      assert.equal(afterGuest.invitations, beforeGuest.invitations + 1);
      assert.equal(afterGuest.outbox, beforeGuest.outbox + 1);
      for (const field of ['tickets', 'users', 'allocated', 'codes', 'audit'])
        assert.equal(afterGuest[field], beforeGuest[field], field);
      const invitation = await db03Query(
        f,
        `SELECT state, import_job_id FROM guest_invitations
        WHERE tenant_id=$1::uuid AND event_id=$2::uuid AND import_job_id=$3::uuid`,
        [f.tenantId, f.eventId, guestJob.body.importId],
      );
      assert.deepEqual(invitation, [
        { state: 'PENDING', import_job_id: guestJob.body.importId },
      ]);
      const minted = await db03Query(
        f,
        `SELECT type, aggregate_id FROM outbox
        WHERE tenant_id=$1::uuid AND event_id=$2::uuid AND type='InvitationTokenMinted'`,
        [f.tenantId, f.eventId],
      );
      assert.equal(minted.length, 1);
      const expired = await db03Query(
        f,
        `UPDATE import_jobs
        SET error_report_expires_at=now()-interval '1 second'
        WHERE tenant_id=$1::uuid AND event_id=$2::uuid AND id=$3::uuid RETURNING id`,
        [f.tenantId, f.eventId, guestJob.body.importId],
      );
      assert.equal(expired.length, 1);
      expectStatus(
        await request(
          ctx,
          'GET',
          `${base}/${guestJob.body.importId}/errors`,
          owner,
        ),
        410,
      );
      deny(
        await request(
          ctx,
          'GET',
          `${foreign}/${guestJob.body.importId}/errors`,
          owner,
        ),
      );
      const beforeDeny = await snapshot();
      await auth06Revoke(
        f,
        `UPDATE event_assignments SET revoked_at=now()
        WHERE tenant_id=$1::uuid AND event_id=$2::uuid AND membership_id=(
          SELECT id FROM memberships WHERE tenant_id=$1::uuid AND user_id=$3::uuid)
          AND revoked_at IS NULL`,
        [f.tenantId, f.eventId, f.accounts.manager.userId],
      );
      deny(await request(ctx, 'GET', `${base}/${jobs[0].importId}`, manager));
      deny(await request(ctx, 'GET', `${base}/${jobs[1].importId}`, manager));
      deny(
        await request(
          ctx,
          'GET',
          `${base}/${jobs[1].importId}/errors`,
          manager,
        ),
      );
      deny(
        await request(
          ctx,
          'POST',
          `${base}/${jobs[1].importId}/preview`,
          manager,
          {},
        ),
      );
      assert.deepEqual(
        await snapshot(),
        beforeDeny,
        'revoked actor denial must have no mutation',
      );
      return;
    }
    if (caseId === 'DB-11') {
      // PLAN §6.1 DB-11 H: staff invite TTL 48h/one-use/email matching, and
      // attendee invitation claim host separation/expired/replay/wrong-owner,
      // proven end to end through the real invite + claim endpoints.
      const owner = await bearer(ctx, 'owner');
      const attendee = await bearer(ctx, 'attendee');
      const otherAttendee = await bearer(ctx, 'otherAttendee');
      const attendeeEmail = required(
        f.accounts.attendee.username,
        'DB-11 attendee.username',
      );
      const otherEmail = required(
        f.accounts.otherAttendee.username,
        'DB-11 otherAttendee.username',
      );
      const invitesBase = `/tenants/${f.tenantId}/invites`;
      const acceptPath = '/me/membership-invites/accept';
      const importsBase = `/tenants/${f.tenantId}/events/${f.eventId}/imports`;
      const invitationsBase = `/tenants/${f.tenantId}/events/${f.eventId}/invitations`;
      const claimPath = `${invitationsBase}/claim`;

      const rawInviteToken = async (inviteId) =>
        required(
          (
            await web04Query(
              f,
              f.tenantId,
              `SELECT payload->>'token' AS token FROM outbox
               WHERE tenant_id=$1::uuid AND type='MembershipInvite' AND aggregate_id=$2::uuid
               ORDER BY created_at DESC LIMIT 1`,
              [f.tenantId, inviteId],
            )
          )[0]?.token,
          'DB-11 membership invite rawToken',
        );
      const rawClaimToken = async (invitationId) =>
        required(
          (
            await web04Query(
              f,
              f.tenantId,
              `SELECT payload->>'token' AS token FROM outbox
               WHERE tenant_id=$1::uuid AND type='InvitationTokenMinted' AND aggregate_id=$2::uuid
               ORDER BY created_at DESC LIMIT 1`,
              [f.tenantId, invitationId],
            )
          )[0]?.token,
          'DB-11 guest invitation rawToken',
        );
      const membershipCount = async (email) =>
        (
          await web04Query(
            f,
            f.tenantId,
            `SELECT count(*)::int AS n FROM memberships m
             JOIN users u ON u.id = m.user_id
             WHERE m.tenant_id=$1::uuid AND lower(u.email)=lower($2) AND m.revoked_at IS NULL`,
            [f.tenantId, email],
          )
        )[0].n;
      const ticketCountForInvitation = async (invitationId) =>
        (
          await web04Query(
            f,
            f.tenantId,
            `SELECT count(*)::int AS n FROM tickets t
             JOIN redemption_codes rc ON rc.id = t.redemption_code_id
             JOIN guest_invitations gi ON gi.redemption_code_id = rc.id
             WHERE gi.tenant_id=$1::uuid AND gi.id=$2::uuid`,
            [f.tenantId, invitationId],
          )
        )[0].n;
      const allocatedQuota = async () =>
        (
          await web04Query(
            f,
            f.tenantId,
            `SELECT allocated FROM quota_buckets
             WHERE tenant_id=$1::uuid AND event_id=$2::uuid AND scope='EVENT'`,
            [f.tenantId, f.eventId],
          )
        )[0].allocated;

      // --- Staff invite: TTL 48h, accept, idempotent same-actor replay ---
      const before = Date.now();
      const invite1 = await request(ctx, 'POST', invitesBase, owner, {
        email: attendeeEmail,
        role: 'CS',
      });
      expectStatus(invite1, 201);
      assert.equal(invite1.body.state, 'PENDING');
      const ttlMs = new Date(invite1.body.expiresAt).getTime() - before;
      assert.ok(
        Math.abs(ttlMs - 48 * 3600 * 1000) < 5 * 60 * 1000,
        `DB-11 staff invite TTL must be configured 48h, got ${ttlMs}ms`,
      );
      const token1 = await rawInviteToken(invite1.body.inviteId);
      assert.equal(await membershipCount(attendeeEmail), 0);
      const accept1 = await request(ctx, 'POST', acceptPath, attendee, {
        token: token1,
      });
      expectStatus(accept1, 201);
      assert.equal(accept1.body.tenantId, f.tenantId);
      assert.equal(await membershipCount(attendeeEmail), 1);
      const acceptReplaySame = await request(
        ctx,
        'POST',
        acceptPath,
        attendee,
        {
          token: token1,
        },
      );
      expectStatus(acceptReplaySame, 201);
      assert.equal(
        await membershipCount(attendeeEmail),
        1,
        'same-actor token replay must stay idempotent, not duplicate membership',
      );

      // --- Staff invite expired: real TTL expiry via control DB, no membership ---
      const invite2 = await request(ctx, 'POST', invitesBase, owner, {
        email: otherEmail,
        role: 'CS',
      });
      expectStatus(invite2, 201);
      await web04Query(
        f,
        f.tenantId,
        `UPDATE membership_invites SET expires_at = now() - interval '1 minute'
         WHERE tenant_id=$1::uuid AND id=$2::uuid`,
        [f.tenantId, invite2.body.inviteId],
      );
      const token2 = await rawInviteToken(invite2.body.inviteId);
      const acceptExpired = await request(
        ctx,
        'POST',
        acceptPath,
        otherAttendee,
        {
          token: token2,
        },
      );
      expectStatus(acceptExpired, 422, 'INVITE_INVALID_OR_EXPIRED');
      assert.equal(await membershipCount(otherEmail), 0);

      // --- Staff invite email mismatch: correct token, different verified actor ---
      const invite3 = await request(ctx, 'POST', invitesBase, owner, {
        email: attendeeEmail,
        role: 'Manager',
      });
      expectStatus(invite3, 201);
      const token3 = await rawInviteToken(invite3.body.inviteId);
      const acceptMismatch = await request(
        ctx,
        'POST',
        acceptPath,
        otherAttendee,
        {
          token: token3,
        },
      );
      expectStatus(acceptMismatch, 422, 'INVITE_INVALID_OR_EXPIRED');
      assert.equal(
        await membershipCount(attendeeEmail),
        1,
        'email-mismatch attempt must not touch the existing membership',
      );

      // --- Cross-use: a staff invite token must not work on attendee claim ---
      const crossClaim = await request(
        ctx,
        'POST',
        claimPath,
        attendee,
        { token: token3 },
        { 'idempotency-key': randomUUID() },
      );
      expectStatus(crossClaim, 410, 'INVITATION_TOKEN_INVALID');

      // --- Attendee invitation claim: real import (GUESTS) + dispatch + claim ---
      const uploadGuests = async (csv) => {
        const form = new FormData();
        form.set('kind', 'GUESTS');
        form.set('file', new Blob([csv], { type: 'text/csv' }), 'guests.csv');
        const response = await fetch(
          new URL(`/v1${importsBase}/files`, ctx.api),
          {
            method: 'POST',
            headers: { authorization: `Bearer ${owner}` },
            body: form,
          },
        );
        const body = await response.json();
        expectStatus({ status: response.status, body }, 201);
        return body;
      };
      const commitGuestImport = async (rawEmail) => {
        // Commit canonicalizes (trim + lowercase) before storing invited_email.
        const email = rawEmail.trim().toLowerCase();
        const file = await uploadGuests(`email\n${email}\n`);
        const created = await request(
          ctx,
          'POST',
          importsBase,
          owner,
          {
            kind: 'GUESTS',
            sourceId: f.sourceId,
            ticketTypeId: f.ticketTypeId,
            fileId: file.fileId,
          },
          { 'idempotency-key': randomUUID() },
        );
        expectStatus(created, 201);
        const preview = await request(
          ctx,
          'POST',
          `${importsBase}/${created.body.importId}/preview`,
          owner,
          {},
        );
        expectStatus(preview, 201);
        assert.equal(preview.body.invitationCount, 1);
        const commit = await request(
          ctx,
          'POST',
          `${importsBase}/${created.body.importId}/commit`,
          owner,
          {
            previewRevision: preview.body.previewRevision,
            mappingRevision: preview.body.mappingRevision,
            fileHash: preview.body.fileHash,
          },
          { 'idempotency-key': randomUUID() },
        );
        expectStatus(commit, 201);
        assert.equal(commit.body.invitationCount, 1);
        const rows = await web04Query(
          f,
          f.tenantId,
          `SELECT id FROM guest_invitations
           WHERE tenant_id=$1::uuid AND event_id=$2::uuid AND invited_email=$3`,
          [f.tenantId, f.eventId, email],
        );
        return required(rows[0]?.id, 'DB-11 guest invitation id');
      };
      const dispatchInvitation = async (invitationId) => {
        const preview = await request(
          ctx,
          'POST',
          `${invitationsBase}/dispatch-preview`,
          owner,
          { invitationIds: [invitationId] },
        );
        expectStatus(preview, 201);
        const dispatch = await request(
          ctx,
          'POST',
          `${invitationsBase}/dispatch`,
          owner,
          {
            invitationIds: [invitationId],
            previewRevision: preview.body.previewRevision,
          },
          { 'idempotency-key': randomUUID() },
        );
        expectStatus(dispatch, 201);
        assert.equal(dispatch.body.dispatchedCount, 1);
      };

      const invitationA = await commitGuestImport(attendeeEmail);
      await dispatchInvitation(invitationA);
      const invitationB = await commitGuestImport(otherEmail);
      await dispatchInvitation(invitationB);

      // wrong-owner: a different real actor with a different verified email
      // cannot claim someone else's invitation.
      const wrongOwner = await request(
        ctx,
        'POST',
        claimPath,
        otherAttendee,
        { token: await rawClaimToken(invitationA) },
        { 'idempotency-key': randomUUID() },
      );
      expectStatus(wrongOwner, 403, 'INVITATION_EMAIL_MISMATCH');
      assert.equal(await ticketCountForInvitation(invitationA), 0);

      // expired: real TTL expiry via control DB, no ticket/quota mutation.
      const quotaBeforeExpiry = await allocatedQuota();
      await web04Query(
        f,
        f.tenantId,
        `UPDATE guest_invitations SET expires_at = now() - interval '1 minute'
         WHERE tenant_id=$1::uuid AND id=$2::uuid`,
        [f.tenantId, invitationB],
      );
      const expiredClaim = await request(
        ctx,
        'POST',
        claimPath,
        otherAttendee,
        { token: await rawClaimToken(invitationB) },
        { 'idempotency-key': randomUUID() },
      );
      expectStatus(expiredClaim, 410, 'INVITATION_EXPIRED');
      assert.equal(await ticketCountForInvitation(invitationB), 0);
      assert.equal(await allocatedQuota(), quotaBeforeExpiry);

      // happy path claim + one-time-use: same key is idempotent, a new key
      // against an already-CLAIMED invitation must not mint a second ticket.
      const quotaBeforeClaim = await allocatedQuota();
      const claimKey = randomUUID();
      const claimBody = {
        token: await rawClaimToken(invitationA),
        formVersion: required(f.data?.formVersion, 'DB-11 formVersion'),
        termsVersion: required(f.data?.termsVersion, 'DB-11 termsVersion'),
        answers: required(f.data?.answers, 'DB-11 answers'),
        termsAccepted: true,
      };
      const claimed = await request(
        ctx,
        'POST',
        claimPath,
        attendee,
        claimBody,
        { 'idempotency-key': claimKey },
      );
      expectStatus(claimed, 201);
      assert.equal(await ticketCountForInvitation(invitationA), 1);
      assert.equal(await allocatedQuota(), quotaBeforeClaim + 1);

      const claimedReplaySameKey = await request(
        ctx,
        'POST',
        claimPath,
        attendee,
        claimBody,
        { 'idempotency-key': claimKey },
      );
      expectStatus(claimedReplaySameKey, 201);
      assert.equal(claimedReplaySameKey.body.ticketId, claimed.body.ticketId);
      assert.equal(await ticketCountForInvitation(invitationA), 1);
      assert.equal(await allocatedQuota(), quotaBeforeClaim + 1);

      const claimedReplayNewKey = await request(
        ctx,
        'POST',
        claimPath,
        attendee,
        { token: await rawClaimToken(invitationA) },
        { 'idempotency-key': randomUUID() },
      );
      expectStatus(claimedReplayNewKey, 410, 'INVITATION_TOKEN_INVALID');
      assert.equal(
        await ticketCountForInvitation(invitationA),
        1,
        'a new Idempotency-Key against a CLAIMED invitation must not mint a second ticket',
      );
      assert.equal(await allocatedQuota(), quotaBeforeClaim + 1);

      // Cross-use: a guest invitation token must not work on the staff accept endpoint.
      const crossAccept = await request(ctx, 'POST', acceptPath, attendee, {
        token: await rawClaimToken(invitationA),
      });
      expectStatus(crossAccept, 422, 'INVITE_INVALID_OR_EXPIRED');
      assert.equal(await membershipCount(attendeeEmail), 1);
      return;
    }
    if (caseId === 'DB-01') {
      // Worker/export role boundary at the HTTP layer: the D suite proves
      // ticket_platform_runtime has no grant on PII tables cross-tenant; H
      // must prove the export/report endpoints a worker serves also refuse
      // cross-tenant access end to end, not only via DB role grants.
      const owner = await bearer(ctx, 'owner');
      const manager = await bearer(ctx, 'manager');
      const foreignTenantId = required(
        f.data?.foreignTenantId,
        'DB-01 foreignTenantId',
      );
      const foreignEventId = required(
        f.data?.foreignEventId,
        'DB-01 foreignEventId',
      );
      const ownReport = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(ownReport, 200);
      assert.equal(ownReport.body.eventId, f.eventId);
      deny(
        await request(
          ctx,
          'GET',
          reportPath(f, foreignTenantId, foreignEventId),
          owner,
        ),
      );
      deny(
        await request(
          ctx,
          'GET',
          reportPath(f, f.tenantId, foreignEventId),
          owner,
        ),
      );
      const exportsPath = `/tenants/${f.tenantId}/events/${f.eventId}/exports`;
      const ownExport = await request(
        ctx,
        'POST',
        exportsPath,
        manager,
        {
          format: 'csv',
          filter: { states: ['ACTIVE'] },
        },
        { 'idempotency-key': randomUUID() },
      );
      expectStatus(ownExport, 201);
      const exportId = required(ownExport.body.exportId, 'DB-01 exportId');
      await waitExportReady(ctx, f, manager, exportId);
      const csv = await downloadExportCsv(ctx, f, manager, exportId);
      assert.ok(csv.length > 0, 'DB-01 own-tenant export must return rows');

      const foreignExportsPath = `/tenants/${foreignTenantId}/events/${foreignEventId}/exports`;
      deny(
        await request(
          ctx,
          'POST',
          foreignExportsPath,
          manager,
          {
            format: 'csv',
            filter: { states: ['ACTIVE'] },
          },
          { 'idempotency-key': randomUUID() },
        ),
      );
      deny(
        await request(
          ctx,
          'GET',
          `/tenants/${foreignTenantId}/events/${f.eventId}/exports/${exportId}`,
          manager,
        ),
      );
      deny(
        await request(
          ctx,
          'GET',
          `/tenants/${foreignTenantId}/events/${f.eventId}/exports/${exportId}/download`,
          manager,
        ),
      );
      return;
    }
    if (caseId === 'DB-02') {
      // Role/assignment revocation must take effect immediately against the
      // DB, even for an access token that is still cryptographically valid
      // and was cached before the revoke (PG is the source of truth, not
      // whatever role/tenant claim the token carried at mint time).
      const owner = await bearer(ctx, 'owner');
      const manager = await bearer(ctx, 'manager');
      const gates = gatePath(f, 'gates');
      const alternate = await secondaryBearer(ctx);
      assert.equal(ctx.secondaryActor.username, f.accounts.attendee.username);
      const beforeAlternate = await db02MutationSnapshot(f, ctx);
      assert.equal(
        beforeAlternate.identity,
        0,
        'secondary identity must start absent',
      );
      assert.ok(
        beforeAlternate.sameEmailUsers > 0,
        'primary same-email identity must exist',
      );
      expectStatus(
        await request(
          ctx,
          'GET',
          `/me/tickets?tenantId=${f.tenantId}`,
          alternate,
        ),
        401,
      );
      expectStatus(
        await request(ctx, 'POST', gatePath(f, 'sessions'), alternate, {
          tenantId: f.tenantId,
        }),
        401,
      );
      expectStatus(
        await request(ctx, 'POST', gates, alternate, {
          tenantId: f.tenantId,
          name: `DB-02 alternate issuer ${randomUUID()}`,
        }),
        401,
      );
      assert.deepEqual(
        await db02MutationSnapshot(f, ctx),
        beforeAlternate,
        'alternate issuer must not create identity, staff session, gate or ticket',
      );
      expectStatus(
        await request(ctx, 'POST', gates, manager, {
          tenantId: f.tenantId,
          name: `DB-02 before ${randomUUID()}`,
        }),
        201,
      );
      await auth06Revoke(
        f,
        `UPDATE event_assignments SET revoked_at = now()
         WHERE tenant_id = $1::uuid AND event_id = $2::uuid
           AND membership_id = (SELECT id FROM memberships WHERE tenant_id = $1::uuid AND user_id = $3::uuid)
           AND revoked_at IS NULL`,
        [f.tenantId, f.eventId, f.accounts.manager.userId],
      );
      deny(
        await request(ctx, 'POST', gates, manager, {
          tenantId: f.tenantId,
          name: `DB-02 after assignment revoke ${randomUUID()}`,
        }),
      );
      const reportStillOk = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(reportStillOk, 200);
      await auth06Revoke(
        f,
        'UPDATE memberships SET revoked_at = now() WHERE tenant_id = $1::uuid AND user_id = $2::uuid AND revoked_at IS NULL',
        [f.tenantId, f.accounts.manager.userId],
      );
      deny(
        await request(ctx, 'POST', gates, manager, {
          tenantId: f.tenantId,
          name: `DB-02 after membership revoke ${randomUUID()}`,
        }),
      );
      return;
    }
    if (caseId === 'DB-03') {
      const attendee = await bearer(ctx, 'attendee');
      const owner = await bearer(ctx, 'owner');
      const body = redemptionBody(f, caseId);
      const path = redemptionPath(f);
      const ticketsPath = `/me/tickets?tenantId=${f.tenantId}`;
      const beforeTickets = await request(ctx, 'GET', ticketsPath, attendee);
      const beforeReport = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(beforeTickets, 200);
      expectStatus(beforeReport, 200);
      const key = randomUUID();
      const first = await request(ctx, 'POST', path, attendee, body, {
        'idempotency-key': key,
      });
      expectStatus(first, 201);
      assert.equal(first.body.replayed, false);
      assert.equal(first.body.state, 'ACTIVE');
      const replay = await request(ctx, 'POST', path, attendee, body, {
        'idempotency-key': key,
      });
      expectStatus(replay, 201);
      assert.equal(replay.body.replayed, true);
      for (const field of ['ticketId', 'requestId', 'operationId']) {
        assert.equal(replay.body[field], first.body[field]);
      }
      const changed = { ...body, code: `${body.code}X` };
      expectStatus(
        await request(ctx, 'POST', path, attendee, changed, {
          'idempotency-key': key,
        }),
        409,
        'IDEMPOTENCY_CONFLICT',
      );
      const afterTickets = await request(ctx, 'GET', ticketsPath, attendee);
      const afterReport = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(afterTickets, 200);
      expectStatus(afterReport, 200);
      assert.equal(
        afterTickets.body.tickets.length,
        beforeTickets.body.tickets.length + 1,
      );
      assert.equal(
        afterTickets.body.tickets.filter(
          (ticket) => ticket.ticketId === first.body.ticketId,
        ).length,
        1,
      );
      assert.equal(
        afterReport.body.quota.allocated,
        beforeReport.body.quota.allocated + 1,
      );

      // Full audit matrix for the issued ticket: exactly one audit_logs row
      // and exactly one outbox row, proving the sequential replay above did
      // not duplicate side effects alongside the HTTP-visible response reuse.
      const auditRows = await db03Query(
        f,
        `SELECT action, resource_id, operation_id FROM audit_logs
         WHERE resource_id = $1 AND action = 'ticket.issued'`,
        [first.body.ticketId],
      );
      assert.equal(
        auditRows.length,
        1,
        'DB-03 replay must not duplicate the ticket.issued audit row',
      );
      assert.equal(auditRows[0].operation_id, first.body.operationId);
      const outboxRows = await db03Query(
        f,
        `SELECT type, aggregate_id FROM outbox
         WHERE aggregate_id = $1 AND type = 'TicketIssued'`,
        [first.body.ticketId],
      );
      assert.equal(
        outboxRows.length,
        1,
        'DB-03 replay must not duplicate the TicketIssued outbox row',
      );

      // Same-request concurrent retry: two HTTP requests racing the same
      // idempotency key/body, not a sequential replay, must still collapse
      // onto one business outcome (ON CONFLICT DO NOTHING + wait-for-first).
      const raceBody = {
        ...body,
        code: required(f.secondCode, 'DB-03 secondCode'),
      };
      const raceKey = randomUUID();
      const beforeRaceReport = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(beforeRaceReport, 200);
      const [raceA, raceB] = await Promise.all([
        request(ctx, 'POST', path, attendee, raceBody, {
          'idempotency-key': raceKey,
        }),
        request(ctx, 'POST', path, attendee, raceBody, {
          'idempotency-key': raceKey,
        }),
      ]);
      expectStatus(raceA, 201);
      expectStatus(raceB, 201);
      assert.equal(raceA.body.ticketId, raceB.body.ticketId);
      assert.equal(raceA.body.operationId, raceB.body.operationId);
      assert.equal(
        [raceA.body.replayed, raceB.body.replayed].filter((v) => v === false)
          .length,
        1,
        'DB-03 concurrent same-key retry must settle on exactly one winner',
      );
      const afterRaceReport = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(afterRaceReport, 200);
      assert.equal(
        afterRaceReport.body.quota.allocated,
        beforeRaceReport.body.quota.allocated + 1,
        'DB-03 concurrent same-key retry must allocate quota exactly once',
      );
      const raceAuditRows = await db03Query(
        f,
        `SELECT action FROM audit_logs
         WHERE resource_id = $1 AND action = 'ticket.issued'`,
        [raceA.body.ticketId],
      );
      assert.equal(raceAuditRows.length, 1);
      const raceOutboxRows = await db03Query(
        f,
        `SELECT type FROM outbox WHERE aggregate_id = $1 AND type = 'TicketIssued'`,
        [raceA.body.ticketId],
      );
      assert.equal(raceOutboxRows.length, 1);

      // Multi-actor race on one code: two different actors redeem the same
      // code concurrently; the code's FOR UPDATE lock must serialize them so
      // exactly one wins ACTIVE and the other observes CODE_CONSUMED, with
      // quota/counter advancing once, not twice.
      const otherAttendee = await bearer(ctx, 'otherAttendee');
      const multiActorCode = required(f.data?.raceCode, 'DB-03 raceCode');
      const beforeMultiReport = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(beforeMultiReport, 200);
      const [actorA, actorB] = await Promise.all([
        request(
          ctx,
          'POST',
          path,
          attendee,
          { ...body, code: multiActorCode },
          { 'idempotency-key': randomUUID() },
        ),
        request(
          ctx,
          'POST',
          path,
          otherAttendee,
          {
            ...body,
            code: multiActorCode,
            answers: required(f.data?.manualAnswers, 'DB-03 manualAnswers'),
          },
          { 'idempotency-key': randomUUID() },
        ),
      ]);
      const statuses = [actorA.status, actorB.status].sort();
      assert.deepEqual(
        statuses,
        [201, 409],
        `DB-03 multi-actor race on one code must split 201/409, got ${actorA.status}/${actorB.status}`,
      );
      const winner = actorA.status === 201 ? actorA : actorB;
      const loser = actorA.status === 201 ? actorB : actorA;
      assert.equal(winner.body.state, 'ACTIVE');
      assert.equal(loser.body.code, 'CODE_CONSUMED');
      const afterMultiReport = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(afterMultiReport, 200);
      assert.equal(
        afterMultiReport.body.quota.allocated,
        beforeMultiReport.body.quota.allocated + 1,
        'DB-03 multi-actor race must allocate quota exactly once',
      );
      const multiAuditRows = await db03Query(
        f,
        `SELECT action FROM audit_logs
         WHERE resource_id = $1 AND action = 'ticket.issued'`,
        [winner.body.ticketId],
      );
      assert.equal(multiAuditRows.length, 1);
    }
    if (caseId === 'WEB-04') {
      await web04AssertRejected(ctx, {
        label: 'WEB-04 invalid',
        tenantId: f.tenantId,
        eventId: f.eventId,
        code: required(f.data?.invalidCode, 'WEB-04 invalidCode'),
        errorStatus: 422,
        errorCode: 'CODE_INVALID',
      });
      await web04AssertRejected(ctx, {
        label: 'WEB-04 expired',
        tenantId: f.tenantId,
        eventId: required(f.data?.expiredEventId, 'WEB-04 expiredEventId'),
        code: required(f.data?.expiredCode, 'WEB-04 expiredCode'),
        errorStatus: 409,
        errorCode: 'REDEMPTION_WINDOW_CLOSED',
      });
      await web04AssertRejected(ctx, {
        label: 'WEB-04 closed/cancelled event',
        tenantId: f.tenantId,
        eventId: required(f.data?.closedEventId, 'WEB-04 closedEventId'),
        code: required(f.data?.closedCode, 'WEB-04 closedCode'),
        errorStatus: 409,
        errorCode: 'EVENT_CANCELLED',
      });
      await web04AssertRejected(ctx, {
        label: 'WEB-04 used code',
        tenantId: f.tenantId,
        eventId: f.eventId,
        code: required(f.data?.usedCode, 'WEB-04 usedCode'),
        errorStatus: 409,
        errorCode: 'CODE_CONSUMED',
      });
      await web04AssertRejected(ctx, {
        label: 'WEB-04 quota exhausted',
        tenantId: f.tenantId,
        eventId: required(f.data?.quotaEventId, 'WEB-04 quotaEventId'),
        code: required(f.data?.quotaCode, 'WEB-04 quotaCode'),
        errorStatus: 409,
        errorCode: 'QUOTA_EXHAUSTED',
      });
      await web04AssertRejected(ctx, {
        label: 'WEB-04 attendee limit',
        tenantId: f.tenantId,
        eventId: required(f.data?.limitEventId, 'WEB-04 limitEventId'),
        code: required(f.data?.limitCode, 'WEB-04 limitCode'),
        errorStatus: 409,
        errorCode: 'ATTENDEE_LIMIT',
      });
      await web04AssertRejected(ctx, {
        label: 'WEB-04 tenant suspended',
        tenantId: required(
          f.data?.suspendedTenantId,
          'WEB-04 suspendedTenantId',
        ),
        eventId: required(f.data?.suspendedEventId, 'WEB-04 suspendedEventId'),
        code: required(f.data?.suspendedCode, 'WEB-04 suspendedCode'),
        errorStatus: 503,
        errorCode: 'TENANT_SUSPENDED',
      });

      // Positive control: a fresh valid code on the same event still issues
      // normally, proving the negative branches above are real rejections
      // and not a broken redeem endpoint.
      const owner = await bearer(ctx, 'owner');
      const attendee = await bearer(ctx, 'attendee');
      const path = redemptionPath(f);
      const body = redemptionBody(f, caseId);
      const beforeReport = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(beforeReport, 200);
      const issued = await request(ctx, 'POST', path, attendee, body, {
        'idempotency-key': randomUUID(),
      });
      expectStatus(issued, 201);
      assert.equal(issued.body.state, 'ACTIVE');
      const afterReport = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(afterReport, 200);
      assert.equal(
        afterReport.body.quota.allocated,
        beforeReport.body.quota.allocated + 1,
        'WEB-04 positive control: valid code must still allocate quota',
      );
    }
    if (caseId === 'WEB-05') {
      const answers = required(f.data?.answers, 'WEB-05 answers');
      const secondCode = required(f.secondCode, 'WEB-05 secondCode');
      const formVersion = required(f.data?.formVersion, 'WEB-05 formVersion');
      const termsVersion = required(
        f.data?.termsVersion,
        'WEB-05 termsVersion',
      );
      const expectedHashes = loadWeb05ExpectedHashes();
      assert.notEqual(expectedHashes.v2.form, expectedHashes.v1.form);
      assert.notEqual(expectedHashes.v2.terms, expectedHashes.v1.terms);

      const rejectBody = (code, answerOverrides = {}, extra = {}) => ({
        code,
        formVersion,
        termsVersion,
        answers: { ...answers, ...answerOverrides },
        termsAccepted: true,
        ...extra,
      });

      await web04AssertRejected(ctx, {
        label: 'WEB-05 required full_name empty',
        tenantId: f.tenantId,
        eventId: f.eventId,
        code: f.code,
        errorStatus: 422,
        errorCode: 'FORM_INVALID',
        redeemBody: rejectBody(f.code, { full_name: '' }),
      });
      await web04AssertRejected(ctx, {
        label: 'WEB-05 invalid email type',
        tenantId: f.tenantId,
        eventId: f.eventId,
        code: f.code,
        errorStatus: 422,
        errorCode: 'FORM_INVALID',
        redeemBody: rejectBody(f.code, { email: 'not-an-email' }),
      });
      await web04AssertRejected(ctx, {
        label: 'WEB-05 invalid phone type',
        tenantId: f.tenantId,
        eventId: f.eventId,
        code: f.code,
        errorStatus: 422,
        errorCode: 'FORM_INVALID',
        redeemBody: rejectBody(f.code, { phone: '!!' }),
      });
      await web04AssertRejected(ctx, {
        label: 'WEB-05 select option not in allowlist',
        tenantId: f.tenantId,
        eventId: f.eventId,
        code: f.code,
        errorStatus: 422,
        errorCode: 'FORM_INVALID',
        redeemBody: rejectBody(f.code, { shirt: 'xl' }),
      });
      await web04AssertRejected(ctx, {
        label: 'WEB-05 forged client schema key',
        tenantId: f.tenantId,
        eventId: f.eventId,
        code: f.code,
        errorStatus: 422,
        errorCode: 'FORM_INVALID',
        redeemBody: rejectBody(f.code, { surprise: 'x' }),
      });
      await web04AssertRejected(ctx, {
        label: 'WEB-05 termsAccepted false',
        tenantId: f.tenantId,
        eventId: f.eventId,
        code: f.code,
        errorStatus: 422,
        errorCode: 'TERMS_REQUIRED',
        redeemBody: rejectBody(f.code, {}, { termsAccepted: false }),
      });
      await web04AssertRejected(ctx, {
        label: 'WEB-05 stale form version',
        tenantId: f.tenantId,
        eventId: f.eventId,
        code: f.code,
        errorStatus: 409,
        errorCode: 'FORM_VERSION_STALE',
        redeemBody: {
          code: f.code,
          formVersion: 'form-v-stale',
          termsVersion,
          answers,
          termsAccepted: true,
        },
      });
      await web04AssertRejected(ctx, {
        label: 'WEB-05 stale terms version',
        tenantId: f.tenantId,
        eventId: f.eventId,
        code: f.code,
        errorStatus: 409,
        errorCode: 'TERMS_VERSION_STALE',
        redeemBody: {
          code: f.code,
          formVersion,
          termsVersion: 'terms-v-stale',
          answers,
          termsAccepted: true,
        },
      });

      const owner = await bearer(ctx, 'owner');
      const attendee = await bearer(ctx, 'attendee');
      const path = redemptionPath(f);

      const v1Issued = await request(
        ctx,
        'POST',
        path,
        attendee,
        rejectBody(secondCode),
        { 'idempotency-key': randomUUID() },
      );
      expectStatus(v1Issued, 201);
      const [v1Consent] = await web04Query(
        f,
        f.tenantId,
        `SELECT form_version, terms_version, form_definition_hash, terms_content_hash
         FROM redemption_requests
         WHERE tenant_id = $1::uuid AND id = $2::uuid`,
        [f.tenantId, v1Issued.body.requestId],
      );
      assert.equal(v1Consent.form_version, formVersion);
      assert.equal(v1Consent.terms_version, termsVersion);
      assert.equal(v1Consent.form_definition_hash, expectedHashes.v1.form);
      assert.equal(v1Consent.terms_content_hash, expectedHashes.v1.terms);

      const configBase = `/tenants/${f.tenantId}/events/${f.eventId}`;
      const listed = await request(
        ctx,
        'GET',
        `${configBase}/config-versions`,
        owner,
      );
      expectStatus(listed, 200);
      const headVersion = Math.max(
        ...(listed.body.items ?? []).map((row) => row.version),
      );
      assert.ok(
        Number.isFinite(headVersion),
        'WEB-05 config version list required',
      );
      const publishV2 = await request(
        ctx,
        'POST',
        `${configBase}/config-versions`,
        owner,
        {
          payload: web05ConfigV2Payload(),
          expectedVersion: headVersion,
        },
      );
      expectStatus(publishV2, 201);
      const publishedV2 = await request(
        ctx,
        'POST',
        `${configBase}/publish`,
        owner,
        {
          expectedVersion: publishV2.body.version,
        },
      );
      expectStatus(publishedV2, 201);

      await web04AssertRejected(ctx, {
        label: 'WEB-05 stale v1 form/terms after publish v2',
        tenantId: f.tenantId,
        eventId: f.eventId,
        code: f.code,
        errorStatus: 409,
        errorCode: 'FORM_VERSION_STALE',
        redeemBody: rejectBody(f.code),
      });

      const v2Answers = { ...answers, agree: true };
      const issued = await request(
        ctx,
        'POST',
        path,
        attendee,
        {
          code: f.code,
          formVersion: 'form-v2',
          termsVersion: 'terms-v2',
          answers: v2Answers,
          termsAccepted: true,
        },
        { 'idempotency-key': randomUUID() },
      );
      expectStatus(issued, 201);
      const [consentRow] = await web04Query(
        f,
        f.tenantId,
        `SELECT form_version, terms_version, form_definition_hash, terms_content_hash
         FROM redemption_requests
         WHERE tenant_id = $1::uuid AND id = $2::uuid`,
        [f.tenantId, issued.body.requestId],
      );
      assert.equal(consentRow.form_version, 'form-v2');
      assert.equal(consentRow.terms_version, 'terms-v2');
      assert.equal(consentRow.form_definition_hash, expectedHashes.v2.form);
      assert.equal(consentRow.terms_content_hash, expectedHashes.v2.terms);
    }
    if (caseId === 'DB-12') {
      // PLAN §6.1 DB-12 H: publish/rollback optimistic concurrency and
      // draft/unpublished non-leak, proven end to end through the real
      // config-publish + public published-events endpoints. Public content
      // cache headers (host/tenant/event/published-version/locale) and the
      // authenticated-preview no-store header are a confirmed runtime gap
      // (apps/api/src/published-events.ts has no Cache-Control at all; the
      // preview route in apps/api/src/config.ts reads the client's
      // cache-control header into an unused var instead of setting the
      // response one) — BLOCKED pending product/runtime decision, not
      // asserted here.
      const owner = await bearer(ctx, 'owner');
      const configBase = `/tenants/${f.tenantId}/events/${f.eventId}`;
      const publicDetailPath = (slug) =>
        `/public/tenants/${f.tenantSlug}/events/${slug}`;
      const publicListPath = `/public/tenants/${f.tenantSlug}/events`;
      const draftEventId = required(f.data?.draftEventId, 'DB-12 draftEventId');

      const businessState = async () => {
        const quota = await web04Query(
          f,
          f.tenantId,
          `SELECT capacity, allocated FROM quota_buckets
           WHERE tenant_id = $1::uuid AND event_id = $2::uuid AND scope = 'EVENT'`,
          [f.tenantId, f.eventId],
        );
        const codes = await web04Query(
          f,
          f.tenantId,
          `SELECT status FROM redemption_codes
           WHERE tenant_id = $1::uuid AND event_id = $2::uuid ORDER BY id`,
          [f.tenantId, f.eventId],
        );
        return { quota, codes };
      };

      const publishConcurrencySnapshot = async () => {
        const [row] = await web04Query(
          f,
          f.tenantId,
          `SELECT
             e.published_config_version AS published_version,
             e.revision,
             (SELECT count(*)::int FROM event_config_versions
              WHERE tenant_id = $1::uuid AND event_id = $2::uuid) AS config_version_count,
             (SELECT count(*)::int FROM audit_logs
              WHERE tenant_id = $1::uuid AND event_id = $2::uuid) AS audit_count,
             (SELECT count(*)::int FROM tickets
              WHERE tenant_id = $1::uuid AND event_id = $2::uuid) AS ticket_count
           FROM events e
           WHERE e.tenant_id = $1::uuid AND e.id = $2::uuid`,
          [f.tenantId, f.eventId],
        );
        return row;
      };

      const assertConcurrencyUnchanged = (before, after, label) => {
        assert.deepEqual(
          after,
          before,
          `${label}: published pointer/revision/config-version/audit/ticket counts must be unchanged after 409`,
        );
      };

      // --- Baseline: seeded version 1 is live on the public projection ---
      const baselinePublic = await request(
        ctx,
        'GET',
        publicDetailPath(f.eventSlug),
        undefined,
      );
      expectStatus(baselinePublic, 200);
      assert.equal(baselinePublic.body.publishedConfigVersion, 1);
      assert.equal(
        baselinePublic.body.brand.organizationName,
        `Tenant ${caseId}`,
      );
      const stateBeforeAny = await businessState();

      // --- Draft (saved, never published) must not leak on the public path ---
      const draftPublic = await request(
        ctx,
        'GET',
        publicDetailPath('draft-only'),
        undefined,
      );
      expectStatus(draftPublic, 404);
      const listBeforePublish = await request(
        ctx,
        'GET',
        publicListPath,
        undefined,
      );
      expectStatus(listBeforePublish, 200);
      assert.equal(
        listBeforePublish.body.items.some((item) => item.slug === 'draft-only'),
        false,
        'DB-12: draft/unpublished event must not appear in the public catalog',
      );

      // --- Save + publish v2 through the real HTTP config-publish path ---
      const savedV2 = await request(
        ctx,
        'POST',
        `${configBase}/config-versions`,
        owner,
        {
          payload: {
            schemaVersion: 1,
            brand: {
              primaryColor: '#245B47',
              organizationName: 'DB-12 Org v2',
            },
            sections: [
              {
                kind: 'hero',
                id: 'hero',
                visible: true,
                order: 0,
                body: { title: 'E2E DB-12 v2', text: 'v2' },
              },
              {
                kind: 'info',
                id: 'info',
                visible: true,
                order: 1,
                body: { title: 'Info', text: 'v2' },
              },
              {
                kind: 'redeem',
                id: 'redeem',
                visible: true,
                order: 2,
                body: { title: 'Redeem', text: '' },
              },
              {
                kind: 'guide',
                id: 'guide',
                visible: false,
                order: 3,
                body: { title: 'Guide', text: '' },
              },
              {
                kind: 'faq',
                id: 'faq',
                visible: true,
                order: 4,
                body: { title: 'FAQ', items: [{ question: 'Q', answer: 'A' }] },
              },
              {
                kind: 'terms',
                id: 'terms',
                visible: true,
                order: 5,
                body: { title: 'Terms', termsVersion: 'terms-v1', text: 'v2' },
              },
            ],
            termsVersion: 'terms-v1',
          },
          expectedVersion: 1,
        },
      );
      expectStatus(savedV2, 201);
      assert.equal(savedV2.body.version, 2);
      const publishV2AuditBefore = await web04Query(
        f,
        f.tenantId,
        `SELECT id FROM audit_logs
         WHERE tenant_id = $1::uuid AND event_id = $2::uuid
           AND action = 'event.publish'
           AND (sanitized_diff->>'version')::int = 2`,
        [f.tenantId, f.eventId],
      );
      assert.equal(
        publishV2AuditBefore.length,
        0,
        'DB-12: no publish-v2 audit row must exist before HTTP publish of v2',
      );
      const published2 = await request(
        ctx,
        'POST',
        `${configBase}/publish`,
        owner,
        {
          expectedVersion: 2,
        },
      );
      expectStatus(published2, 201);
      assert.equal(published2.body.publishedConfigVersion, 2);
      const publishV2AuditAfter = await web04Query(
        f,
        f.tenantId,
        `SELECT id, sanitized_diff FROM audit_logs
         WHERE tenant_id = $1::uuid AND event_id = $2::uuid
           AND action = 'event.publish'
           AND (sanitized_diff->>'version')::int = 2`,
        [f.tenantId, f.eventId],
      );
      assert.equal(
        publishV2AuditAfter.length,
        1,
        'DB-12: HTTP publish v2 must append exactly one event.publish audit row for version 2',
      );
      // revision is a monotonic publish/rollback counter, not the config
      // version number; the generic seed's own publish of v1 already bumped
      // it from 1 to 2, so this second publish (of v2) bumps it to 3.
      assert.equal(published2.body.revision, 3);

      const publicAfterPublish = await request(
        ctx,
        'GET',
        publicDetailPath(f.eventSlug),
        undefined,
      );
      expectStatus(publicAfterPublish, 200);
      assert.equal(publicAfterPublish.body.publishedConfigVersion, 2);
      assert.equal(
        publicAfterPublish.body.brand.organizationName,
        'DB-12 Org v2',
      );

      // --- Stale rollback: one wrong token per request; assert exact error
      // code and no mutation to pointer/revision/config counts/audit/tickets ---
      const concurrencyBeforeStale = await publishConcurrencySnapshot();
      const staleRevisionRollback = await request(
        ctx,
        'POST',
        `${configBase}/config/rollback`,
        owner,
        { targetVersion: 1, expectedPublishedVersion: 2, expectedRevision: 1 },
        { 'idempotency-key': randomUUID() },
      );
      expectStatus(staleRevisionRollback, 409);
      assert.equal(
        staleRevisionRollback.body.code,
        'REVISION_CONFLICT',
        'DB-12: stale expectedRevision must surface REVISION_CONFLICT',
      );
      assertConcurrencyUnchanged(
        concurrencyBeforeStale,
        await publishConcurrencySnapshot(),
        'DB-12 stale expectedRevision rollback',
      );
      assert.deepEqual(
        await businessState(),
        stateBeforeAny,
        'DB-12: stale expectedRevision rollback must not mutate quota/codes',
      );

      const concurrencyBeforeStalePublished =
        await publishConcurrencySnapshot();
      const stalePublishedRollback = await request(
        ctx,
        'POST',
        `${configBase}/config/rollback`,
        owner,
        { targetVersion: 1, expectedPublishedVersion: 1, expectedRevision: 3 },
        { 'idempotency-key': randomUUID() },
      );
      expectStatus(stalePublishedRollback, 409);
      assert.equal(
        stalePublishedRollback.body.code,
        'CONFIG_VERSION_MISMATCH',
        'DB-12: stale expectedPublishedVersion must surface CONFIG_VERSION_MISMATCH',
      );
      assertConcurrencyUnchanged(
        concurrencyBeforeStalePublished,
        await publishConcurrencySnapshot(),
        'DB-12 stale expectedPublishedVersion rollback',
      );
      assert.deepEqual(
        await businessState(),
        stateBeforeAny,
        'DB-12: stale expectedPublishedVersion rollback must not mutate quota/codes',
      );

      const publicAfterStale = await request(
        ctx,
        'GET',
        publicDetailPath(f.eventSlug),
        undefined,
      );
      expectStatus(publicAfterStale, 200);
      assert.equal(
        publicAfterStale.body.publishedConfigVersion,
        2,
        'DB-12: rejected rollback must not advance the published version',
      );

      // --- Correct rollback: optimistic concurrency accepted, new version
      // minted from the target, business state untouched, audit written ---
      const rollback = await request(
        ctx,
        'POST',
        `${configBase}/config/rollback`,
        owner,
        { targetVersion: 1, expectedPublishedVersion: 2, expectedRevision: 3 },
        { 'idempotency-key': randomUUID() },
      );
      expectStatus(rollback, 201);
      assert.equal(rollback.body.newVersion, 3);
      assert.equal(rollback.body.publishedVersion, 3);
      assert.equal(rollback.body.sourceVersion, 1);
      assert.equal(rollback.body.revision, 4);

      const publicAfterRollback = await request(
        ctx,
        'GET',
        publicDetailPath(f.eventSlug),
        undefined,
      );
      expectStatus(publicAfterRollback, 200);
      assert.equal(publicAfterRollback.body.publishedConfigVersion, 3);
      assert.equal(
        publicAfterRollback.body.brand.organizationName,
        `Tenant ${caseId}`,
        'DB-12: rollback must restore the target version content, not replay v2',
      );
      assert.deepEqual(
        await businessState(),
        stateBeforeAny,
        'DB-12: successful rollback must not mutate quota/codes/tickets',
      );

      const rollbackAuditRows = await web04Query(
        f,
        f.tenantId,
        `SELECT action, sanitized_diff FROM audit_logs
         WHERE tenant_id = $1::uuid AND event_id = $2::uuid
           AND action = 'event.config.rollback'
         ORDER BY created_at`,
        [f.tenantId, f.eventId],
      );
      assert.ok(
        rollbackAuditRows.some(
          (r) =>
            r.sanitized_diff?.sourceVersion === 1 &&
            r.sanitized_diff?.newVersion === 3,
        ),
        'DB-12: successful rollback must append event.config.rollback audit with sourceVersion 1 and newVersion 3',
      );

      // --- Preview is an authenticated admin surface, not public ---
      const previewNoAuth = await request(
        ctx,
        'GET',
        `${configBase}/config-versions/1/preview`,
        undefined,
      );
      expectStatus(previewNoAuth, 401);
      const previewAuthed = await request(
        ctx,
        'GET',
        `${configBase}/config-versions/1/preview`,
        owner,
      );
      expectStatus(previewAuthed, 200);
      assert.equal(
        previewAuthed.body.payload.brand.organizationName,
        `Tenant ${caseId}`,
      );

      // --- Publish the previously-draft event, then confirm it (and only
      // it, not the rollback above) appears live on the public catalog ---
      const draftBase = `/tenants/${f.tenantId}/events/${draftEventId}`;
      const draftPublished = await request(
        ctx,
        'POST',
        `${draftBase}/publish`,
        owner,
        {
          expectedVersion: 1,
        },
      );
      expectStatus(draftPublished, 201);
      const draftNowPublic = await request(
        ctx,
        'GET',
        publicDetailPath('draft-only'),
        undefined,
      );
      expectStatus(draftNowPublic, 200);
      const listAfterPublish = await request(
        ctx,
        'GET',
        publicListPath,
        undefined,
      );
      expectStatus(listAfterPublish, 200);
      assert.deepEqual(
        listAfterPublish.body.items.map((item) => item.slug).sort(),
        [f.eventSlug, 'draft-only'].sort(),
      );
    }
    if (caseId === 'DB-14') {
      // PLAN §6.1 DB-14 H: form/terms version, structural allowlist on config
      // save, entitlement snapshot on issued ticket unchanged after brand/config
      // publish and ticket_type mutation; stale terms rejected on redeem.
      const requireBackend = createRequire(
        new URL('../../../packages/backend/package.json', import.meta.url),
      );
      const { hashFormDefinition, hashTermsContent } =
        requireBackend('./dist/index.js');
      const owner = await bearer(ctx, 'owner');
      const attendee = await bearer(ctx, 'attendee');
      const configBase = `/tenants/${f.tenantId}/events/${f.eventId}`;
      const entitlementV1 = {
        gateAccess: 'standard',
        tier: 'db14-v1',
        perks: ['lounge'],
      };
      // Published form/terms bodies must match tests/e2e/harness/seed.mjs defaultConfig
      // and the v2 save payload below (not DB readback alone).
      const publishedFormV1 = {
        formVersion: 'form-v1',
        fields: [
          { id: 'full_name', label: 'Họ tên', type: 'text', required: true },
          { id: 'email', label: 'Email', type: 'email', required: true },
          { id: 'phone', label: 'Điện thoại', type: 'phone', required: true },
          {
            id: 'shirt',
            label: 'Áo',
            type: 'select',
            required: true,
            options: [{ id: 'm', label: 'M' }],
          },
          { id: 'agree', label: 'Đồng ý', type: 'checkbox', required: true },
        ],
      };
      const publishedFormV2 = {
        formVersion: 'form-v2',
        fields: [
          { id: 'full_name', label: 'Name', type: 'text', required: true },
          { id: 'email', label: 'Email', type: 'email', required: true },
          { id: 'phone', label: 'Phone', type: 'phone', required: true },
          {
            id: 'shirt',
            label: 'Shirt',
            type: 'select',
            required: true,
            options: [{ id: 'm', label: 'M' }],
          },
          { id: 'agree', label: 'Agree', type: 'checkbox', required: true },
        ],
      };
      const expectedFormHashV1 = hashFormDefinition(publishedFormV1);
      const expectedTermsHashV1 = hashTermsContent({
        termsVersion: 'terms-v1',
        body: 'Synthetic test terms',
      });
      const expectedFormHashV2 = hashFormDefinition(publishedFormV2);
      const expectedTermsHashV2 = hashTermsContent({
        termsVersion: 'terms-v2',
        body: 'Synthetic v2',
      });
      assert.notEqual(expectedFormHashV2, expectedFormHashV1);
      assert.notEqual(expectedTermsHashV2, expectedTermsHashV1);

      const ticketRow = async (ticketId) => {
        const [row] = await web04Query(
          f,
          f.tenantId,
          `SELECT entitlement_snapshot::text AS entitlement,
                  form_version, terms_version,
                  form_definition_hash, terms_content_hash
           FROM tickets t
           INNER JOIN redemption_requests r
             ON r.tenant_id = t.tenant_id AND r.id = t.request_id
           WHERE t.tenant_id = $1::uuid AND t.id = $2::uuid`,
          [f.tenantId, ticketId],
        );
        return {
          entitlement: JSON.parse(row.entitlement),
          formVersion: row.form_version,
          termsVersion: row.terms_version,
          formDefinitionHash: row.form_definition_hash,
          termsContentHash: row.terms_content_hash,
        };
      };

      const issue1 = await request(
        ctx,
        'POST',
        redemptionPath(f),
        attendee,
        redemptionBody(f, caseId),
        { 'idempotency-key': randomUUID() },
      );
      expectStatus(issue1, 201);
      const ticketId = required(issue1.body.ticketId, 'DB-14 ticketId');
      const snap1 = await ticketRow(ticketId);
      assert.deepEqual(snap1.entitlement, entitlementV1);
      assert.equal(snap1.formVersion, 'form-v1');
      assert.equal(snap1.termsVersion, 'terms-v1');
      assert.equal(snap1.formDefinitionHash, expectedFormHashV1);
      assert.equal(snap1.termsContentHash, expectedTermsHashV1);

      const listedVersions = await request(
        ctx,
        'GET',
        `${configBase}/config-versions`,
        owner,
      );
      expectStatus(listedVersions, 200);
      const headVersion = Math.max(
        ...(listedVersions.body.items ?? []).map((row) => row.version),
      );

      const unsafeSave = await request(
        ctx,
        'POST',
        `${configBase}/config-versions`,
        owner,
        {
          payload: {
            schemaVersion: 1,
            brand: {
              primaryColor: '#164E63',
              organizationName: 'DB-14 Unsafe',
            },
            sections: [
              {
                kind: 'hero',
                id: 'hero',
                visible: true,
                order: 0,
                body: {
                  title: 'DB-14',
                  text: '<style>body{display:none}</style>',
                },
              },
              {
                kind: 'info',
                id: 'info',
                visible: true,
                order: 1,
                body: { title: 'Info', text: 'x' },
              },
              {
                kind: 'redeem',
                id: 'redeem',
                visible: true,
                order: 2,
                body: { title: 'Redeem', text: '' },
              },
              {
                kind: 'guide',
                id: 'guide',
                visible: false,
                order: 3,
                body: { title: 'Guide', text: '' },
              },
              {
                kind: 'faq',
                id: 'faq',
                visible: true,
                order: 4,
                body: { title: 'FAQ', items: [{ question: 'Q', answer: 'A' }] },
              },
              {
                kind: 'terms',
                id: 'terms',
                visible: true,
                order: 5,
                body: {
                  title: 'Terms',
                  termsVersion: 'terms-v1',
                  text: 'Synthetic',
                },
              },
            ],
            formDefinitionId: 'form-v1',
            termsVersion: 'terms-v1',
            form: {
              formVersion: 'form-v1',
              fields: [
                {
                  id: 'full_name',
                  label: 'Name',
                  type: 'text',
                  required: true,
                },
                { id: 'email', label: 'Email', type: 'email', required: true },
                { id: 'phone', label: 'Phone', type: 'phone', required: true },
                {
                  id: 'shirt',
                  label: 'Shirt',
                  type: 'select',
                  required: true,
                  options: [{ id: 'm', label: 'M' }],
                },
                {
                  id: 'agree',
                  label: 'Agree',
                  type: 'checkbox',
                  required: true,
                },
              ],
            },
          },
          expectedVersion: headVersion,
        },
      );
      assert.equal(unsafeSave.status, 422);
      assert.ok(
        ['CONFIG_UNSAFE_MARKUP', 'CONFIG_INCOMPATIBLE'].includes(
          unsafeSave.body.code,
        ),
        `unsafe config must fail closed (${unsafeSave.body.code})`,
      );

      const unknownKeySave = await request(
        ctx,
        'POST',
        `${configBase}/config-versions`,
        owner,
        {
          payload: {
            schemaVersion: 1,
            brand: {
              primaryColor: '#164E63',
              organizationName: 'DB-14 Org v2',
            },
            sections: [
              {
                kind: 'hero',
                id: 'hero',
                visible: true,
                order: 0,
                body: {
                  title: 'Rebrand',
                  text: 'Plain',
                  inlineHtml: '<img onerror=1>',
                },
              },
              {
                kind: 'info',
                id: 'info',
                visible: true,
                order: 1,
                body: { title: 'Info', text: 'x' },
              },
              {
                kind: 'redeem',
                id: 'redeem',
                visible: true,
                order: 2,
                body: { title: 'Redeem', text: '' },
              },
              {
                kind: 'guide',
                id: 'guide',
                visible: false,
                order: 3,
                body: { title: 'Guide', text: '' },
              },
              {
                kind: 'faq',
                id: 'faq',
                visible: true,
                order: 4,
                body: { title: 'FAQ', items: [{ question: 'Q', answer: 'A' }] },
              },
              {
                kind: 'terms',
                id: 'terms',
                visible: true,
                order: 5,
                body: {
                  title: 'Terms',
                  termsVersion: 'terms-v2',
                  text: 'Synthetic v2',
                },
              },
            ],
            formDefinitionId: 'form-v1',
            termsVersion: 'terms-v2',
            form: {
              formVersion: 'form-v2',
              fields: [
                {
                  id: 'full_name',
                  label: 'Name',
                  type: 'text',
                  required: true,
                },
                { id: 'email', label: 'Email', type: 'email', required: true },
                { id: 'phone', label: 'Phone', type: 'phone', required: true },
                {
                  id: 'shirt',
                  label: 'Shirt',
                  type: 'select',
                  required: true,
                  options: [{ id: 'm', label: 'M' }],
                },
                {
                  id: 'agree',
                  label: 'Agree',
                  type: 'checkbox',
                  required: true,
                },
              ],
            },
          },
          expectedVersion: headVersion,
        },
      );
      assert.equal(unknownKeySave.status, 422);
      assert.equal(unknownKeySave.body.code, 'CONFIG_INCOMPATIBLE');

      const savedV2 = await request(
        ctx,
        'POST',
        `${configBase}/config-versions`,
        owner,
        {
          payload: {
            schemaVersion: 1,
            brand: {
              primaryColor: '#245B47',
              organizationName: 'DB-14 Org v2',
            },
            sections: [
              {
                kind: 'hero',
                id: 'hero',
                visible: true,
                order: 0,
                body: { title: 'Rebrand', text: 'v2 copy' },
              },
              {
                kind: 'info',
                id: 'info',
                visible: true,
                order: 1,
                body: { title: 'Info', text: 'x' },
              },
              {
                kind: 'redeem',
                id: 'redeem',
                visible: true,
                order: 2,
                body: { title: 'Redeem', text: '' },
              },
              {
                kind: 'guide',
                id: 'guide',
                visible: false,
                order: 3,
                body: { title: 'Guide', text: '' },
              },
              {
                kind: 'faq',
                id: 'faq',
                visible: true,
                order: 4,
                body: { title: 'FAQ', items: [{ question: 'Q', answer: 'A' }] },
              },
              {
                kind: 'terms',
                id: 'terms',
                visible: true,
                order: 5,
                body: {
                  title: 'Terms',
                  termsVersion: 'terms-v2',
                  text: 'Synthetic v2',
                },
              },
            ],
            formDefinitionId: 'form-v1',
            termsVersion: 'terms-v2',
            form: {
              formVersion: 'form-v2',
              fields: [
                {
                  id: 'full_name',
                  label: 'Name',
                  type: 'text',
                  required: true,
                },
                { id: 'email', label: 'Email', type: 'email', required: true },
                { id: 'phone', label: 'Phone', type: 'phone', required: true },
                {
                  id: 'shirt',
                  label: 'Shirt',
                  type: 'select',
                  required: true,
                  options: [{ id: 'm', label: 'M' }],
                },
                {
                  id: 'agree',
                  label: 'Agree',
                  type: 'checkbox',
                  required: true,
                },
              ],
            },
          },
          expectedVersion: headVersion,
        },
      );
      expectStatus(savedV2, 201);

      const publishedV2 = await request(
        ctx,
        'POST',
        `${configBase}/publish`,
        owner,
        {
          expectedVersion: savedV2.body.version,
        },
      );
      expectStatus(publishedV2, 201);

      const publicAfter = await fetchPublicEventDetail(
        ctx,
        f.tenantSlug,
        f.eventSlug,
      );
      expectStatus(publicAfter, 200);
      assert.equal(publicAfter.body.brand.organizationName, 'DB-14 Org v2');
      assert.equal(publicAfter.body.terms?.version, 'terms-v2');

      const snap2 = await ticketRow(ticketId);
      assert.deepEqual(snap2.entitlement, entitlementV1);
      assert.equal(snap2.formVersion, 'form-v1');
      assert.equal(snap2.termsVersion, 'terms-v1');
      assert.equal(snap2.formDefinitionHash, expectedFormHashV1);
      assert.equal(snap2.termsContentHash, expectedTermsHashV1);

      const staleRedeem = await request(
        ctx,
        'POST',
        redemptionPath(f),
        attendee,
        {
          code: required(f.secondCode, 'DB-14 secondCode'),
          formVersion: 'form-v2',
          termsVersion: 'terms-v1',
          answers: required(f.data?.answers, 'DB-14 answers'),
          termsAccepted: true,
        },
        { 'idempotency-key': randomUUID() },
      );
      assert.equal(staleRedeem.status, 409);
      assert.equal(staleRedeem.body.code, 'TERMS_VERSION_STALE');

      const answersV2 = required(f.data?.answers, 'DB-14 answers');
      const issue2 = await request(
        ctx,
        'POST',
        redemptionPath(f),
        attendee,
        {
          code: required(f.secondCode, 'DB-14 secondCode'),
          formVersion: 'form-v2',
          termsVersion: 'terms-v2',
          answers: answersV2,
          termsAccepted: true,
        },
        { 'idempotency-key': randomUUID() },
      );
      expectStatus(issue2, 201);
      const snap3 = await ticketRow(
        required(issue2.body.ticketId, 'DB-14 ticket2'),
      );
      assert.deepEqual(snap3.entitlement, entitlementV1);
      assert.equal(snap3.formVersion, 'form-v2');
      assert.equal(snap3.termsVersion, 'terms-v2');
      assert.equal(snap3.formDefinitionHash, expectedFormHashV2);
      assert.equal(snap3.termsContentHash, expectedTermsHashV2);

      const snap1AfterV2 = await ticketRow(ticketId);
      assert.deepEqual(snap1AfterV2.entitlement, entitlementV1);
      assert.equal(snap1AfterV2.formVersion, 'form-v1');
      assert.equal(snap1AfterV2.termsVersion, 'terms-v1');
      assert.equal(snap1AfterV2.formDefinitionHash, expectedFormHashV1);
      assert.equal(snap1AfterV2.termsContentHash, expectedTermsHashV1);
    }
  });
}
