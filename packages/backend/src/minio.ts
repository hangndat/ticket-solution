/**
 * Minimal S3-compatible PutObject/GetObject/presign for self-host MinIO (ADR-14).
 * Node builtins only for HTTP signing — no AWS SDK.
 */
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { ConfigError, CONFIG_ERROR_CODES } from './config-error';
import { metricsObserveSeconds } from './metrics-registry';

export type MinioConfig = {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
};

export type ObjectStore = {
  putObject(
    objectKey: string,
    body: Buffer,
    contentType: string,
  ): Promise<void>;
  getObject(objectKey: string): Promise<Buffer>;
  deleteObject(objectKey: string): Promise<void>;
  createPresignedPutUrl(input: {
    objectKey: string;
    contentType: string;
    expiresSeconds?: number;
  }): Promise<{ uploadUrl: string; expiresAt: Date }>;
};

export function readMinioEnvironment(
  env: NodeJS.ProcessEnv,
): MinioConfig | null {
  const endpoint = env['MINIO_ENDPOINT']?.trim();
  const accessKey = env['MINIO_ACCESS_KEY']?.trim();
  const secretKey = env['MINIO_SECRET_KEY']?.trim();
  // Shared identity serves assets by default; exports use the dedicated helper.
  const bucket =
    env['MINIO_BUCKET_ASSETS']?.trim() ||
    env['MINIO_ASSETS_BUCKET']?.trim() ||
    env['MINIO_BUCKET']?.trim() ||
    'ticket-assets';
  const region = env['MINIO_REGION']?.trim() || 'us-east-1';
  if (!endpoint || !accessKey || !secretKey) return null;
  return { endpoint, accessKey, secretKey, bucket, region };
}

/** Dedicated export identity. It must never fall back to the shared or root key. */
export function readMinioExportsEnvironment(
  env: NodeJS.ProcessEnv,
): MinioConfig | null {
  const endpoint = env['MINIO_ENDPOINT']?.trim();
  const accessKey = env['MINIO_EXPORTS_ACCESS_KEY']?.trim();
  const secretKey = env['MINIO_EXPORTS_SECRET_KEY']?.trim();
  const bucket = env['MINIO_BUCKET_EXPORTS']?.trim();
  const region = env['MINIO_REGION']?.trim() || 'us-east-1';
  if (!endpoint || !accessKey || !secretKey || !bucket) return null;
  return { endpoint, accessKey, secretKey, bucket, region };
}

export function requireMinioExportsConfig(env: NodeJS.ProcessEnv): MinioConfig {
  const cfg = readMinioExportsEnvironment(env);
  if (!cfg) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.MINIO_MISCONFIGURED,
      'MinIO exports identity is not configured',
    );
  }
  return cfg;
}

/** Prefer `MINIO_BUCKET_IMPORTS` for CSV quarantine (falls back to shared MinIO cfg). */
export function readMinioImportsEnvironment(
  env: NodeJS.ProcessEnv,
): MinioConfig | null {
  const base = readMinioEnvironment(env);
  if (!base) return null;
  const importsBucket = env['MINIO_BUCKET_IMPORTS']?.trim();
  if (importsBucket) return { ...base, bucket: importsBucket };
  return base;
}

export function requireMinioConfig(env: NodeJS.ProcessEnv): MinioConfig {
  const cfg = readMinioEnvironment(env);
  if (!cfg) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.MINIO_MISCONFIGURED,
      'MinIO is not configured',
    );
  }
  return cfg;
}

function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function amzDate(d: Date): { amz: string; date: string } {
  const iso = d.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amz: iso, date: iso.slice(0, 8) };
}

function objectPath(cfg: MinioConfig, objectKey: string): string {
  return `/${cfg.bucket}/${objectKey
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

function assertObjectKey(objectKey: string): void {
  if (typeof objectKey !== 'string' || objectKey.trim() === '') {
    throw new ConfigError(
      CONFIG_ERROR_CODES.ASSET_INVALID,
      'Object key is required',
    );
  }
  if (objectKey.startsWith('/') || objectKey.includes('\\')) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.ASSET_INVALID,
      'Object key is invalid',
    );
  }
  for (const segment of objectKey.split('/')) {
    if (segment === '..' || segment === '.') {
      throw new ConfigError(
        CONFIG_ERROR_CODES.ASSET_INVALID,
        'Object key is invalid',
      );
    }
  }
}

async function signedRequest(input: {
  cfg: MinioConfig;
  method: 'PUT' | 'GET' | 'DELETE';
  objectKey: string;
  body?: Buffer;
  contentType?: string;
  timeoutMs?: number;
  notFoundOk?: boolean;
}): Promise<Buffer> {
  const url = new URL(input.cfg.endpoint);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.MINIO_MISCONFIGURED,
      'MINIO_ENDPOINT must be http(s)',
    );
  }
  const host = url.host;
  const path = objectPath(input.cfg, input.objectKey);
  const body = input.body ?? Buffer.alloc(0);
  const payloadHash = sha256Hex(body);
  const now = new Date();
  const { amz, date } = amzDate(now);
  const contentType = input.contentType ?? 'application/octet-stream';

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amz}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    input.method,
    path,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${date}/${input.cfg.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amz,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`AWS4${input.cfg.secretKey}`, date);
  const kRegion = hmac(kDate, input.cfg.region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning)
    .update(stringToSign, 'utf8')
    .digest('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${input.cfg.accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const transport = url.protocol === 'https:' ? httpsRequest : httpRequest;
  const port = url.port
    ? Number(url.port)
    : url.protocol === 'https:'
      ? 443
      : 80;

  return new Promise((resolve, reject) => {
    const req = transport(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port,
        path,
        method: input.method,
        headers: {
          Host: host,
          'Content-Type': contentType,
          'Content-Length': body.length,
          'X-Amz-Content-Sha256': payloadHash,
          'X-Amz-Date': amz,
          Authorization: authorization,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) =>
          chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)),
        );
        res.on('end', () => {
          clearTimeout(deadline);
          const buf = Buffer.concat(chunks);
          const status = res.statusCode ?? 500;
          if (status >= 400) {
            if (input.notFoundOk && status === 404) {
              resolve(Buffer.alloc(0));
              return;
            }
            reject(
              new ConfigError(
                CONFIG_ERROR_CODES.MINIO_MISCONFIGURED,
                `MinIO ${input.method} failed`,
              ),
            );
            return;
          }
          resolve(buf);
        });
        res.on('error', () => {
          clearTimeout(deadline);
          reject(
            new ConfigError(
              CONFIG_ERROR_CODES.MINIO_MISCONFIGURED,
              'MinIO response failed',
            ),
          );
        });
      },
    );
    const deadline = setTimeout(() => {
      req.destroy(new Error('MinIO request timeout'));
    }, input.timeoutMs ?? 60_000);
    req.on('error', () => {
      clearTimeout(deadline);
      reject(
        new ConfigError(
          CONFIG_ERROR_CODES.MINIO_MISCONFIGURED,
          'MinIO connection failed',
        ),
      );
    });
    if (body.length) req.write(body);
    req.end();
  });
}

export async function putObject(
  cfg: MinioConfig,
  objectKey: string,
  body: Buffer,
  contentType: string,
  timeoutMs?: number,
): Promise<void> {
  const started = performance.now();
  try {
    await signedRequest({
      cfg,
      method: 'PUT',
      objectKey,
      body,
      contentType,
      timeoutMs,
    });
  } finally {
    metricsObserveSeconds(
      'worker_provider_latency_seconds',
      (performance.now() - started) / 1000,
      { provider: 'minio' },
    );
  }
}

export async function getObject(
  cfg: MinioConfig,
  objectKey: string,
): Promise<Buffer> {
  return signedRequest({ cfg, method: 'GET', objectKey });
}

export async function deleteObject(
  cfg: MinioConfig,
  objectKey: string,
  timeoutMs?: number,
): Promise<void> {
  assertObjectKey(objectKey);
  const started = performance.now();
  try {
    await signedRequest({
      cfg,
      method: 'DELETE',
      objectKey,
      timeoutMs,
      notFoundOk: true,
    });
  } finally {
    metricsObserveSeconds(
      'worker_provider_latency_seconds',
      (performance.now() - started) / 1000,
      { provider: 'minio' },
    );
  }
}

export function createPresignedPutUrl(
  cfg: MinioConfig,
  input: {
    objectKey: string;
    contentType: string;
    expiresSeconds?: number;
  },
): { uploadUrl: string; expiresAt: Date } {
  const url = new URL(cfg.endpoint);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new ConfigError(
      CONFIG_ERROR_CODES.MINIO_MISCONFIGURED,
      'MINIO_ENDPOINT must be http(s)',
    );
  }
  const expires = Math.min(Math.max(input.expiresSeconds ?? 900, 60), 3600);
  const now = new Date();
  const { amz, date } = amzDate(now);
  const credentialScope = `${date}/${cfg.region}/s3/aws4_request`;
  const credential = `${cfg.accessKey}/${credentialScope}`;
  const path = objectPath(cfg, input.objectKey);
  const signedHeaders = 'content-type;host';
  const query = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amz,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': signedHeaders,
  });
  // AWS requires query params sorted by name for the canonical request.
  const canonicalQuery = [...query.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(v).replace(/%20/g, '+')}`,
    )
    .join('&');

  const canonicalHeaders = `content-type:${input.contentType}\nhost:${url.host}\n`;
  const canonicalRequest = [
    'PUT',
    path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amz,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const kDate = hmac(`AWS4${cfg.secretKey}`, date);
  const kRegion = hmac(kDate, cfg.region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning)
    .update(stringToSign, 'utf8')
    .digest('hex');

  const uploadUrl = `${url.protocol}//${url.host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
  return {
    uploadUrl,
    expiresAt: new Date(now.getTime() + expires * 1000),
  };
}

export function createMinioObjectStore(cfg: MinioConfig): ObjectStore {
  return {
    putObject: (objectKey, body, contentType) =>
      putObject(cfg, objectKey, body, contentType),
    getObject: (objectKey) => getObject(cfg, objectKey),
    deleteObject: (objectKey) => deleteObject(cfg, objectKey),
    createPresignedPutUrl: (input) =>
      Promise.resolve(createPresignedPutUrl(cfg, input)),
  };
}

/** In-memory store for isolated tests — not for production. */
export function createMemoryObjectStore(): ObjectStore & {
  objects: Map<string, { body: Buffer; contentType: string }>;
} {
  const objects = new Map<string, { body: Buffer; contentType: string }>();
  return {
    objects,
    async putObject(objectKey, body, contentType) {
      objects.set(objectKey, { body: Buffer.from(body), contentType });
    },
    async getObject(objectKey) {
      const row = objects.get(objectKey);
      if (!row) {
        throw new ConfigError(
          CONFIG_ERROR_CODES.ASSET_NOT_FOUND,
          'Object not found in memory store',
        );
      }
      return Buffer.from(row.body);
    },
    async deleteObject(objectKey) {
      assertObjectKey(objectKey);
      objects.delete(objectKey);
    },
    async createPresignedPutUrl(input) {
      const token = randomUUID();
      const expiresAt = new Date(
        Date.now() + (input.expiresSeconds ?? 900) * 1000,
      );
      return {
        uploadUrl: `memory://upload/${encodeURIComponent(input.objectKey)}?token=${token}&ct=${encodeURIComponent(input.contentType)}`,
        expiresAt,
      };
    },
  };
}
