/**
 * Verify platform access token (acr/auth_time/audience) then invoke BE bootstrap.
 * Token only from env file path or stdin — never argv, never logged.
 */
import { createPublicKey, createVerify } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSecurityConfig } from './platform-security-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function readToken() {
  const file = process.env.PLATFORM_BOOTSTRAP_TOKEN_FILE || '';
  if (file) {
    return readFileSync(file, 'utf8').trim();
  }
  if (process.env.PLATFORM_BOOTSTRAP_TOKEN_STDIN === '1') {
    return readFileSync(0, 'utf8').trim();
  }
  throw new Error('token source missing');
}

function b64urlJson(part) {
  const padded = part + '='.repeat((4 - (part.length % 4)) % 4);
  return JSON.parse(
    Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
      'utf8',
    ),
  );
}

async function fetchJwks(issuer) {
  const url = `${issuer.replace(/\/$/, '')}/protocol/openid-connect/certs`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  return res.json();
}

async function verifyJwt(token, { audience, maxAuthAgeSec, requiredAcr }) {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) throw new Error('malformed JWT');
  const header = b64urlJson(h);
  const payload = b64urlJson(p);
  if (!payload.iss) throw new Error('missing iss');
  const jwks = await fetchJwks(payload.iss);
  const jwk =
    (jwks.keys || []).find((k) => k.kid === header.kid) || jwks.keys?.[0];
  if (!jwk) throw new Error('no JWK');
  const key = createPublicKey({ key: jwk, format: 'jwk' });
  const verifier = createVerify(
    header.alg === 'RS384'
      ? 'RSA-SHA384'
      : header.alg === 'RS512'
        ? 'RSA-SHA512'
        : 'RSA-SHA256',
  );
  verifier.update(`${h}.${p}`);
  verifier.end();
  const sig = Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (!verifier.verify(key, sig)) throw new Error('JWT signature invalid');

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error('token expired');
  const aud = payload.aud;
  const audOk = Array.isArray(aud) ? aud.includes(audience) : aud === audience;
  if (!audOk) throw new Error(`audience mismatch (need ${audience})`);
  if (String(payload.acr) !== String(requiredAcr)) {
    throw new Error(`acr mismatch (need ${requiredAcr})`);
  }
  const authTime = Number(payload.auth_time);
  if (!Number.isFinite(authTime) || authTime <= 0) {
    throw new Error('auth_time missing — MFA session proof required');
  }
  if (now - authTime > maxAuthAgeSec) {
    throw new Error(`auth_time too old (>${maxAuthAgeSec}s) — step-up required`);
  }
  if (payload.email_verified !== true && payload.email_verified !== 'true') {
    throw new Error('email_verified required');
  }
  if (!payload.sub) throw new Error('missing sub');
  return {
    issuer: payload.iss,
    subject: payload.sub,
    email: payload.email || null,
    authTime,
    acr: String(payload.acr),
  };
}

function invokeBackendBootstrap(identity) {
  const candidates = [
    path.join(ROOT, 'packages/backend/dist/platform-bootstrap.js'),
    path.join(ROOT, 'packages/backend/dist/cli/platform-bootstrap.js'),
    path.join(ROOT, 'apps/api/dist/platform-bootstrap.js'),
  ];
  const entry = candidates.find((p) => existsSync(p));
  if (!entry) {
    return {
      invoked: false,
      reason:
        'BE platform-bootstrap module chưa có — chỉ verify JWT. Chờ BE contract/migration.',
    };
  }
  const env = {
    ...process.env,
    PLATFORM_BOOTSTRAP_ISSUE: identity.issuer,
    PLATFORM_BOOTSTRAP_SUBJECT: identity.subject,
    PLATFORM_BOOTSTRAP_EMAIL: identity.email || '',
    PLATFORM_BOOTSTRAP_AUTH_TIME: String(identity.authTime),
    PLATFORM_BOOTSTRAP_ACR: identity.acr,
  };
  delete env.PLATFORM_BOOTSTRAP_TOKEN_FILE;
  delete env.PLATFORM_BOOTSTRAP_TOKEN_STDIN;
  const r = spawnSync(process.execPath, [entry], {
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (r.status !== 0) {
    throw new Error(
      `BE bootstrap failed (exit ${r.status}): ${(r.stderr || r.stdout || '').slice(0, 400)}`,
    );
  }
  return { invoked: true, stdout: (r.stdout || '').trim().slice(0, 200) };
}

async function main() {
  const { cfg } = loadSecurityConfig({ requireProductionKeys: true });
  const audience = cfg.oidc.platformAudience;
  const maxAuthAgeSec = cfg.mfaStepUp.maxAuthTimeAgeMinutes * 60;
  const requiredAcr = cfg.mfaStepUp.requiredAcr;

  const token = readToken();
  if (!token || token.split('.').length !== 3) {
    throw new Error('token empty or not JWT');
  }

  const identity = await verifyJwt(token, {
    audience,
    maxAuthAgeSec,
    requiredAcr,
  });

  const subjectFile = process.env.PLATFORM_BOOTSTRAP_SUBJECT_FILE || '';
  if (subjectFile) {
    const expected = readFileSync(subjectFile, 'utf8').trim();
    const [expIss, expSub] = expected.split('|');
    if (expIss !== identity.issuer || expSub !== identity.subject) {
      throw new Error('subject-file mismatch with token identity');
    }
  }

  console.log(
    `PLATFORM_BOOTSTRAP_TOKEN_OK iss=${identity.issuer} sub=${identity.subject} acr=${identity.acr} auth_time=${identity.authTime}`,
  );

  if (process.env.PLATFORM_BOOTSTRAP_VERIFY_ONLY === '1') {
    console.log('PLATFORM_BOOTSTRAP_VERIFY_ONLY — skipped BE invoke');
    return;
  }

  const result = invokeBackendBootstrap(identity);
  if (!result.invoked) {
    console.log(`PLATFORM_BOOTSTRAP_DEFERRED ${result.reason}`);
    return;
  }
  console.log(`PLATFORM_BOOTSTRAP_BE_OK ${result.stdout || ''}`.trim());
}

main().catch((err) => {
  console.error(`PLATFORM_BOOTSTRAP_FAIL ${err.message || err}`);
  process.exit(1);
});
