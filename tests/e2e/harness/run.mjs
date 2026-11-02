#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';
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
import { validateManifest } from '../validation/validate.mjs';
import { assertSourceProvenanceStable } from './source-provenance.mjs';

const requireRoot = createRequire(resolve(ROOT, 'package.json'));
const requireBackend = createRequire(resolve(ROOT, 'packages/backend/package.json'));
const args = process.argv.slice(2);
const mode = args.shift() || 'smoke';
const skipBuild = args.includes('--skip-build');
const publicReadDiagnostic = args.includes('--public-read-diagnostic');
if (publicReadDiagnostic && (mode !== 'e2e' || !args.includes('--case=WEB-01,WEB-02,WEB-03,WEB-04,WEB-05,WEB-06,WEB-07,WEB-08,WEB-09,WEB-10,WEB-11,WEB-12,WEB-13'))) {
  throw new Error('Public-read diagnostic requires e2e and the exact WEB-01–13 case list');
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
  'GATE-03',
  'DB-01',
  'DB-02',
  'DB-03',
  'DB-04',
  'DB-07',
  'DB-10',
  'DB-11',
  'DB-12',
  'DB-14',
  'DB-15',
  'DB-16',
  'JOB-04',
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
if (
  !['smoke', 'e2e', 'http', 'regression', 'list'].includes(mode) ||
  caseIds.some((id) => !/^(AUTH|WEB|PORT|PLAT|SEC|DB|GATE|JOB)-\d{2}$/.test(id))
) {
  console.error(
    'Usage: node tests/e2e/harness/run.mjs smoke|e2e|http|regression|list [--skip-build] [--case=WEB-02,PORT-07]',
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
  if (state.project !== `e2e-${state.id}` || !Number.isInteger(state.ports.pg)) {
    throw new Error('BLOCKED: diagnostic requires the owned local database');
  }
  const requireApi = createRequire(resolve(ROOT, 'apps/api/package.json'));
  const { Client } = requireApi('pg');
  const client = new Client({
    host: '127.0.0.1', port: state.ports.pg, database: 'e2e',
    user: 'postgres', password: state.secrets.pg,
  });
  await client.connect();
  try {
    const { rows } = await client.query(
      "SELECT tenant_id, window_started_at, count FROM notification_rate_counters WHERE bucket_key = $1 ORDER BY window_started_at, tenant_id",
      ['api.public.read'],
    );
    return rows.map((row) => ({
      scopeHash: createHash('sha256').update(salt).update(row.tenant_id).digest('hex').slice(0, 16),
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
  const cleanup = () =>
    (cleaning ||= state ? destroyRuntime(state) : Promise.resolve());
  const interrupt = async () => {
    process.exitCode = 130;
    await cleanup();
    process.exit(130);
  };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    state = await createRuntime(caseIds);
    if (!skipBuild) {
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
    if (caseIds.includes('GATE-03')) {
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
      const { SignJWT, importPKCS8 } = await import(requireBackend.resolve('jose'));
      const privateKey = await importPKCS8(gateCredentialPrivateKeyPem, 'ES256');
      const gate = rawManifest.cases['GATE-03'];
      gate.data ??= {};
      const ticketClaims = {
        tid: gate.tenantId,
        eid: gate.eventId,
        tkt: gate.ticketId,
        ver: 1,
        jti: randomBytes(16).toString('hex'),
      };
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
      gate.data.expiredManualProofToken = await new SignJWT({
        ...ticketClaims,
        sid: 'expired-e2e-session',
      })
        .setProtectedHeader({
          alg: 'ES256',
          kid: state.secrets.gateCredentialCurrentKeyId,
          typ: 'JWT',
        })
        .setIssuer('vemoki-gate')
        .setAudience('gate')
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) - 1)
        .sign(privateKey);
    }
    if (rawManifest.cases['WEB-10'] || rawManifest.cases['PORT-08']) {
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
      PUBLIC_HOME_TENANT_SLUGS: Object.values(rawManifest.cases)
        .map((fixture) => fixture.tenantSlug)
        .join(','),
      E2E_MANIFEST: state.manifestPath,
      E2E_RUN_DIR: state.dir,
      E2E_TLS_SPKI: state.spki,
    });
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
        ...common, PORT: String(state.ports.api),
        ...(diagnostic ? {
          NODE_OPTIONS: `${common.NODE_OPTIONS} --require ${resolve(E2E, 'harness/public-read-observer.cjs')}`,
          E2E_PUBLIC_READ_DIAGNOSTIC: '1',
          E2E_PUBLIC_READ_OUTPUT: diagnostic.output,
          E2E_PUBLIC_READ_PHASE: diagnostic.phaseFile,
          E2E_PUBLIC_READ_STOP: diagnostic.stopFile,
          E2E_PUBLIC_READ_SALT: diagnostic.salt,
        } : {}),
      },
    );
    startProcess(
      state,
      'worker',
      process.execPath,
      [resolve(ROOT, 'apps/worker/dist/main.js')],
      common,
    );
    await waitFor('API health', () =>
      getLocalJson(state, state.origins.api, '/v1/health'),
    );
    const httpNeedsFrontend =
      mode === 'http' &&
      caseIds.some((id) => ['AUTH-03', 'SEC-02', 'SEC-03', 'SEC-05'].includes(id));
    if (mode !== 'http' || httpNeedsFrontend) {
      if (!skipBuild) {
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
      diagnostic.afterReadiness = await publicReadSnapshot(state, diagnostic.salt);
      if (existsSync(diagnostic.stopFile)) throw new Error('BLOCKED: first public 429 during readiness');
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
          common,
        );
        results.push({
          layer: 'HTTP',
          caseId: id,
          exitCode: await exitCode(child),
        });
      }
    }
    if (mode !== 'http') {
      if (diagnostic) writeFileSync(diagnostic.phaseFile, 'browser', { mode: 0o600 });
      const child = startProcess(
        state,
        'browser-tests',
        process.execPath,
        browserArgs(caseIds),
        { ...common, ...(caseIds.includes('AUTH-07') ? { E2E_AUTH07_BFCACHE: '1' } : {}) },
      );
      const stoppedAt429 = diagnostic
        ? await exitAtFirst429(child, diagnostic.stopFile)
        : false;
      results.push({ layer: 'browser', exitCode: diagnostic ? (child.exitCode ?? 1) : await exitCode(child) });
      if (diagnostic) {
        diagnostic.afterBrowser = await publicReadSnapshot(state, diagnostic.salt);
        diagnostic.stoppedAt429 = stoppedAt429 || existsSync(diagnostic.stopFile);
        privateJson(resolve(state.dir, 'public-read-diagnostic.json'), {
          beforeApi: diagnostic.beforeApi,
          afterReadiness: diagnostic.afterReadiness,
          afterBrowser: diagnostic.afterBrowser,
          stoppedAt429: diagnostic.stoppedAt429,
          observed: JSON.parse(readFileSync(diagnostic.output, 'utf8')),
          webObserved: existsSync(diagnostic.webOutput)
            ? JSON.parse(readFileSync(diagnostic.webOutput, 'utf8'))
            : { role: 'web', observed: 0, counts: [], note: 'no web observer output' },
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
      : results.some((result) => result.exitCode) ? 'FAIL' : 'PASS';
    privateJson(resolve(state.dir, 'summary.json'), {
      runId: state.id,
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
    });
    console.log(
      JSON.stringify({
        runId: state.id,
        mode,
        status,
        results,
        report: `tests/e2e/.artifacts/${state.id}/summary.json`,
      }),
    );
    process.exitCode = status === 'PASS' ? 0 : 1;
  } catch (error) {
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
      privateJson(resolve(state.dir, 'summary.json'), {
        runId: state.id,
        mode,
        caseIds,
        status: 'BLOCKED',
        reason: message,
        sourceProvenance,
      });
    }
  } finally {
    await cleanup();
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  }
}
