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
  /** Cancels provider I/O when the per-send deadline expires. */
  signal?: AbortSignal;
};

export type ApnsSendResult =
  | {
      ok: true;
      providerStatus: 'ACCEPTED';
      providerRef: string;
      /** APNs host that accepted the push (may differ from client-reported label). */
      resolvedEnvironment: ApnsEnvironment;
    }
  | {
      ok: false;
      providerStatus: 'FAILED';
      reason: string;
      invalidateToken: boolean;
      retryable: boolean;
    };

/** Reject typos at startup rather than treating them as intentional disablement. */
export function isApnsEnabled(env: NodeJS.ProcessEnv): boolean {
  const raw = env['APNS_ENABLED']?.trim().toLowerCase();
  if (raw === undefined || raw === '' || raw === 'false' || raw === '0' || raw === 'no') return false;
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  throw new DeviceTokenError(
    DEVICE_TOKEN_ERROR_CODES.APNS_MISCONFIGURED,
    'APNS_ENABLED must be true|1|yes or false|0|no',
  );
}

/** Default on; set APNS_ENV_FALLBACK=0|false|no to disable cross-host retry. */
export function isApnsEnvFallbackEnabled(env: NodeJS.ProcessEnv): boolean {
  const raw = env['APNS_ENV_FALLBACK']?.trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'no') return false;
  return true;
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

function alternateApnsEnvironment(env: ApnsEnvironment): ApnsEnvironment {
  return env === 'production' ? 'sandbox' : 'production';
}

function parseApnsReason(body: string): string {
  try {
    const parsed = JSON.parse(body) as { reason?: string };
    if (parsed.reason) return parsed.reason;
  } catch {
    // keep generic
  }
  return 'provider_error';
}

function failureFromResponse(
  status: number,
  apnsReason: string,
): ApnsSendResult {
  const invalidateToken =
    apnsReason === 'BadDeviceToken' ||
    apnsReason === 'Unregistered' ||
    apnsReason === 'DeviceTokenNotForTopic';
  const retryable = status === 429 || status >= 500;
  return {
    ok: false,
    providerStatus: 'FAILED',
    reason: 'provider_error',
    invalidateToken,
    retryable,
  };
}

function envMismatchFallbackReason(apnsReason: string): boolean {
  return apnsReason === 'BadDeviceToken' || apnsReason === 'DeviceTokenNotForTopic';
}

async function providerToken(cfg: ApnsConfig): Promise<string> {
  const key = await importPKCS8(cfg.privateKeyPem, 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: cfg.keyId })
    .setIssuer(cfg.teamId)
    .setIssuedAt()
    .sign(key);
}

export type ApnsHttp2ExchangeResult = {
  status: number;
  body: string;
  apnsId: string;
};

export type ApnsHttp2Client = {
  exchange(
    environment: ApnsEnvironment,
    request: {
      path: string;
      authorization: string;
      bundleId: string;
      apnsId: string;
      payload: string;
      signal?: AbortSignal;
    },
  ): Promise<ApnsHttp2ExchangeResult>;
};

let testHttp2Client: ApnsHttp2Client | undefined;

/** Test-only: inject mock HTTP/2 transport (cleared when set to undefined). */
export function setApnsHttp2ClientForTest(client: ApnsHttp2Client | undefined): void {
  testHttp2Client = client;
}

async function defaultHttp2Exchange(
  environment: ApnsEnvironment,
  request: {
    path: string;
    authorization: string;
    bundleId: string;
    apnsId: string;
    payload: string;
    signal?: AbortSignal;
  },
): Promise<ApnsHttp2ExchangeResult> {
  const host = hostFor(environment);
  let session: ClientHttp2Session | null = null;
  try {
    session = connect(`https://${host}`);
    return await new Promise<ApnsHttp2ExchangeResult>((resolve, reject) => {
      const req = session!.request({
        ':method': 'POST',
        ':path': request.path,
        'authorization': request.authorization,
        'apns-topic': request.bundleId,
        'apns-push-type': 'alert',
        'apns-id': request.apnsId,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(request.payload),
      });
      const chunks: Buffer[] = [];
      let status = 0;
      const abort = () => {
        req.close();
        session?.destroy();
        reject(new Error('apns_request_timeout_or_aborted'));
      };
      if (request.signal?.aborted) {
        abort();
        return;
      }
      request.signal?.addEventListener('abort', abort, { once: true });
      req.on('response', (headers) => {
        status = Number(headers[':status'] ?? 0);
      });
      req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      req.on('error', (error) => {
        request.signal?.removeEventListener('abort', abort);
        reject(error);
      });
      session!.on('error', reject);
      req.on('end', () => {
        request.signal?.removeEventListener('abort', abort);
        resolve({
          status,
          body: Buffer.concat(chunks).toString('utf8'),
          apnsId: request.apnsId,
        });
      });
      req.end(request.payload);
    });
  } finally {
    session?.close();
  }
}

async function sendApnsToEnvironment(
  cfg: ApnsConfig,
  input: ApnsSendInput,
  environment: ApnsEnvironment,
  bearerToken: string,
  http2: ApnsHttp2Client,
): Promise<ApnsHttp2ExchangeResult> {
  const apnsId = randomUUID();
  const path = `/3/device/${input.deviceToken}`;
  const payload = JSON.stringify({
    aps: {
      alert: { title: input.title, body: input.body },
      sound: 'default',
    },
    ...(input.data ?? {}),
  });
  return http2.exchange(environment, {
    path,
    authorization: `bearer ${bearerToken}`,
    bundleId: cfg.bundleId,
    apnsId,
    payload,
    signal: input.signal,
  });
}

async function sendApnsPushWithinDeadline(
  cfg: ApnsConfig,
  input: ApnsSendInput,
  options?: { env?: NodeJS.ProcessEnv; http2?: ApnsHttp2Client },
): Promise<ApnsSendResult> {
  const processEnv = options?.env ?? process.env;
  const http2 = options?.http2 ?? testHttp2Client ?? { exchange: defaultHttp2Exchange };
  const bearerToken = await providerToken(cfg);

  const primary = await sendApnsToEnvironment(
    cfg,
    input,
    input.environment,
    bearerToken,
    http2,
  );
  if (primary.status === 200) {
    return {
      ok: true,
      providerStatus: 'ACCEPTED',
      providerRef: primary.apnsId,
      resolvedEnvironment: input.environment,
    };
  }

  const primaryReason = parseApnsReason(primary.body);
  if (primaryReason === 'Unregistered' || primary.status === 410) {
    return failureFromResponse(primary.status, primaryReason);
  }

  const fallbackAllowed =
    isApnsEnabled(processEnv) && isApnsEnvFallbackEnabled(processEnv);

  if (
    fallbackAllowed &&
    primary.status === 400 &&
    envMismatchFallbackReason(primaryReason)
  ) {
    const alternate = alternateApnsEnvironment(input.environment);
    const secondary = await sendApnsToEnvironment(
      cfg,
      input,
      alternate,
      bearerToken,
      http2,
    );
    if (secondary.status === 200) {
      return {
        ok: true,
        providerStatus: 'ACCEPTED',
        providerRef: secondary.apnsId,
        resolvedEnvironment: alternate,
      };
    }
    const secondaryReason = parseApnsReason(secondary.body);
    return failureFromResponse(secondary.status, secondaryReason);
  }

  return failureFromResponse(primary.status, primaryReason);
}

/** An entire primary + fallback attempt must fit inside one lease window. */
export async function sendApnsPush(
  cfg: ApnsConfig,
  input: ApnsSendInput,
  options?: { env?: NodeJS.ProcessEnv; http2?: ApnsHttp2Client; timeoutMs?: number },
): Promise<ApnsSendResult> {
  const timeoutMs = options?.timeoutMs ?? 15_000;
  const deadline = AbortSignal.timeout(timeoutMs);
  const signal = input.signal
    ? AbortSignal.any([input.signal, deadline])
    : deadline;
  if (signal.aborted) throw new Error('apns_request_timeout_or_aborted');
  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new Error('apns_request_timeout_or_aborted'));
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([
      sendApnsPushWithinDeadline(cfg, { ...input, signal }, options),
      aborted,
    ]);
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort);
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
      return sendApnsPush(cfg, input, { env });
    },
  };
}
