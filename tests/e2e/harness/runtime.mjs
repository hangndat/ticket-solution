import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  createServer as createHttpsServer,
  request as httpsRequest,
} from 'node:https';
import { request as httpRequest } from 'node:http';
import { createServer } from 'node:net';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  openSync,
  closeSync,
  existsSync,
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { captureSourceProvenance } from './source-provenance.mjs';

export const ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
export const E2E = resolve(ROOT, 'tests/e2e');
const ACTORS = [
  'attendee',
  'otherAttendee',
  'unverified',
  'owner',
  'manager',
  'cs',
  'scanner',
  'supervisor',
  'operator',
];

export function privateJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
}

export async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}

function command(binary, args, options = {}) {
  return execFileSync(binary, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 8e6,
    ...options,
  });
}

export async function waitFor(description, check, timeout = 120_000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      last = error;
    }
    await delay(300);
  }
  throw new Error(
    `BLOCKED: ${description} chưa sẵn sàng (${last?.code || 'timeout'}); xem log private của run`,
  );
}

function certs(state) {
  const key = resolve(state.dir, 'tls.key');
  const cert = resolve(state.dir, 'tls.crt');
  const config = resolve(state.dir, 'openssl.cnf');
  writeFileSync(
    config,
    `[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=${state.suffix}\n[ext]\nsubjectAltName=DNS:${state.suffix},DNS:*.${state.suffix}\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,digitalSignature,keyEncipherment,keyCertSign\nextendedKeyUsage=serverAuth\n`,
    { mode: 0o600 },
  );
  command(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '2',
      '-config',
      config,
      '-keyout',
      key,
      '-out',
      cert,
    ],
    { stdio: 'ignore' },
  );
  const pub = command('openssl', ['x509', '-in', cert, '-pubkey', '-noout']);
  const der = execFileSync('openssl', ['pkey', '-pubin', '-outform', 'DER'], {
    input: pub,
  });
  state.cert = cert;
  state.key = key;
  state.spki = createHash('sha256').update(der).digest('base64');
}

function account(actor, suffix) {
  const value = {
    username: `${actor}.${suffix}@example.test`,
    password: randomBytes(24).toString('base64url'),
    subject: randomUUID(),
  };
  if (actor === 'operator') {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0,
      buffer = 0,
      secret = '';
    value.totpRawSecret = randomBytes(16).toString('hex').slice(0, 20);
    for (const byte of Buffer.from(value.totpRawSecret, 'utf8')) {
      buffer = (buffer << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        bits -= 5;
        secret += alphabet[(buffer >>> bits) & 31];
      }
    }
    value.totpSecret = secret;
  }
  return value;
}

function realmConfig(state, caseIds) {
  const realm = JSON.parse(
    readFileSync(resolve(ROOT, 'infra/keycloak/realm-ticket.json'), 'utf8'),
  );
  realm.realm = state.realm;
  realm.displayName = 'Vemoki local E2E';
  realm.sslRequired = 'external';
  realm.smtpServer = {
    host: 'mailpit',
    port: '1025',
    from: 'noreply@example.test',
    auth: 'false',
    ssl: 'false',
    starttls: 'false',
  };
  realm.users = [];
  // Preserve email_verified=false for negative issue tests without blocking the
  // real OIDC login on a Keycloak required action before the application gate.
  realm.verifyEmail = false;
  realm.registrationAllowed = false;
  state.accounts = {};
  state.caseAccounts = {};
  function addAccounts(scope, target) {
    for (const actor of ACTORS) {
      const value = account(actor, `${scope}.${state.id}`);
      target[actor] = value;
      realm.users.push({
        id: value.subject,
        username: value.username,
        email: value.username,
        enabled: true,
        firstName: 'E2E',
        lastName: actor,
        emailVerified: actor !== 'unverified',
        requiredActions: [],
        credentials: [
          { type: 'password', value: value.password, temporary: false },
          ...(value.totpSecret
            ? [
                {
                  type: 'otp',
                  userLabel: 'E2E TOTP',
                  secretData: JSON.stringify({ value: value.totpRawSecret }),
                  credentialData: JSON.stringify({
                    subType: 'totp',
                    digits: 6,
                    counter: 0,
                    period: 30,
                    algorithm: 'HmacSHA1',
                  }),
                },
              ]
            : []),
        ],
      });
    }
  }
  addAccounts('default', state.accounts);
  for (const id of caseIds) {
    state.caseAccounts[id] = {};
    addAccounts(id.toLowerCase(), state.caseAccounts[id]);
    if (id === 'SEC-05') {
      const formulaEmail = `=formula-${state.id}@example.test`;
      const attendee = state.caseAccounts[id].attendee;
      attendee.username = formulaEmail;
      const realmUser = realm.users.find(
        (user) => user.id === attendee.subject,
      );
      if (realmUser) {
        realmUser.username = formulaEmail;
        realmUser.email = formulaEmail;
      }
    }
  }
  state.clientSecrets = {};
  if (state.origins.shortWeb) {
    const short = structuredClone(
      realm.clients.find((client) => client.clientId === 'ticket-web'),
    );
    delete short.id;
    short.clientId = 'ticket-web-short';
    realm.clients.push(short);
  }
  const mfaFlowId = randomUUID();
  realm.authenticationFlows = [
    {
      id: mfaFlowId,
      alias: 'e2e-platform-mfa',
      description:
        'Real password and OTP required for the isolated Platform client',
      providerId: 'basic-flow',
      topLevel: true,
      builtIn: false,
      authenticationExecutions: [
        {
          authenticator: 'auth-username-password-form',
          requirement: 'REQUIRED',
          priority: 10,
          userSetupAllowed: false,
          authenticatorFlow: false,
        },
        {
          authenticator: 'auth-otp-form',
          requirement: 'REQUIRED',
          priority: 20,
          userSetupAllowed: false,
          authenticatorFlow: false,
        },
      ],
    },
  ];
  for (const client of realm.clients) {
    const isPlatform = client.clientId === 'ticket-platform-web';
    const origin =
      client.clientId === 'ticket-web-short'
        ? state.origins.shortWeb
        : client.clientId === 'ticket-web'
          ? state.origins.web
          : state.origins.portal;
    if (
      [
        'ticket-web',
        'ticket-web-short',
        'ticket-admin-web',
        'ticket-platform-web',
      ].includes(client.clientId)
    ) {
      const secret = randomBytes(24).toString('base64url');
      state.clientSecrets[client.clientId] = secret;
      client.secret = secret;
      client.redirectUris = [
        `${origin}/api/auth/${isPlatform ? 'platform/' : ''}callback`,
      ];
      client.webOrigins = [origin];
      client.rootUrl = origin;
      client.baseUrl = origin;
      client.attributes = {
        ...client.attributes,
        'post.logout.redirect.uris': `${origin}/auth##${origin}/`,
      };
      if (client.clientId === 'ticket-web')
        client.attributes['access.token.lifespan'] = '300';
      if (client.clientId === 'ticket-web-short')
        client.attributes['access.token.lifespan'] = '20';
      if (isPlatform) {
        client.authenticationFlowBindingOverrides = { browser: mfaFlowId };
        client.defaultClientScopes = [
          ...new Set([
            ...(client.defaultClientScopes || [
              'web-origins',
              'roles',
              'profile',
              'email',
            ]),
            'basic',
          ]),
        ].filter((x) => x !== 'acr');
        client.protocolMappers = [
          ...(client.protocolMappers || []).filter(
            (x) => x.protocolMapper !== 'oidc-acr-mapper',
          ),
          {
            name: 'e2e-required-mfa-acr',
            protocol: 'openid-connect',
            protocolMapper: 'oidc-hardcoded-claim-mapper',
            consentRequired: false,
            config: {
              'claim.name': 'acr',
              'claim.value': '2',
              'jsonType.label': 'String',
              'id.token.claim': 'true',
              'access.token.claim': 'true',
            },
          },
        ];
      }
    }
  }
  // Real Keycloak grant for HTTP-layer tests only; no fabricated JWT/verifier.
  state.clientSecrets['e2e-http'] = randomBytes(24).toString('base64url');
  realm.clients.push({
    clientId: 'e2e-http',
    enabled: true,
    publicClient: false,
    secret: state.clientSecrets['e2e-http'],
    protocol: 'openid-connect',
    standardFlowEnabled: false,
    directAccessGrantsEnabled: true,
    defaultClientScopes: ['basic', 'profile', 'email', 'roles'],
    protocolMappers: [
      {
        name: 'real-api-audience',
        protocol: 'openid-connect',
        protocolMapper: 'oidc-audience-mapper',
        consentRequired: false,
        config: {
          'included.custom.audience': 'ticket-api',
          'access.token.claim': 'true',
          'id.token.claim': 'false',
        },
      },
    ],
  });
  state.clientSecrets['e2e-http-platform'] =
    randomBytes(24).toString('base64url');
  realm.clients.push({
    clientId: 'e2e-http-platform',
    enabled: true,
    publicClient: false,
    secret: state.clientSecrets['e2e-http-platform'],
    protocol: 'openid-connect',
    standardFlowEnabled: false,
    directAccessGrantsEnabled: true,
    defaultClientScopes: ['basic', 'profile', 'email', 'roles'],
    protocolMappers: [
      {
        name: 'real-platform-audience',
        protocol: 'openid-connect',
        protocolMapper: 'oidc-audience-mapper',
        consentRequired: false,
        config: {
          'included.custom.audience': 'ticket-platform-api',
          'access.token.claim': 'true',
          'id.token.claim': 'false',
        },
      },
      {
        name: 'e2e-platform-acr',
        protocol: 'openid-connect',
        protocolMapper: 'oidc-hardcoded-claim-mapper',
        consentRequired: false,
        config: {
          'claim.name': 'acr',
          'claim.value': '2',
          'jsonType.label': 'String',
          'id.token.claim': 'true',
          'access.token.claim': 'true',
        },
      },
      {
        name: 'auth-time',
        protocol: 'openid-connect',
        protocolMapper: 'oidc-usersessionmodel-note-mapper',
        consentRequired: false,
        config: {
          'user.session.note': 'AUTH_TIME',
          'claim.name': 'auth_time',
          'jsonType.label': 'int',
          'id.token.claim': 'true',
          'access.token.claim': 'true',
        },
      },
    ],
  });
  const realmPath = resolve(state.dir, 'realm.json');
  privateJson(realmPath, realm);
  return realmPath;
}

function composeConfig(state, realmPath) {
  const env = state.secrets;
  const port = (inner) => [`127.0.0.1::${inner}`];
  const label = { 'vemoki.e2e.run': state.id };
  const compose = {
    name: state.project,
    services: {
      postgres: {
        image: 'postgres:18.1-alpine',
        labels: label,
        environment: {
          POSTGRES_DB: 'e2e',
          POSTGRES_USER: 'postgres',
          POSTGRES_PASSWORD: env.pg,
        },
        ports: port(5432),
        healthcheck: {
          test: ['CMD-SHELL', 'pg_isready -U postgres -d e2e'],
          interval: '1s',
          timeout: '2s',
          retries: 60,
        },
      },
      redis: {
        image: 'redis:7-alpine',
        labels: label,
        ports: port(6379),
        healthcheck: {
          test: ['CMD', 'redis-cli', 'ping'],
          interval: '1s',
          timeout: '2s',
          retries: 30,
        },
      },
      mailpit: {
        image: 'axllent/mailpit:v1.22',
        labels: label,
        ports: [...port(1025), ...port(8025)],
      },
      keycloak: {
        image: 'quay.io/keycloak/keycloak:26.0',
        user: '0:0',
        labels: label,
        command: ['start-dev', '--import-realm', '--http-port=8080'],
        environment: {
          KC_BOOTSTRAP_ADMIN_USERNAME: 'e2e-admin',
          KC_BOOTSTRAP_ADMIN_PASSWORD: env.kc,
          KC_HOSTNAME: state.origins.auth,
          KC_HOSTNAME_STRICT: 'false',
          KC_HTTP_ENABLED: 'true',
          KC_PROXY_HEADERS: 'xforwarded',
        },
        ports: port(8080),
        volumes: [`${realmPath}:/opt/keycloak/data/import/e2e.json:ro`],
      },
      minio: {
        image:
          'cleanstart/minio@sha256:4febd64f632c221b48e0fbf435ac534df822aa5b06805540c03973939e4cc82a',
        labels: label,
        user: '0:0',
        command: ['server', '/data', '--address', ':9000'],
        environment: {
          MINIO_ROOT_USER: 'e2e-access',
          MINIO_ROOT_PASSWORD: env.minio,
        },
        ports: port(9000),
      },
    },
  };
  state.composeFile = resolve(state.dir, 'compose.json');
  privateJson(state.composeFile, compose);
}

function compose(state, ...args) {
  return command('docker', [
    'compose',
    '--project-name',
    state.project,
    '-f',
    state.composeFile,
    ...args,
  ]);
}

function publishedPort(state, service, inner) {
  const address = compose(state, 'port', service, String(inner)).trim();
  const value = Number(address.split(':').at(-1));
  if (!Number.isInteger(value) || value < 1)
    throw new Error(`BLOCKED: không resolve được port ${service}`);
  return value;
}

function startProxy(state) {
  const server = createHttpsServer(
    { key: readFileSync(state.key), cert: readFileSync(state.cert) },
    (req, res) => {
      const host = String(req.headers.host || '').split(':')[0];
      const label =
        host === state.suffix
          ? 'web'
          : host.slice(0, -(state.suffix.length + 1));
      const route =
        label === 'app'
          ? 'web'
          : label === 'fault-portal'
            ? 'faultPortal'
            : label === 'short-web'
              ? 'shortWeb'
              : label;
      const upstream = state.ports[route];
      if (
        !upstream ||
        ![
          state.suffix,
          ...Object.values(state.origins).map((x) => new URL(x).hostname),
        ].includes(host)
      ) {
        res.writeHead(421);
        res.end('Unknown E2E host');
        return;
      }
      const reqPath = String(req.url).split('?')[0];
      let faultMode;
      if (
        route === 'api' &&
        state.faultControlPath &&
        (state.faultPaths?.includes(reqPath) ||
          reqPath.startsWith('/v1/operations/')) &&
        existsSync(state.faultControlPath)
      ) {
        let fault;
        try {
          fault = JSON.parse(readFileSync(state.faultControlPath, 'utf8'));
        } catch {
          fault = null;
        }
        if (fault?.ownerRunId === state.id) {
          faultMode = fault.routes?.[reqPath];
        }
      }
      if (faultMode === 'unavailable' || faultMode === 'error500') {
        res.writeHead(faultMode === 'unavailable' ? 503 : 500, {
          'content-type': 'application/json',
          'cache-control': 'no-store',
        });
        res.end(
          JSON.stringify(
            faultMode === 'unavailable'
              ? { code: 'E2E_UPSTREAM_UNAVAILABLE', retryable: true }
              : { code: 'E2E_UPSTREAM_ERROR', retryable: false },
          ),
        );
        return;
      }
      if (faultMode === 'operation404') {
        res.writeHead(404, {
          'content-type': 'application/json',
          'cache-control': 'no-store',
        });
        res.end(
          JSON.stringify({
            code: 'NOT_FOUND',
            message: 'Operation not found',
            retryable: true,
          }),
        );
        return;
      }
      if (faultMode === 'timeout') {
        // Never respond — client AbortSignal.timeout / fetch abort must fire.
        req.on('data', () => {});
        req.on('end', () => {});
        return;
      }
      const headers = {
        ...req.headers,
        host: req.headers.host,
        'x-forwarded-host': req.headers.host,
        'x-forwarded-proto': 'https',
        'x-forwarded-port': String(state.tlsPort),
      };
      delete headers.forwarded;
      if (faultMode === 'lostResponse') {
        // Forward to the real upstream so the operation commits server-side,
        // then drop the connection instead of relaying the response — the
        // client must reconcile via the real operation, not assume failure.
        const target = httpRequest(
          {
            hostname: '127.0.0.1',
            port: upstream,
            path: req.url,
            method: req.method,
            headers,
          },
          (reply) => {
            reply.resume();
            reply.on('end', () => res.destroy());
          },
        );
        target.on('error', () => res.destroy());
        req.pipe(target);
        return;
      }
      if (faultMode === 'earlyTimeout') {
        // The API keeps processing the forwarded POST while the client sees
        // an upstream timeout. A deferred DB trigger in WEB-10 holds COMMIT.
        const timer = setTimeout(() => {
          if (res.destroyed) return;
          res.writeHead(504, {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          });
          res.end(
            JSON.stringify({ code: 'E2E_UPSTREAM_TIMEOUT', retryable: true }),
          );
        }, 700);
        const target = httpRequest(
          {
            hostname: '127.0.0.1',
            port: upstream,
            path: req.url,
            method: req.method,
            headers,
          },
          (reply) => reply.resume(),
        );
        target.on('error', () => {
          clearTimeout(timer);
          if (!res.destroyed) res.destroy();
        });
        req.pipe(target);
        return;
      }
      const target = httpRequest(
        {
          hostname: '127.0.0.1',
          port: upstream,
          path: req.url,
          method: req.method,
          headers,
        },
        (reply) => {
          res.writeHead(reply.statusCode, reply.headers);
          reply.pipe(res);
        },
      );
      target.on('error', () => {
        if (!res.headersSent) res.writeHead(502);
        res.end('E2E upstream unavailable');
      });
      req.pipe(target);
    },
  );
  state.proxy = server;
  return new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(state.tlsPort, '127.0.0.1', done);
  });
}

export function getLocalJson(state, origin, path) {
  const url = new URL(path, origin);
  return new Promise((done, reject) => {
    const req = httpsRequest(
      {
        hostname: '127.0.0.1',
        servername: url.hostname,
        port: state.tlsPort,
        path: url.pathname + url.search,
        headers: { host: url.host },
        ca: readFileSync(state.cert),
        timeout: 5000,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (s) => (body += s));
        res.on('end', () => {
          if (res.statusCode >= 400)
            return reject(new Error(`HTTP_${res.statusCode}`));
          try {
            done(JSON.parse(body));
          } catch {
            reject(new Error('NOT_JSON'));
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('TIMEOUT')));
    req.end();
  });
}

export function processEnvironment(state, extra = {}) {
  const system = Object.fromEntries(
    ['PATH', 'HOME', 'TMPDIR', 'LANG', 'TZ']
      .filter((k) => process.env[k])
      .map((k) => [k, process.env[k]]),
  );
  const issuer = `${state.origins.auth}/realms/${state.realm}`;
  return {
    ...system,
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    TURBO_TELEMETRY_DISABLED: '1',
    HOST: '127.0.0.1',
    NODE_EXTRA_CA_CERTS: state.cert,
    NODE_OPTIONS: `--require ${resolve(E2E, 'harness/dns-preload.cjs')}`,
    E2E_HOST_SUFFIX: state.suffix,
    DATABASE_URL: state.databaseUrl,
    OIDC_PROVIDER: 'keycloak',
    OIDC_ISSUER: issuer,
    OIDC_AUDIENCE: 'ticket-api',
    OIDC_JWKS_URL: `${issuer}/protocol/openid-connect/certs`,
    CODE_HMAC_PEPPER: state.secrets.hmac,
    CODE_HMAC_VERSION: '1',
    TICKET_CREDENTIAL_KEY: state.secrets.credential,
    ACCOUNT_DELETION_TOMBSTONE_CURRENT_KEY_ID: 'e2e',
    ACCOUNT_DELETION_TOMBSTONE_KEYRING_JSON: JSON.stringify([
      {
        keyId: 'e2e',
        secretBase64: Buffer.from(state.secrets.hmac, 'hex').toString('base64'),
      },
    ]),
    SINGLE_CODE_RESOLVE_GLOBAL: '1',
    NEXT_PUBLIC_SINGLE_CODE_RESOLVE: '1',
    PLATFORM_ROOT_DOMAIN: state.suffix,
    PLATFORM_OIDC_ISSUER: issuer,
    PLATFORM_OIDC_JWKS_URL: `${issuer}/protocol/openid-connect/certs`,
    PLATFORM_OIDC_AUDIENCE: 'ticket-platform-api',
    PLATFORM_INVITE_TTL_SECONDS: '172800',
    PLATFORM_SUPPORT_TTL_MAX_SECONDS: '3600',
    PLATFORM_MFA_AUTH_TIME_MAX_SECONDS: '900',
    PLATFORM_MFA_ACR_VALUES: '2',
    SMTP_URL: `smtp://127.0.0.1:${state.ports.smtp}`,
    SMTP_FROM: 'Vemoki E2E <noreply@example.test>',
    APNS_ENABLED: '0',
    OUTBOX_POLL_MS: '300',
    PUBLIC_WEB_BASE_URL: state.origins.web,
    PRODUCT_ORIGIN: state.origins.web,
    PORTAL_ORIGIN: state.origins.portal,
    MARKETING_ORIGIN: state.origins.marketing,
    ...extra,
  };
}

export function startProcess(state, name, binary, args, env) {
  const file = openSync(resolve(state.dir, `${name}.log`), 'a', 0o600);
  const child = spawn(binary, args, {
    cwd: ROOT,
    env,
    detached: true,
    stdio: ['ignore', file, file],
  });
  closeSync(file);
  state.children.push(child);
  child.on('error', () => {});
  return child;
}

function bootstrapMinio(state) {
  const image =
    'cgr.dev/chainguard/minio@sha256:c93745c56fccdaf0e5dcb88999a96a65a136428beb045ef5d546255a80d747a7';
  const buckets = {
    assets: `e2e-${state.id}-assets`,
    imports: `e2e-${state.id}-imports`,
    exports: `e2e-${state.id}-exports`,
  };
  const identities = Object.fromEntries(
    ['shared', 'exports'].map((role) => [
      role,
      {
        accessKey: `e2e-${role}-${randomBytes(8).toString('hex')}`,
        secretKey: randomBytes(24).toString('hex'),
      },
    ]),
  );
  const host = (identity) =>
    `http://${identity.accessKey}:${identity.secretKey}@minio:9000`;
  const root = { accessKey: 'e2e-access', secretKey: state.secrets.minio };
  const mc = (identity, args, options = {}) =>
    command(
      'docker',
      [
        'run',
        '--rm',
        '--network',
        `${state.project}_default`,
        '--env',
        'MC_HOST_e2e',
        ...(options.policyPath
          ? ['--volume', `${options.policyPath}:/policy.json:ro`]
          : []),
        '--entrypoint',
        'mc',
        image,
        ...args,
      ],
      {
        env: { ...process.env, MC_HOST_e2e: host(identity) },
        input: options.input,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
  const policy = (templateName, replacements) => {
    const source = JSON.parse(
      readFileSync(
        resolve(ROOT, 'infra/deploy/minio-policies', templateName),
        'utf8',
      ),
    );
    for (const statement of source.Statement) {
      statement.Resource = statement.Resource.map((arn) => {
        for (const [from, to] of Object.entries(replacements))
          arn = arn.replace(`:::${from}/`, `:::${to}/`);
        return arn;
      });
    }
    const path = resolve(state.dir, templateName);
    privateJson(path, source);
    return path;
  };
  const sharedPolicy = policy('o06-shared-assets-imports.json', {
    'vemoki-assets': buckets.assets,
    'vemoki-imports': buckets.imports,
  });
  const exportsPolicy = policy('o06-exports-writer.json', {
    'vemoki-exports': buckets.exports,
  });
  const names = {
    shared: `e2e-shared-${state.id}`,
    exports: `e2e-exports-${state.id}`,
  };
  let stage = 'buckets';
  try {
    for (const bucket of Object.values(buckets))
      mc(root, ['mb', `e2e/${bucket}`]);
    stage = 'policies';
    for (const [role, path] of [
      ['shared', sharedPolicy],
      ['exports', exportsPolicy],
    ]) {
      mc(
        root,
        ['admin', 'policy', 'create', 'e2e', names[role], '/policy.json'],
        { policyPath: path },
      );
    }
    stage = 'users';
    for (const role of ['shared', 'exports']) {
      const identity = identities[role];
      mc(root, [
        'admin',
        'user',
        'add',
        'e2e',
        identity.accessKey,
        identity.secretKey,
      ]);
      mc(root, [
        'admin',
        'policy',
        'attach',
        'e2e',
        names[role],
        '--user',
        identity.accessKey,
      ]);
    }
    stage = 'policy checks';
    const put = (role, bucket, expectAllowed) => {
      stage = `PUT ${role} ${bucket}`;
      let allowed = true;
      try {
        mc(identities[role], ['pipe', `e2e/${bucket}/bootstrap-${role}`], {
          input: 'e2e-policy-check',
        });
      } catch (error) {
        if (
          !/Access Denied|AccessDenied|Insufficient permissions to access this path/i.test(
            String(error.stderr),
          )
        )
          throw error;
        allowed = false;
      }
      if (allowed !== expectAllowed)
        throw new Error(`unexpected PUT result for ${role} to ${bucket}`);
    };
    put('shared', buckets.assets, true);
    put('shared', buckets.imports, true);
    put('shared', buckets.exports, false);
    put('exports', buckets.exports, true);
    put('exports', buckets.assets, false);
    delete state.secrets.minio;
  } catch (error) {
    const detail = String(error.stderr || '')
      .replace(/https?:\/\/[^\s@]+@/g, 'http://[redacted]@')
      .replaceAll(root.secretKey, '[redacted]')
      .replaceAll(identities.shared.secretKey, '[redacted]')
      .replaceAll(identities.exports.secretKey, '[redacted]');
    writeFileSync(
      resolve(state.dir, 'minio-bootstrap.log'),
      `${stage}\n${detail}`,
      {
        mode: 0o600,
      },
    );
    throw new Error(
      `BLOCKED: MinIO ${stage} failed (${error.status ?? error.code ?? 'policy_mismatch'})`,
    );
  }
  state.minio = { buckets, identities };
}

export async function createRuntime(caseIds) {
  const id = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  const state = {
    id,
    project: `e2e-${id}`,
    realm: `e2e-${id}`,
    suffix: `e2e-${id}.test`,
    children: [],
    ports: {},
    secrets: {
      pg: randomBytes(24).toString('hex'),
      kc: randomBytes(24).toString('hex'),
      minio: randomBytes(24).toString('hex'),
      hmac: randomBytes(32).toString('hex'),
      credential: randomBytes(24).toString('hex'),
    },
  };
  state.dir = resolve(E2E, '.artifacts', id);
  mkdirSync(state.dir, { recursive: true, mode: 0o700 });
  state.sourceProvenance = captureSourceProvenance(ROOT);
  state.tlsPort = await freePort();
  state.origins = Object.fromEntries(
    ['web', 'portal', 'marketing', 'api', 'auth', 'mailpit'].map((key) => [
      key,
      `https://${key === 'marketing' ? state.suffix : (key === 'web' ? 'app' : key) + '.' + state.suffix}:${state.tlsPort}`,
    ]),
  );
  if (caseIds.includes('PLAT-05'))
    state.origins.faultPortal = `https://fault-portal.${state.suffix}:${state.tlsPort}`;
  if (caseIds.includes('AUTH-05'))
    state.origins.shortWeb = `https://short-web.${state.suffix}:${state.tlsPort}`;
  certs(state);
  composeConfig(state, realmConfig(state, caseIds));
  privateJson(resolve(state.dir, 'owner.json'), {
    runId: id,
    project: state.project,
    root: ROOT,
    pid: process.pid,
  });
  try {
    console.log(`E2E ${id}: khởi tạo stack Docker riêng`);
    const log = openSync(resolve(state.dir, 'compose.log'), 'a', 0o600);
    try {
      command(
        'docker',
        [
          'compose',
          '--project-name',
          state.project,
          '-f',
          state.composeFile,
          'up',
          '-d',
          '--wait',
          '--wait-timeout',
          '150',
        ],
        { stdio: ['ignore', log, log], timeout: 240_000 },
      );
    } finally {
      closeSync(log);
    }
    for (const [name, service, inner] of [
      ['pg', 'postgres', 5432],
      ['redis', 'redis', 6379],
      ['smtp', 'mailpit', 1025],
      ['mailpit', 'mailpit', 8025],
      ['auth', 'keycloak', 8080],
      ['minio', 'minio', 9000],
    ])
      state.ports[name] = publishedPort(state, service, inner);
    for (const name of ['api', 'web', 'portal'])
      state.ports[name] = await freePort();
    if (state.origins.faultPortal) state.ports.faultPortal = await freePort();
    if (state.origins.shortWeb) state.ports.shortWeb = await freePort();
    await startProxy(state);
    await waitFor(
      'Keycloak realm OIDC HTTPS',
      () =>
        getLocalJson(
          state,
          state.origins.auth,
          `/realms/${state.realm}/.well-known/openid-configuration`,
        ),
      150_000,
    );
    await waitFor(
      'MinIO health',
      async () =>
        (await fetch(`http://127.0.0.1:${state.ports.minio}/minio/health/live`))
          .status === 200,
    );
    bootstrapMinio(state);
    return state;
  } catch (error) {
    await destroyRuntime(state);
    if (error.message?.startsWith('BLOCKED: MinIO ')) throw error;
    throw new Error(
      `BLOCKED: không tạo được isolated runtime (${error.code || 'setup_failed'}); log private: ${state.dir}`,
    );
  }
}

export async function destroyRuntime(state) {
  const signalGroup = (child, signal) => {
    if (!child.pid) return;
    try {
      process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  };
  for (const child of state.children.toReversed()) {
    signalGroup(child, 'SIGTERM');
  }
  await Promise.allSettled(
    state.children.map(async (child) => {
      if (child.exitCode !== null || child.signalCode) return;
      const timer = setTimeout(() => {
        if (child.exitCode === null) signalGroup(child, 'SIGKILL');
      }, 5000);
      try {
        await once(child, 'exit');
      } finally {
        clearTimeout(timer);
      }
    }),
  );
  if (state.proxy) {
    state.proxy.closeAllConnections();
    await new Promise((done) => state.proxy.close(done));
  }
  if (state.composeFile) {
    const log = openSync(resolve(state.dir, 'cleanup.log'), 'a', 0o600);
    try {
      command(
        'docker',
        [
          'compose',
          '--project-name',
          state.project,
          '-f',
          state.composeFile,
          'down',
          '--volumes',
          '--remove-orphans',
        ],
        { stdio: ['ignore', log, log], timeout: 60_000 },
      );
    } finally {
      closeSync(log);
    }
  }
}
