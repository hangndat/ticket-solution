/**
 * Direct APNs HTTP/2 provider token auth (ADR-12).
 * 200 = ACCEPTED by APNs, never end-user delivered.
 * Missing config when enabled → fail-closed (throw), never silent success.
 */
import { createPrivateKey, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { connect, type ClientHttp2Session } from 'node:http2';
import { SignJWT, importPKCS8 } from 'jose';
import {
  DeviceTokenError,
  DEVICE_TOKEN_ERROR_CODES,
} from './device-token-error';

export type ApnsEnvironment = 'sandbox' | 'production';

export type ApnsConfig = {
  keyId: string;
  teamId: string;
  privateKeyPem: string;
  bundleId: string;
};

export type ApnsSendInput = {
  deviceToken: string;
  environment: ApnsEnvironment;
  title: string;
  body: string;
  /** Opaque data — must not include QR/PII. */
  data?: Record<string, string>;
};

export type ApnsSendResult =
  | { ok: true; providerStatus: 'ACCEPTED'; providerRef: string }
  | {
      ok: false;
      providerStatus: 'FAILED';
      reason: string;
      invalidateToken: boolean;
      retryable: boolean;
    };

/** True only when operator explicitly enables push (APNS_ENABLED=true|1|yes). */
export function isApnsEnabled(env: NodeJS.ProcessEnv): boolean {
  const raw = env['APNS_ENABLED']?.trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

/**
 * Resolve AuthKey PEM from env (never invent/commit .p8).
 * Prefer APNS_KEY_PATH (host/secret mount), then APNS_KEY_P8 / APNS_PRIVATE_KEY.
 */
export function readApnsPrivateKeyPem(env: NodeJS.ProcessEnv): string | null {
  const path = env['APNS_KEY_PATH']?.trim();
  if (path) {
    try {
      const pem = readFileSync(path, 'utf8').trim();
      return pem.length > 0 ? pem : null;
    } catch {
      return null;
    }
  }
  const inline =
    env['APNS_KEY_P8']?.trim() || env['APNS_PRIVATE_KEY']?.trim() || '';
  if (!inline) return null;
  return inline.replace(/\\n/g, '\n');
}

export function readApnsEnvironment(env: NodeJS.ProcessEnv): ApnsConfig | null {
  const keyId = env['APNS_KEY_ID']?.trim();
  const teamId = env['APNS_TEAM_ID']?.trim();
  const privateKeyPem = readApnsPrivateKeyPem(env);
  const bundleId = env['APNS_BUNDLE_ID']?.trim();
  if (!keyId || !teamId || !privateKeyPem || !bundleId) return null;
  return { keyId, teamId, privateKeyPem, bundleId };
}

export function requireApnsConfig(env: NodeJS.ProcessEnv): ApnsConfig {
  if (!isApnsEnabled(env)) {
    throw new DeviceTokenError(
      DEVICE_TOKEN_ERROR_CODES.APNS_MISCONFIGURED,
      'APNs is disabled (APNS_ENABLED is not true)',
    );
  }
  const cfg = readApnsEnvironment(env);
  if (!cfg) {
    throw new DeviceTokenError(
      DEVICE_TOKEN_ERROR_CODES.APNS_MISCONFIGURED,
      'APNs is enabled but key/config is incomplete (APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_KEY_PATH|APNS_KEY_P8)',
    );
  }
  // Validate key parses early (fail-closed).
  createPrivateKey(cfg.privateKeyPem);
  return cfg;
}

function hostFor(env: ApnsEnvironment): string {
  return env === 'production'
    ? 'api.push.apple.com'
    : 'api.sandbox.push.apple.com';
}

async function providerToken(cfg: ApnsConfig): Promise<string> {
  const key = await importPKCS8(cfg.privateKeyPem, 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: cfg.keyId })
    .setIssuer(cfg.teamId)
    .setIssuedAt()
    .sign(key);
}

export async function sendApnsPush(
  cfg: ApnsConfig,
  input: ApnsSendInput,
): Promise<ApnsSendResult> {
  const token = await providerToken(cfg);
  const host = hostFor(input.environment);
  const path = `/3/device/${input.deviceToken}`;
  const apnsId = randomUUID();
  const payload = JSON.stringify({
    aps: {
      alert: { title: input.title, body: input.body },
      sound: 'default',
    },
    ...(input.data ?? {}),
  });

  let session: ClientHttp2Session | null = null;
  try {
    session = connect(`https://${host}`);
    const result = await new Promise<ApnsSendResult>((resolve, reject) => {
      const req = session!.request({
        ':method': 'POST',
        ':path': path,
        'authorization': `bearer ${token}`,
        'apns-topic': cfg.bundleId,
        'apns-push-type': 'alert',
        'apns-id': apnsId,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      });
      const chunks: Buffer[] = [];
      let status = 0;
      req.on('response', (headers) => {
        status = Number(headers[':status'] ?? 0);
      });
      req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      req.on('error', reject);
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (status === 200) {
          resolve({
            ok: true,
            providerStatus: 'ACCEPTED',
            providerRef: apnsId,
          });
          return;
        }
        let reason = 'provider_error';
        try {
          const parsed = JSON.parse(body) as { reason?: string };
          if (parsed.reason) reason = parsed.reason;
        } catch {
          // keep generic
        }
        const invalidateToken =
          reason === 'BadDeviceToken' ||
          reason === 'Unregistered' ||
          reason === 'DeviceTokenNotForTopic';
        const retryable = status === 429 || status >= 500;
        resolve({
          ok: false,
          providerStatus: 'FAILED',
          reason: 'provider_error',
          invalidateToken,
          retryable,
        });
      });
      req.end(payload);
    });
    return result;
  } finally {
    session?.close();
  }
}

export type ApnsAdapter = {
  send(input: ApnsSendInput): Promise<ApnsSendResult>;
};

/**
 * Fail-closed adapter when APNS_ENABLED without usable key.
 * Callers that omit options.apns skip push; do not use this adapter when disabled.
 */
export function createApnsAdapter(env: NodeJS.ProcessEnv): ApnsAdapter {
  // Validate at construction when enabled — refuse to start half-configured.
  if (isApnsEnabled(env)) {
    requireApnsConfig(env);
  }
  return {
    async send(input) {
      const cfg = requireApnsConfig(env);
      return sendApnsPush(cfg, input);
    },
  };
}
