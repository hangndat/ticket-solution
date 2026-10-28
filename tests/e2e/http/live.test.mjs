import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const CASE_IDS = [
  'SEC-01',
  'SEC-02',
  'SEC-03',
  'SEC-04',
  'SEC-05',
  'AUTH-03',
  'GATE-01',
  'GATE-03',
  'DB-03',
];
const EVIL_HOST = 'evil.example';
const EVIL_ORIGIN = 'https://evil.example';
const OAUTH_COOKIE = /oidc|oauth|pkce|nonce|state/i;
const PORTAL_CSRF_COOKIE = 'portal_csrf';
const PORTAL_CSRF_HEADER = 'x-portal-csrf';
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

const FORGED_FORWARDED = {
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
  assert.ok(!/https?:\/\/[^/]*evil/i.test(location), `external redirect: ${location}`);
  assert.ok(!location.includes('return=https'), 'unsafe return query in Location');
  assert.ok(!location.includes('next=https'), 'unsafe next query in Location');
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
  const line = csv
    .split('\n')
    .find((row) => row.includes(maskedEmail));
  assert.ok(line, 'export must include masked formula-like email');
  const cell = line.split(',').pop()?.trim() ?? '';
  assert.ok(
    cell.startsWith("'") || cell.startsWith('"\''),
    `formula guard must prefix ownerEmailMasked cell, got ${cell}`,
  );
  assert.ok(!cell.startsWith('='), 'CSV cell must not start with raw formula char');
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
      assertLocationOrigin(refreshOpen.location, ctx.web, 'SSR refresh fail-closed');
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
      assertLocationOrigin(adminMigrate.location, ctx.portal, 'legacy admin GET');
      assertNoOpenRedirectVector(adminMigrate.location);

      const adminHead = await navigationFetch(
        ctx.web,
        `/admin?tenantId=${tenantId}`,
        { method: 'HEAD', headers: forged },
      );
      assertRedirectStatus(adminHead);
      assertLocationOrigin(adminHead.location, ctx.portal, 'legacy admin HEAD');
      assertNoOpenRedirectVector(adminHead.location);

      const adminPost = await navigationFetch(ctx.web, '/admin', {
        method: 'POST',
        headers: { ...forged, 'content-type': 'application/x-www-form-urlencoded' },
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
      assert.equal(apiHealth.status, 200, 'API health must not redirect on forged host');
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
      assertLocationOrigin(directLogin.location, ctx.auth, 'direct OIDC login start');
      assertNoOpenRedirectVector(directLogin.location);

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

      const marketingAuth = await navigationFetch(
        ctx.marketing,
        '/auth?return=https://evil.example&next=//evil',
        { headers: forged },
      );
      assertRedirectStatus(marketingAuth);
      assertLocationOrigin(marketingAuth.location, ctx.web, 'marketing /auth bounce');
      assert.notEqual(
        new URL(marketingAuth.location, ctx.web).hostname,
        EVIL_HOST,
        'marketing bounce must not redirect to forged forwarded host',
      );

      const marketingAdmin = await navigationFetch(
        ctx.marketing,
        `/admin?return=https://evil&tenantId=${tenantId}`,
        { headers: forged },
      );
      assertRedirectStatus(marketingAdmin);
      assertLocationOrigin(marketingAdmin.location, ctx.web, 'marketing /admin bounce');
      assert.notEqual(
        new URL(marketingAdmin.location, ctx.web).hostname,
        EVIL_HOST,
        'marketing admin bounce must not leave marketing with forged host',
      );

      const portalLogin = await navigationFetch(
        ctx.portal,
        '/api/auth/login?return=https://evil.example/admin',
        { headers: forged },
      );
      assertRedirectStatus(portalLogin);
      assertLocationOrigin(portalLogin.location, ctx.auth, 'portal staff OIDC login');
      assertNoOpenRedirectVector(portalLogin.location);

      const portalPlatform = await navigationFetch(
        ctx.portal,
        '/api/auth/platform/login',
        { headers: forged },
      );
      assertRedirectStatus(portalPlatform);
      assertLocationOrigin(portalPlatform.location, ctx.auth, 'portal platform OIDC login');
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

      const directAdmin = await directUpstreamFetch(
        webPort,
        webHost,
        `/admin?return=https://evil&next=//evil&tenantId=${tenantId}`,
        { headers: forged },
      );
      assertRedirectStatus(directAdmin);
      assertLocationOrigin(directAdmin.location, ctx.portal, 'direct legacy admin GET');
      assertNoOpenRedirectVector(directAdmin.location);

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
      const reportAfterBadToken = await request(ctx, 'GET', reportPath(f), owner);
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
        await request(
          ctx,
          'POST',
          gatePath(f, 'reservations'),
          scanner,
          {
            tenantId: f.tenantId,
            staffSessionId: session.body.sessionId,
            ticketId: randomUUID(),
          },
        ),
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
      const quotaAfterRedeem = (
        await request(ctx, 'GET', reportPath(f), owner)
      ).body.quota.allocated;
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
      assert.ok(!csv.includes('=formula-'), 'export must not leak raw formula email');

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
      const overflowFileId = required(rowOverflow.body.fileId, 'overflow fileId');
      const overflowHash = required(rowOverflow.body.fileHash, 'overflow fileHash');
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
              items: [{ question: 'Khi nào?', answer: 'Trong thời gian sự kiện.' }],
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
    if (caseId === 'AUTH-03') {
      const path = redemptionPath(f);
      const body = redemptionBody(f, caseId);
      const owner = await bearer(ctx, 'owner');
      const before = await request(ctx, 'GET', reportPath(f), owner);
      expectStatus(before, 200);
      const key = randomUUID();
      expectStatus(
        await request(ctx, 'POST', path, null, body, {
          'idempotency-key': key,
        }),
        401,
      );
      const unverified = await bearer(ctx, 'unverified');
      expectStatus(
        await request(ctx, 'POST', path, unverified, body, {
          'idempotency-key': key,
        }),
        403,
        'EMAIL_NOT_VERIFIED',
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
    }
  });
}
