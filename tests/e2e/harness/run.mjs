#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import { resolve, dirname } from 'node:path';
import {
  createRuntime,
  destroyRuntime,
  privateJson,
  processEnvironment,
  startProcess,
  waitFor,
  getLocalJson,
  ROOT,
  E2E,
} from './runtime.mjs';
import {
  acquireFrontend,
  acquireLane,
  buildKey,
  clearBuildMarker,
  readBuildMarker,
  releaseFrontend,
  releaseLane,
  writeBuildMarker,
} from './lane.mjs';
import { validateManifest } from '../validation/validate.mjs';
import { assertSourceProvenanceStable } from './source-provenance.mjs';
import { finalizeRun } from './finalize-run.mjs';

const requireRoot = createRequire(resolve(ROOT, 'package.json'));
const requireBackend = createRequire(
  resolve(ROOT, 'packages/backend/package.json'),
);
const args = process.argv.slice(2);
const mode = args.shift() || 'smoke';
const skipBuild = args.includes('--skip-build');
const laneArg = args.find(
  (arg) => arg === '--lane' || arg.startsWith('--lane='),
);
const useLane = Boolean(laneArg);
const laneRequested =
  laneArg && laneArg.includes('=')
    ? Number(laneArg.slice('--lane='.length))
    : null;
if (laneArg && laneArg.includes('=') && !Number.isInteger(laneRequested)) {
  console.error('--lane=<số lane> phải là số nguyên');
  process.exit(2);
}
const forceRebuild = args.includes('--rebuild');
const laneRunToken = `pid-${process.pid}`;
const publicReadDiagnostic = args.includes('--public-read-diagnostic');
if (
  publicReadDiagnostic &&
  (mode !== 'e2e' ||
    !args.includes(
      '--case=WEB-01,WEB-02,WEB-03,WEB-04,WEB-05,WEB-06,WEB-07,WEB-08,WEB-09,WEB-10,WEB-11,WEB-12,WEB-13',
    ))
) {
  throw new Error(
    'Public-read diagnostic requires e2e and the exact WEB-01–13 case list',
  );
}
const smoke = [
  'AUTH-01',
  'AUTH-03',
  'WEB-02',
  'WEB-04',
  'WEB-07',
  'WEB-08',
  'PORT-01',
  'PORT-05',
  'SEC-01',
  'SEC-02',
];
const httpCases = [
  'SEC-01',
  'SEC-02',
  'SEC-03',
  'SEC-04',
  'SEC-05',
  'SEC-06',
  'AUTH-03',
  'AUTH-06',
  'GATE-01',
  'GATE-02',
  'GATE-03',
  'GATE-04',
  'GATE-05',
  'GATE-06',
  'GATE-07',
  'GATE-08',
  'GATE-09',
  'DB-01',
  'DB-02',
  'DB-03',
  'DB-04',
  'DB-07',
  'DB-10',
  'DB-11',
  'DB-12',
  'DB-13',
  'DB-14',
  'DB-15',
  'DB-16',
  'DB-17',
  'DB-18',
  'JOB-04',
  'JOB-07',
  'PLAT-03',
  'WEB-04',
  'WEB-05',
];
const match = args.find((arg) => arg.startsWith('--case='));
const grepTitleMatch = args.find((arg) => arg.startsWith('--grep-title='));
const grepTitle = grepTitleMatch
  ? grepTitleMatch.slice('--grep-title='.length).trim()
  : '';
const allBrowserCases = [
  ...Array.from(
    { length: 8 },
    (_, i) => `AUTH-${String(i + 1).padStart(2, '0')}`,
  ),
  ...Array.from(
    { length: 13 },
    (_, i) => `WEB-${String(i + 1).padStart(2, '0')}`,
  ),
  ...Array.from(
    { length: 14 },
    (_, i) => `PORT-${String(i + 1).padStart(2, '0')}`,
  ),
  ...Array.from(
    { length: 5 },
    (_, i) => `PLAT-${String(i + 1).padStart(2, '0')}`,
  ),
  'SEC-01',
  'SEC-02',
];
const caseIds = match
  ? match.slice(7).split(',')
  : mode === 'http'
    ? httpCases
    : mode === 'smoke'
      ? smoke
      : allBrowserCases;
if (caseIds.includes('DB-19') && (mode !== 'http' || caseIds.length !== 1)) {
  throw new Error('DB-19 rotation fixture requires isolated HTTP run: --case=DB-19');
}
// Khớp điều kiện `httpNeedsFrontend` bên dưới: HTTP thuần không đụng `.next`.
const laneNeedsFrontend =
  mode !== 'http' ||
  caseIds.some((id) =>
    ['AUTH-03', 'SEC-02', 'SEC-03', 'SEC-05', 'DB-17', 'PLAT-03'].includes(id),
  );
if (
  !['smoke', 'e2e', 'http', 'regression', 'list'].includes(mode) ||
  caseIds.some((id) => !/^(AUTH|WEB|PORT|PLAT|SEC|DB|GATE|JOB)-\d{2}$/.test(id))
) {
  console.error(
    'Usage: node tests/e2e/harness/run.mjs smoke|e2e|http|regression|list [--lane[=N]] [--rebuild] [--skip-build] [--case=WEB-02,PORT-07]',
  );
  process.exit(2);
}

async function exitCode(child) {
  if (child.exitCode !== null) return child.exitCode;
  return new Promise((done, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => done(code ?? 1));
  });
}

async function publicReadSnapshot(state, salt) {
  const ownedProject = state.lane
    ? state.project === `e2e-${state.lane.name}`
    : state.project === `e2e-${state.id}`;
  if (!ownedProject || !Number.isInteger(state.ports.pg)) {
    throw new Error('BLOCKED: diagnostic requires the owned local database');
  }
  const requireApi = createRequire(resolve(ROOT, 'apps/api/package.json'));
  const { Client } = requireApi('pg');
  const client = new Client({
    host: '127.0.0.1',
    port: state.ports.pg,
    database: state.databaseName || 'e2e',
    user: 'postgres',
    password: state.secrets.pg,
  });
  await client.connect();
  try {
    const { rows } = await client.query(
      'SELECT tenant_id, window_started_at, count FROM notification_rate_counters WHERE bucket_key = $1 ORDER BY window_started_at, tenant_id',
      ['api.public.read'],
    );
    return rows.map((row) => ({
      scopeHash: createHash('sha256')
        .update(salt)
        .update(row.tenant_id)
        .digest('hex')
        .slice(0, 16),
      windowStartedAt: row.window_started_at.toISOString(),
      count: row.count,
    }));
  } finally {
    await client.end();
  }
}

async function exitAtFirst429(child, stopFile) {
  let timer;
  const first429 = new Promise((done) => {
    timer = setInterval(() => {
      if (existsSync(stopFile)) done(true);
    }, 100);
  });
  const exit = exitCode(child);
  const finished = exit.then(() => false);
  try {
    const stopped = await Promise.race([first429, finished]);
    if (stopped && child.exitCode === null) process.kill(-child.pid, 'SIGTERM');
    await exit;
    return stopped;
  } finally {
    clearInterval(timer);
  }
}

async function localPage(state, origin) {
  // Root page isn't JSON; use a child with the same trusted per-process resolver.
  const env = processEnvironment(state);
  const child = startProcess(
    state,
    'readiness',
    process.execPath,
    [
      '--input-type=module',
      '-e',
      'const r=await fetch(process.argv[1]);process.exit(r.status<500?0:1)',
      origin,
    ],
    env,
  );
  return (await exitCode(child)) === 0;
}

function browserArgs(ids, list = false) {
  const cli = resolve(
    dirname(requireRoot.resolve('playwright/package.json')),
    'cli.js',
  );
  let grepPattern = `\\[(${ids.filter((id) => id !== 'SEC-01').join('|')})\\]`;
  if (grepTitle) {
    grepPattern += `.*${grepTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
  }
  return [
    cli,
    'test',
    '--config',
    resolve(E2E, 'playwright.config.ts'),
    '--grep',
    grepPattern,
    ...(list ? ['--list'] : []),
  ];
}

if (mode === 'list' || args.includes('--list')) {
  const child = spawn(process.execPath, browserArgs(caseIds, true), {
    cwd: ROOT,
    stdio: 'inherit',
  });
  process.exitCode = await exitCode(child);
} else {
  let state;
  let diagnostic;
  let cleaning;
  let laneHeld = null;
  let frontendHeld = null;
  let summary;
  // Lock chỉ được nhả sau khi tài nguyên của run đã bị xoá.
  const cleanup = () =>
    (cleaning ||= (async () => {
      const failures = [];
      try {
        if (state?.cleanupAttempted) {
          if (state.cleanupError) failures.push(state.cleanupError);
        } else if (state) await destroyRuntime(state);
      } catch {
        failures.push('runtime cleanup failed; see private cleanup logs');
      } finally {
        try { if (frontendHeld) releaseFrontend(frontendHeld); } catch { failures.push('frontend lock release failed'); }
        try { if (laneHeld) releaseLane(laneHeld); } catch { failures.push('lane lock release failed'); }
      }
      return failures.length ? failures.join('; ') : null;
    })());
  const interrupt = async () => {
    process.exitCode = 130;
    await cleanup();
    process.exit(130);
  };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    if (useLane) {
      laneHeld = await acquireLane({
        lane: laneRequested ?? undefined,
        runId: laneRunToken,
        onWait: (names) =>
          console.log(`E2E: chờ lane rảnh (${names.join(', ')})`),
      });
      console.log(`E2E: lane ${laneHeld.name} đã khoá cho run này`);
      // `.next` chỉ có một bản mỗi checkout: run cần frontend phải độc quyền nó.
      if (laneNeedsFrontend) {
        frontendHeld = await acquireFrontend({
          runId: laneRunToken,
          onWait: () =>
            console.log('E2E: chờ run khác trong checkout nhả .next'),
        });
      }
    }
    state = await createRuntime(caseIds, { lane: laneHeld });
    // Build chỉ dùng lại được khi source và origin không đổi; origin bị
    // nướng vào trang prerender nên nằm trong key.
    const laneBuildKey = laneHeld
      ? buildKey(state.sourceProvenance, laneHeld)
      : null;
    const reuseLaneBuild =
      Boolean(laneBuildKey) &&
      !forceRebuild &&
      readBuildMarker()?.key === laneBuildKey;
    if (reuseLaneBuild)
      console.log(`E2E: dùng lại build của lane ${laneHeld.name}`);
    const needsBuild = !skipBuild && !reuseLaneBuild;
    if (needsBuild) {
      console.log('E2E: build shared packages/API/worker');
      const core = startProcess(
        state,
        'core-build',
        'pnpm',
        [
          'exec',
          'turbo',
          'run',
          'build',
          '--filter=@ticket/api...',
          '--filter=@ticket/worker...',
          '--filter=@ticket/ui...',
          '--filter=@ticket/web-session...',
        ],
        processEnvironment(state),
      );
      if (await exitCode(core))
        throw new Error('BLOCKED: core build thất bại; xem core-build.log');
    }
    let gateCredentialPrivateKeyPem;
    // API startup and issuance require signing config for every case, not only
    // the Gate-specific assertions below.
    {
      const { privateKey, publicKey } = generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
      });
      const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
      gateCredentialPrivateKeyPem = privateKeyPem;
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
      const backend = requireBackend('./dist/index.js');
      const sealed = backend.sealCredentialToken(
        privateKeyPem,
        backend.deriveGateSigningSealKey(state.secrets.credential),
      );
      state.secrets.gateCredentialCurrentKeyId = 'e2e';
      state.secrets.gateCredentialSigningKeySealed = sealed.encryptedToken;
      state.secrets.gateCredentialVerifyKeysJson = JSON.stringify([
        { kid: 'e2e', alg: 'ES256', publicKeyPem },
      ]);
      state.secrets.gateManualCodePepper = randomBytes(32).toString('hex');
      state.secrets.gateCredentialAlgProofKey =
        randomBytes(32).toString('base64url');
    }
    const { children, proxy, minio, ...seedState } = state;
    seedState.caseIds = caseIds;
    const seedPath = resolve(state.dir, 'seed-state.json');
    privateJson(seedPath, seedState);
    const seed = startProcess(
      state,
      'seed',
      process.execPath,
      [resolve(E2E, 'harness/seed-entry.mjs'), seedPath],
      processEnvironment(state),
    );
    if (await exitCode(seed))
      throw new Error('BLOCKED: fixture seed thất bại; xem seed.log');
    Object.assign(
      state,
      JSON.parse(readFileSync(resolve(state.dir, 'seed-result.json'), 'utf8')),
    );
    const rawManifest = JSON.parse(readFileSync(state.manifestPath, 'utf8'));
    if (caseIds.includes('GATE-03')) {
      const { SignJWT, importPKCS8 } = await import(
        requireBackend.resolve('jose')
      );
      const privateKey = await importPKCS8(
        gateCredentialPrivateKeyPem,
        'ES256',
      );
      const gate = rawManifest.cases['GATE-03'];
      gate.data ??= {};
      const ticketClaims = {
        tid: gate.tenantId,
        eid: gate.eventId,
        tkt: gate.ticketId,
        ver: 1,
        jti: randomBytes(16).toString('hex'),
      };
      const signGateCredential = (
        claims,
        kid = state.secrets.gateCredentialCurrentKeyId,
      ) =>
        new SignJWT(claims)
          .setProtectedHeader({ alg: 'ES256', kid, typ: 'JWT' })
          .setIssuer('vemoki-gate')
          .setAudience('gate')
          .setIssuedAt()
          .sign(privateKey);
      gate.data.unknownKidJws = await signGateCredential(
        ticketClaims,
        'unknown-e2e-key',
      );
      gate.data.unknownKidMissingTicketJws = await signGateCredential(
        {
          ...ticketClaims,
          tkt: randomUUID(),
          jti: randomBytes(16).toString('hex'),
        },
        'unknown-e2e-key',
      );
      const algProofKey = Buffer.from(
        state.secrets.gateCredentialAlgProofKey,
        'base64url',
      );
      gate.data.wrongAlgJws = await new SignJWT(ticketClaims)
        .setProtectedHeader({
          alg: 'HS256',
          kid: state.secrets.gateCredentialCurrentKeyId,
          typ: 'JWT',
        })
        .setIssuer('vemoki-gate')
        .setAudience('gate')
        .setIssuedAt()
        .sign(algProofKey);
      gate.data.wrongAudienceJws = await new SignJWT(ticketClaims)
        .setProtectedHeader({
          alg: 'ES256',
          kid: state.secrets.gateCredentialCurrentKeyId,
          typ: 'JWT',
        })
        .setIssuer('vemoki-gate')
        .setAudience('not-gate')
        .setIssuedAt()
        .sign(privateKey);
    }
    if (rawManifest.cases['WEB-10'] || rawManifest.cases['PORT-08'] || rawManifest.cases['DB-18']) {
      const web10 = rawManifest.cases['WEB-10'];
      const catalogListPaths = web10
        ? [
            ...new Set(
              Object.values(rawManifest.cases)
                .map((entry) => entry.tenantSlug)
                .filter(Boolean)
                .map((slug) => `/v1/public/tenants/${slug}/events`),
            ),
          ]
        : [];
      state.faultControlPath = resolve(state.dir, 'fault-control.json');
      state.faultPaths = [
        ...(web10
          ? [
              `/v1/public/tenants/${web10.tenantSlug}/events/${web10.eventSlug}`,
              ...catalogListPaths,
              '/v1/me/tenants',
              '/v1/me/tickets',
              `/v1/tenants/${web10.tenantId}/events/${web10.eventId}/redemptions`,
            ]
          : []),
        ...(rawManifest.cases['PORT-08']
          ? [
              `/v1/tenants/${rawManifest.cases['PORT-08'].tenantId}/events/${rawManifest.cases['PORT-08'].eventId}/report`,
            ]
          : []),
      ];
      privateJson(state.faultControlPath, {
        ownerRunId: state.id,
        routes: {},
      });
      rawManifest.runtime.faultControlPath = state.faultControlPath;
      if (rawManifest.cases['DB-18']) {
        state.idpFaultHitPath = resolve(state.dir, 'idp-delete-fault-hit.json');
        rawManifest.runtime.idpFaultHitPath = state.idpFaultHitPath;
      }
    }
    if (state.origins.faultPortal) {
      rawManifest.cases['PLAT-05'].data.unconfiguredPortalOrigin =
        state.origins.faultPortal;
    }
    privateJson(state.manifestPath, rawManifest);
    validateManifest(rawManifest, {
      requiredCaseIds: caseIds,
      runDir: state.dir,
    });
    const homeCatalogSlugs = [
      ...new Set(
        ['WEB-01', 'WEB-10', 'AUTH-07']
          .map((id) => rawManifest.cases[id]?.tenantSlug)
          .filter(Boolean),
      ),
    ];
    if (homeCatalogSlugs.length === 0) {
      const seedSlug = Object.values(rawManifest.cases).find(
        (fixture) => fixture.tenantSlug,
      )?.tenantSlug;
      if (seedSlug) homeCatalogSlugs.push(seedSlug);
    }
    const common = processEnvironment(state, {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([key]) =>
          key.startsWith('E2E_WEB13_'),
        ),
      ),
      MINIO_ENDPOINT: `http://127.0.0.1:${state.ports.minio}`,
      MINIO_ACCESS_KEY: state.minio.identities.shared.accessKey,
      MINIO_SECRET_KEY: state.minio.identities.shared.secretKey,
      MINIO_EXPORTS_ACCESS_KEY: state.minio.identities.exports.accessKey,
      MINIO_EXPORTS_SECRET_KEY: state.minio.identities.exports.secretKey,
      MINIO_BUCKET_ASSETS: state.minio.buckets.assets,
      MINIO_BUCKET_IMPORTS: state.minio.buckets.imports,
      MINIO_BUCKET_EXPORTS: state.minio.buckets.exports,
      MINIO_REGION: 'us-east-1',
      API_BASE_URL: state.origins.api,
      MARKETING_HOSTS: state.suffix,
      PUBLIC_HOME_TENANT_SLUGS: homeCatalogSlugs.join(','),
      E2E_MANIFEST: state.manifestPath,
      E2E_RUN_DIR: state.dir,
      E2E_TLS_SPKI: state.spki,
    });
    const observerEnv = {
      E2E_MINIO_OBSERVER_ACCESS_KEY: state.minio.identities.observer.accessKey,
      E2E_MINIO_OBSERVER_SECRET_KEY: state.minio.identities.observer.secretKey,
    };
    if (publicReadDiagnostic) {
      diagnostic = {
        salt: randomBytes(24).toString('hex'),
        phaseFile: resolve(state.dir, 'public-read-phase.txt'),
        stopFile: resolve(state.dir, 'public-read-first-429.txt'),
        output: resolve(state.dir, 'public-read-observed.json'),
        webOutput: resolve(state.dir, 'public-read-web-observed.json'),
      };
      writeFileSync(diagnostic.phaseFile, 'readiness', { mode: 0o600 });
      diagnostic.beforeApi = await publicReadSnapshot(state, diagnostic.salt);
    }
    const oidc = startProcess(
      state,
      'oidc-preflight',
      process.execPath,
      [resolve(E2E, 'harness/oidc-preflight.mjs')],
      common,
    );
    if (await exitCode(oidc))
      throw new Error(
        'BLOCKED: OIDC preflight thất bại; xem oidc-preflight.log',
      );
    startProcess(
      state,
      'api',
      process.execPath,
      [resolve(ROOT, 'apps/api/dist/main.js')],
      {
        ...common,
        PORT: String(state.ports.api),
        ...(diagnostic
          ? {
              NODE_OPTIONS: `${common.NODE_OPTIONS} --require ${resolve(E2E, 'harness/public-read-observer.cjs')}`,
              E2E_PUBLIC_READ_DIAGNOSTIC: '1',
              E2E_PUBLIC_READ_OUTPUT: diagnostic.output,
              E2E_PUBLIC_READ_PHASE: diagnostic.phaseFile,
              E2E_PUBLIC_READ_STOP: diagnostic.stopFile,
              E2E_PUBLIC_READ_SALT: diagnostic.salt,
            }
          : {}),
      },
    );
    startProcess(
      state,
      'worker',
      process.execPath,
      [resolve(ROOT, 'apps/worker/dist/main.js')],
      caseIds.includes('DB-18')
        ? {
            ...common,
            KEYCLOAK_ERASURE_ENABLED: '1',
            KEYCLOAK_BASE_URL: state.origins.auth,
            KEYCLOAK_REALM: state.realm,
            KEYCLOAK_ERASURE_CLIENT_ID: 'e2e-erasure',
            KEYCLOAK_ERASURE_CLIENT_SECRET: state.clientSecrets['e2e-erasure'],
          }
        : caseIds.includes('DB-19') ? { ...common, OUTBOX_POLL_MS: '0' } : common,
    );
    await waitFor('API health', () =>
      getLocalJson(state, state.origins.api, '/v1/health'),
    );
    const httpNeedsFrontend =
      mode === 'http' &&
      caseIds.some((id) => ['AUTH-03', 'SEC-02', 'SEC-03', 'SEC-05', 'DB-17', 'PLAT-03'].includes(id));
    if (mode !== 'http' || httpNeedsFrontend) {
      if (needsBuild) {
        // `.next` sắp bị ghi đè: marker cũ không còn mô tả đúng nó nữa.
        clearBuildMarker();
        console.log('E2E: build Web/Portal production');
        const builds = ['web', 'portal'].map((name) =>
          startProcess(
            state,
            `${name}-build`,
            'pnpm',
            ['--filter', `@ticket/${name}`, 'build'],
            { ...common, WEB_PUBLIC_ORIGIN: state.origins[name] },
          ),
        );
        if ((await Promise.all(builds.map(exitCode))).some(Boolean))
          throw new Error('BLOCKED: frontend build thất bại; xem *-build.log');
        if (laneBuildKey)
          writeBuildMarker(laneBuildKey, {
            gitCommit: state.sourceProvenance.gitCommit,
          });
      }
      const clientEnv = (name) => ({
        ...common,
        PORT: String(state.ports[name]),
        WEB_PUBLIC_ORIGIN: state.origins[name],
        AUTH_COOKIE_SECURE: 'true',
        OIDC_CLIENT_ID: name === 'web' ? 'ticket-web' : 'ticket-admin-web',
        OIDC_CLIENT_SECRET:
          state.clientSecrets[
            name === 'web' ? 'ticket-web' : 'ticket-admin-web'
          ],
        OIDC_REDIRECT_URI: `${state.origins[name]}/api/auth/callback`,
        PLATFORM_OIDC_CLIENT_ID: 'ticket-platform-web',
        PLATFORM_OIDC_CLIENT_SECRET: state.clientSecrets['ticket-platform-web'],
        PLATFORM_OIDC_REDIRECT_URI: `${state.origins.portal}/api/auth/platform/callback`,
        PLATFORM_OIDC_REQUIRED_ACR: '2',
        ...(diagnostic && name === 'web'
          ? {
              NODE_OPTIONS: `${common.NODE_OPTIONS} --require ${resolve(E2E, 'harness/web-read-observer.cjs')}`,
              E2E_WEB_READ_DIAGNOSTIC: '1',
              E2E_WEB_READ_OUTPUT: diagnostic.webOutput,
              E2E_WEB_READ_PHASE: diagnostic.phaseFile,
              E2E_WEB_READ_ROLE: 'web',
            }
          : {}),
      });
      for (const name of ['web', 'portal']) {
        startProcess(
          state,
          name,
          process.execPath,
          [resolve(E2E, 'harness/next-server.mjs'), name],
          clientEnv(name),
        );
      }
      if (state.origins.faultPortal) {
        const env = {
          ...clientEnv('portal'),
          PORT: String(state.ports.faultPortal),
          WEB_PUBLIC_ORIGIN: state.origins.faultPortal,
        };
        for (const key of Object.keys(env))
          if (key.startsWith('PLATFORM_OIDC_')) delete env[key];
        startProcess(
          state,
          'fault-portal',
          process.execPath,
          [resolve(E2E, 'harness/next-server.mjs'), 'portal'],
          env,
        );
        await waitFor('fault Portal HTTPS', () =>
          localPage(state, state.origins.faultPortal),
        );
      }
      if (state.origins.shortWeb) {
        startProcess(
          state,
          'short-web',
          process.execPath,
          [resolve(E2E, 'harness/next-server.mjs'), 'web'],
          {
            ...clientEnv('web'),
            PORT: String(state.ports.shortWeb),
            WEB_PUBLIC_ORIGIN: state.origins.shortWeb,
            OIDC_CLIENT_ID: 'ticket-web-short',
            OIDC_CLIENT_SECRET: state.clientSecrets['ticket-web-short'],
            OIDC_REDIRECT_URI: `${state.origins.shortWeb}/api/auth/callback`,
          },
        );
        await waitFor('short Web HTTPS', () =>
          localPage(state, state.origins.shortWeb),
        );
      }
      await Promise.all(
        ['web', 'portal'].map((name) =>
          waitFor(`${name} HTTPS`, () => localPage(state, state.origins[name])),
        ),
      );
      const manifestWithUpstream = JSON.parse(
        readFileSync(state.manifestPath, 'utf8'),
      );
      manifestWithUpstream.runtime.upstreamPorts = {
        web: state.ports.web,
        portal: state.ports.portal,
        api: state.ports.api,
      };
      privateJson(state.manifestPath, manifestWithUpstream);
    }
    console.log(
      `E2E ${state.id}: runtime sẵn sàng; chạy ${mode}, ${caseIds.length} nhóm fixture`,
    );
    if (diagnostic) {
      diagnostic.afterReadiness = await publicReadSnapshot(
        state,
        diagnostic.salt,
      );
      if (existsSync(diagnostic.stopFile))
        throw new Error('BLOCKED: first public 429 during readiness');
    }
    const results = [];
    const selectedHttp =
      mode === 'http' ? caseIds : caseIds.filter((id) => id === 'SEC-01');
    if (selectedHttp.length) {
      const entry = resolve(E2E, 'http/entry.mjs');
      if (!existsSync(entry))
        throw new Error('BLOCKED: HTTP entry chưa sẵn sàng');
      for (const id of selectedHttp) {
        const child = startProcess(
          state,
          `http-${id}`,
          process.execPath,
          [entry, '--case', id],
          {
            ...common,
            ...(id === 'SEC-05' ? observerEnv : {}),
            ...(id === 'JOB-07' && process.env.E2E_JOB07_EXPIRY === '1'
              ? { E2E_JOB07_EXPIRY: '1' }
              : {}),
            ...(id === 'JOB-07' && process.env.E2E_JOB07_API_EXPIRY === '1'
              ? { E2E_JOB07_API_EXPIRY: '1' }
              : {}),
            ...(id === 'GATE-03'
              ? {
                  E2E_GATE_CREDENTIAL_PRIVATE_KEY_PEM:
                    gateCredentialPrivateKeyPem,
                  E2E_GATE_CREDENTIAL_ALG_PROOF_KEY:
                    state.secrets.gateCredentialAlgProofKey,
                }
              : {}),
          },
        );
        const childExitCode = await exitCode(child);
        results.push({
          layer: 'HTTP',
          caseId: id,
          exitCode: childExitCode,
        });
        if (id === 'DB-17' && childExitCode) {
          const log = readFileSync(resolve(state.dir, 'http-DB-17.log'), 'utf8');
          // Only fixed, bounded fields leave the private log. It may contain
          // browser, API, or authentication details on other failure paths.
          const sourceLines = [...new Set(
            [...log.matchAll(/live\.test\.mjs:(\d{1,6}):\d{1,4}/g)]
              .map((match) => Number(match[1])),
          )].slice(0, 4);
          const diagnostic = {
            caseId: id,
            exitCode: childExitCode,
            sourceLines,
            errorType: log.match(/\b(AssertionError|TimeoutError|TypeError)\b/)?.[1] ?? null,
            httpStatus: Number(log.match(/\bHTTP (\d{3}); code=/)?.[1]) || null,
            actual: Number(log.match(/\bactual: (\d{1,3})\b/)?.[1]) || null,
            expected: Number(log.match(/\bexpected: (\d{1,3})\b/)?.[1]) || null,
          };
          privateJson(resolve(state.dir, 'db17-failure.json'), diagnostic);
          console.error(`DB-17 failure diagnostic: ${JSON.stringify(diagnostic)}`);
        }
      }
    }
    if (mode !== 'http') {
      if (diagnostic)
        writeFileSync(diagnostic.phaseFile, 'browser', { mode: 0o600 });
      const child = startProcess(
        state,
        'browser-tests',
        process.execPath,
        browserArgs(caseIds),
        {
          ...common,
          ...(caseIds.includes('SEC-05') ? observerEnv : {}),
          ...(caseIds.includes('AUTH-07') ? { E2E_AUTH07_BFCACHE: '1' } : {}),
        },
      );
      const stoppedAt429 = diagnostic
        ? await exitAtFirst429(child, diagnostic.stopFile)
        : false;
      results.push({
        layer: 'browser',
        exitCode: diagnostic ? (child.exitCode ?? 1) : await exitCode(child),
      });
      if (diagnostic) {
        diagnostic.afterBrowser = await publicReadSnapshot(
          state,
          diagnostic.salt,
        );
        diagnostic.stoppedAt429 =
          stoppedAt429 || existsSync(diagnostic.stopFile);
        privateJson(resolve(state.dir, 'public-read-diagnostic.json'), {
          beforeApi: diagnostic.beforeApi,
          afterReadiness: diagnostic.afterReadiness,
          afterBrowser: diagnostic.afterBrowser,
          stoppedAt429: diagnostic.stoppedAt429,
          observed: JSON.parse(readFileSync(diagnostic.output, 'utf8')),
          webObserved: existsSync(diagnostic.webOutput)
            ? JSON.parse(readFileSync(diagnostic.webOutput, 'utf8'))
            : {
                role: 'web',
                observed: 0,
                counts: [],
                note: 'no web observer output',
              },
        });
      }
      if (mode === 'regression') {
        const domain = startProcess(
          state,
          'integration-tests',
          process.execPath,
          [resolve(E2E, 'backend/entry.mjs')],
          common,
        );
        results.push({
          layer: 'integration',
          exitCode: await exitCode(domain),
        });
      }
    }
    const provenanceEnd = assertSourceProvenanceStable(
      ROOT,
      state.sourceProvenance,
    );
    const status = diagnostic?.stoppedAt429
      ? 'ABORTED_429'
      : results.some((result) => result.exitCode)
        ? 'FAIL'
        : 'PASS';
    summary = {
      runId: state.id,
      lane: state.lane ? state.lane.name : null,
      mode,
      caseIds,
      status,
      results,
      sourceProvenance: {
        ...state.sourceProvenance,
        endCommit: provenanceEnd.endCommit,
        endWorkingTreeFingerprint: provenanceEnd.endWorkingTreeFingerprint,
        commitStable: provenanceEnd.stable,
        evidenceExactShaEligible: provenanceEnd.evidenceExactShaEligible,
      },
    };
    process.exitCode = status === 'PASS' ? 0 : 1;
  } catch (error) {
    if (!state && error.runtimeState) state = error.runtimeState;
    process.exitCode = 2;
    // No full error stack, env, manifest or command argv in the shared report.
    const message = String(error.message || 'setup_failed').replace(
      /postgresql:\/\/[^@]+@/g,
      'postgresql://[redacted]@',
    );
    console.error(message);
    if (state) {
      let sourceProvenance = state.sourceProvenance;
      try {
        const provenanceEnd = assertSourceProvenanceStable(
          ROOT,
          state.sourceProvenance,
        );
        sourceProvenance = {
          ...state.sourceProvenance,
          endCommit: provenanceEnd.endCommit,
          endWorkingTreeFingerprint: provenanceEnd.endWorkingTreeFingerprint,
          commitStable: provenanceEnd.stable,
          evidenceExactShaEligible: provenanceEnd.evidenceExactShaEligible,
        };
      } catch (provenanceError) {
        sourceProvenance = {
          ...state.sourceProvenance,
          commitStable: false,
          evidenceExactShaEligible: false,
          provenanceError: String(provenanceError.message || provenanceError),
        };
      }
      summary = {
        runId: state.id,
        lane: state.lane ? state.lane.name : null,
        mode,
        caseIds,
        status: 'BLOCKED',
        reason: message,
        sourceProvenance,
      };
    }
  } finally {
    const finalized = await finalizeRun(summary, cleanup);
    const { cleanupError } = finalized;
    summary = finalized.summary;
    if (summary || cleanupError) process.exitCode = finalized.exitCode;
    if (cleanupError) {
      process.exitCode = 2;
      console.error(`BLOCKED: cleanup failed; see private cleanup logs`);
    }
    if (summary && state) {
      privateJson(resolve(state.dir, 'summary.json'), summary);
      console.log(JSON.stringify({ runId: state.id, lane: state.lane?.name ?? null, mode, status: summary.status, results: summary.results, report: `tests/e2e/.artifacts/${state.id}/summary.json` }));
    }
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  }
}
