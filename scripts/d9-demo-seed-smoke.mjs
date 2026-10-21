#!/usr/bin/env node
/**
 * D9 demo seed API smoke — login / me / me/tenants / redeem / me/tickets.
 * Fixture only. Boots throwaway DB by default (D9_SMOKE_BOOTSTRAP=0 to skip).
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrapD9DemoDatabase } from './lib/d9-demo-bootstrap-db.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const KC = process.env.OIDC_ISSUER
  ? process.env.OIDC_ISSUER.replace(/\/$/, '')
  : null;

function log(step, detail) {
  console.log(`[d9-smoke] ${step}${detail ? ` ${detail}` : ''}`);
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

async function discoverIssuer() {
  if (KC) return KC;
  const bases = [
    'http://127.0.0.1:8080',
    'http://192.168.86.8:8080',
  ];
  for (const base of bases) {
    try {
      const res = await fetch(
        `${base}/realms/ticket/.well-known/openid-configuration`,
      );
      if (!res.ok) continue;
      const json = await res.json();
      if (json.issuer) return json.issuer.replace(/\/$/, '');
    } catch {
      /* try next */
    }
  }
  throw new Error('Keycloak discovery failed — start compose keycloak');
}

async function passwordToken(issuer, username, password) {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: 'ticket-web',
    client_secret: 'dev-web-secret-change-me',
    username,
    password,
  });
  const res = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(
      `token ${username}: ${res.status} ${JSON.stringify(json).slice(0, 200)}`,
    );
  }
  return json.access_token;
}

function decodeSub(token) {
  const payload = JSON.parse(
    Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
  );
  return { sub: payload.sub, iss: payload.iss, email: payload.email };
}

async function waitHealth(base, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${base}/v1/health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('API health timeout');
}

async function api(base, token, method, urlPath, body) {
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body
        ? {
            'content-type': 'application/json',
            'idempotency-key': body.idempotencyKey || cryptoRandom(),
          }
        : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

function cryptoRandom() {
  return globalThis.crypto.randomUUID();
}

function runSeed(env) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['packages/backend/scripts/demo-seed.cjs'], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => {
      out += d;
    });
    child.stderr.on('data', (d) => {
      err += d;
    });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`seed exit ${code}: ${err || out}`));
        return;
      }
      resolve(JSON.parse(out));
    });
  });
}

async function main() {
  const pepper =
    process.env.CODE_HMAC_PEPPER || 'local-dev-code-pepper-change-me';
  const credKey =
    process.env.TICKET_CREDENTIAL_KEY || 'local-dev-credential-key';
  const bootstrap = process.env.D9_SMOKE_BOOTSTRAP !== '0';

  log('discover', 'Keycloak issuer');
  const issuer = await discoverIssuer();
  log('issuer', issuer);

  log('token', 'attendee + staff (fixture passwords)');
  const attendeeToken = await passwordToken(
    issuer,
    'attendee@example.com',
    'attendee-demo',
  );
  const staffToken = await passwordToken(
    issuer,
    'staff@example.com',
    'staff-demo',
  );
  const attendeeClaims = decodeSub(attendeeToken);
  const staffClaims = decodeSub(staffToken);
  log(
    'subjects',
    `staff=${staffClaims.sub.slice(0, 8)}… attendee=${attendeeClaims.sub.slice(0, 8)}…`,
  );

  let adminUrl = process.env.DATABASE_URL;
  let runtimeUrl = process.env.D9_RUNTIME_DATABASE_URL || process.env.DATABASE_URL;
  let boot;
  if (bootstrap) {
    log('bootstrap', 'ticket_d9_demo + migrations + runtime role');
    boot = await bootstrapD9DemoDatabase();
    adminUrl = boot.adminUrl;
    runtimeUrl = boot.runtimeUrl;
    log('db', boot.dbName);
  }
  if (!adminUrl || !runtimeUrl) {
    throw new Error('DATABASE_URL required when D9_SMOKE_BOOTSTRAP=0');
  }

  // Build backend once
  log('build', '@ticket/backend + @ticket/api');
  await new Promise((resolve, reject) => {
    const child = spawn(
      'pnpm',
      ['--filter', '@ticket/api...', 'build'],
      { cwd: ROOT, stdio: 'inherit', env: process.env },
    );
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`build exit ${code}`)),
    );
  });

  const seedEnv = {
    DATABASE_URL: adminUrl,
    CODE_HMAC_PEPPER: pepper,
    CODE_HMAC_VERSION: '1',
    OIDC_ISSUER: issuer,
    D9_DEMO_STAFF_SUBJECT: staffClaims.sub,
    D9_DEMO_ATTENDEE_SUBJECT: attendeeClaims.sub,
  };

  log('seed', 'first run');
  const first = await runSeed(seedEnv);
  log('seed', 'second run (idempotent)');
  const second = await runSeed(seedEnv);

  if (second.codesInserted !== 0) {
    throw new Error(
      `expected codesInserted=0 on second run, got ${second.codesInserted}`,
    );
  }
  if (second.tenants.some((t) => t.created)) {
    throw new Error('expected tenants.created=false on second run');
  }

  const port = await freePort();
  const jwksUrl = `${issuer}/protocol/openid-connect/certs`;
  const apiEnv = {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    NODE_ENV: 'development',
    DATABASE_URL: runtimeUrl,
    OIDC_PROVIDER: 'keycloak',
    OIDC_ISSUER: issuer,
    OIDC_AUDIENCE: 'ticket-api',
    OIDC_JWKS_URL: jwksUrl,
    CODE_HMAC_PEPPER: pepper,
    CODE_HMAC_VERSION: '1',
    TICKET_CREDENTIAL_KEY: credKey,
    EMAIL_ALLOW_NOOP: '1',
  };

  log('api', `listen 127.0.0.1:${port}`);
  const apiProc = spawn('node', ['apps/api/dist/main.js'], {
    cwd: ROOT,
    env: apiEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let apiErr = '';
  apiProc.stderr.on('data', (d) => {
    apiErr += d.toString();
  });
  apiProc.stdout.on('data', () => {});

  const base = `http://127.0.0.1:${port}`;
  const results = [];
  try {
    await waitHealth(base);

    const health = await fetch(`${base}/v1/health`);
    results.push({ check: 'health', status: health.status, pass: health.status === 200 });

    const publicCatalog = await fetch(`${base}/v1/public/events?limit=10`);
    let publicCatalogJson = {};
    try {
      publicCatalogJson = await publicCatalog.json();
    } catch {
      /* ignore */
    }
    const catalogSlugs = (publicCatalogJson.items || []).map((row) => row.slug);
    results.push({
      check: 'public_events_catalog',
      status: publicCatalog.status,
      pass:
        publicCatalog.status === 200 &&
        catalogSlugs.includes('mfest') &&
        catalogSlugs.includes('studio-night'),
      slugs: catalogSlugs,
    });

    const publicDetail = await fetch(
      `${base}/v1/public/tenants/mfest-demo/events/mfest`,
    );
    let publicDetailJson = {};
    try {
      publicDetailJson = await publicDetail.json();
    } catch {
      /* ignore */
    }
    const publishedTermsVersion = publicDetailJson.terms?.version ?? null;
    results.push({
      check: 'public_event_detail',
      status: publicDetail.status,
      pass:
        publicDetail.status === 200 &&
        publicDetailJson.slug === 'mfest' &&
        publicDetailJson.tenantSlug === 'mfest-demo' &&
        publishedTermsVersion === 'terms-v1',
      termsVersion: publishedTermsVersion,
    });

    const me = await api(base, attendeeToken, 'GET', '/v1/me');
    results.push({
      check: 'me_attendee',
      status: me.status,
      pass: me.status === 200 && me.json.emailVerified === true,
      email: me.json.email,
    });

    const staffMe = await api(base, staffToken, 'GET', '/v1/me');
    results.push({
      check: 'me_staff',
      status: staffMe.status,
      pass: staffMe.status === 200,
    });

    const tenants = await api(base, staffToken, 'GET', '/v1/me/tenants');
    const items = tenants.json.items || [];
    const slugs = items.map((t) => t.slug).sort();
    const adminTenantPerms = [
      'event.create',
      'event.list',
      'members.manage',
      'tenant.profile',
    ];
    const staffHasAdminTenantPerms = items.some((t) =>
      adminTenantPerms.every((p) =>
        (t.tenantPermissions || []).includes(p),
      ),
    );
    results.push({
      check: 'me_tenants_staff',
      status: tenants.status,
      pass:
        tenants.status === 200 &&
        slugs.includes('mfest-demo') &&
        slugs.includes('demo-studio') &&
        staffHasAdminTenantPerms,
      slugs,
      staffHasAdminTenantPerms,
    });

    const staffEvents = await api(base, staffToken, 'GET', '/v1/me/events');
    results.push({
      check: 'me_events_staff',
      status: staffEvents.status,
      pass:
        staffEvents.status === 200 &&
        staffEvents.json.staffEligible === true &&
        (staffEvents.json.items || []).some((e) =>
          (e.permissions || []).includes('gate.confirm'),
        ),
      staffEligible: staffEvents.json.staffEligible,
    });

    const tenantId = first.tenants.find((t) => t.slug === 'mfest-demo').id;
    const eventId = first.events.find((e) => e.slug === 'mfest').id;
    if (!publishedTermsVersion) {
      throw new Error(
        'public event detail missing published terms — cannot redeem with consent',
      );
    }
    const redeem = await api(
      base,
      attendeeToken,
      'POST',
      `/v1/tenants/${tenantId}/events/${eventId}/redemptions`,
      {
        code: 'DEMO-MFEST-001',
        idempotencyKey: cryptoRandom(),
        termsVersion: publishedTermsVersion,
        termsAccepted: true,
      },
    );
    const redeemErrorCode = redeem.json?.error?.code ?? redeem.json?.code ?? null;
    results.push({
      check: 'redeem_attendee',
      status: redeem.status,
      pass:
        (redeem.status === 200 || redeem.status === 201) &&
        redeemErrorCode !== 'TERMS_REQUIRED',
      code: redeem.json.code || redeem.json.ticketId || null,
      errorCode: redeemErrorCode,
    });

    const tickets = await api(
      base,
      attendeeToken,
      'GET',
      `/v1/me/tickets?tenantId=${tenantId}`,
    );
    const ticketItems = tickets.json.tickets || [];
    results.push({
      check: 'me_tickets_attendee',
      status: tickets.status,
      pass: tickets.status === 200 && ticketItems.length >= 1,
      count: ticketItems.length,
    });
  } finally {
    apiProc.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 300));
    try {
      apiProc.kill('SIGKILL');
    } catch {
      /* ignore */
    }
  }

  const failed = results.filter((r) => !r.pass);
  const summary = {
    ok: failed.length === 0,
    fixture: true,
    issuer,
    db: boot?.dbName || 'external',
    seedFirst: {
      codesInserted: first.codesInserted,
      tenants: first.tenants.map((t) => t.slug),
    },
    seedSecond: {
      codesInserted: second.codesInserted,
      codesSkipped: second.codesSkipped,
    },
    results,
    apiStderrTail: apiErr.slice(-400) || undefined,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) {
    console.error('D9_DEMO_SEED_SMOKE_FAIL');
    process.exit(1);
  }
  console.log('D9_DEMO_SEED_SMOKE_PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
